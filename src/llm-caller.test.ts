import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, listModels } from './llm-caller.js';
import { CopilotClient } from '@github/copilot-sdk';

// Mock the SDK
vi.mock('@github/copilot-sdk', () => {
  return {
    CopilotClient: vi.fn()
  };
});

describe('LLM Caller', () => {
  let mockClientInstance: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const eventCallbacks: Record<string, any> = {};
    mockSession = {
        sendAndWait: vi.fn(),
        send: vi.fn(),
        on: vi.fn().mockImplementation((event: string, cb: any) => {
            eventCallbacks[event] = cb;
            return () => {};
        }),
        destroy: vi.fn(),
    };

    mockClientInstance = {
        start: vi.fn(),
        stop: vi.fn(),
        createSession: vi.fn().mockResolvedValue(mockSession),
        listModels: vi.fn().mockResolvedValue([{ id: 'gpt-4.1' }, { id: 'claude-sonnet' }]),
    };

    (mockSession as any).eventCallbacks = eventCallbacks;

    (CopilotClient as any).mockImplementation(function() { return mockClientInstance; });
  });

  it('should call LLM successfully with streaming fallback (default behavior)', async () => {
    // Behavior: tries streaming first. If it fails or we want to test non-streaming, we need to control the mocks.
    // The code tries streaming first:
    // sendOnce(..., streaming: true)
    
    // Let's simulate a successful streaming response
    // streaming uses session.send() and listens to events via session.on()
    // We need to mock session.on to trigger callbacks
    
    const eventCallbacks = (mockSession as any).eventCallbacks;

    mockSession.send.mockImplementation(async () => {
        // Simulate response delivery after send
        if (eventCallbacks['assistant.message_delta']) {
            eventCallbacks['assistant.message_delta']({ data: { deltaContent: 'LLM ' } });
            eventCallbacks['assistant.message_delta']({ data: { deltaContent: 'Response' } });
        }
        if (eventCallbacks['assistant.message']) {
            eventCallbacks['assistant.message']({ data: { content: 'LLM Response' } });
        }
    });

    const result = await callLLM('sys', 'user', 'provider', 'key', 'model');
    
    expect(result).toBe('LLM Response');
    expect(mockClientInstance.start).toHaveBeenCalled();
    expect(mockClientInstance.stop).toHaveBeenCalled();
    expect(mockClientInstance.createSession).toHaveBeenCalled();
  });

  it('should pass provider config to createSession when providerUrl is set', async () => {
    const eventCallbacks = (mockSession as any).eventCallbacks;

    mockSession.send.mockImplementation(async () => {
      if (eventCallbacks['assistant.message']) {
        eventCallbacks['assistant.message']({ data: { content: 'BYOK Response' } });
      }
    });

    await callLLM('sys', 'user', 'https://api.example.com/v1', 'my-api-key', 'gpt-4');

    expect(mockClientInstance.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'my-api-key',
        },
      })
    );
  });

  it('should not pass provider config to createSession when providerUrl is empty', async () => {
    const eventCallbacks = (mockSession as any).eventCallbacks;

    mockSession.send.mockImplementation(async () => {
      if (eventCallbacks['assistant.message']) {
        eventCallbacks['assistant.message']({ data: { content: 'Default Response' } });
      }
    });

    await callLLM('sys', 'user', '', '', 'gpt-4.1');

    const sessionConfig = mockClientInstance.createSession.mock.calls[0][0];
    expect(sessionConfig).not.toHaveProperty('provider');
  });

  it('should fallback to non-streaming if streaming fails with specific error', async () => {
      // Simulate streaming error
      mockSession.send.mockRejectedValue(new Error('Stream completed without a response.completed event'));
      
      // For non-streaming, it calls sendAndWait
      mockSession.sendAndWait.mockResolvedValue({ data: { content: 'Fallback Response' } });
      
      const result = await callLLM('sys', 'user', 'provider', 'key', 'model');
      
      expect(result).toBe('Fallback Response');
      // Should have called createSession twice (once for stream, once for fallback)
      expect(mockClientInstance.createSession).toHaveBeenCalledTimes(2);
  });

  it('should throw on generic error', async () => {
      const error = new Error('Generic Error');
      mockClientInstance.createSession.mockRejectedValue(error);
      
      await expect(callLLM('sys', 'user', 'provider', 'key', 'model'))
        .rejects.toThrow('Generic Error');
  });
});

describe('listModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockClientInstance = {
      start: vi.fn(),
      stop: vi.fn(),
      listModels: vi.fn().mockResolvedValue([{ id: 'gpt-4.1' }, { id: 'claude-sonnet' }]),
    };
    (CopilotClient as any).mockImplementation(function() { return mockClientInstance; });
  });

  it('should list models from GitHub Copilot when no providerUrl is given', async () => {
    const models = await listModels();
    expect(models).toEqual(['gpt-4.1', 'claude-sonnet']);
  });

  it('should fetch models from custom provider when providerUrl is given', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'llama3' }, { id: 'mistral' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const models = await listModels('http://localhost:11434/v1', '');
    expect(models).toEqual(['llama3', 'mistral']);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/models',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
    );

    vi.unstubAllGlobals();
  });

  it('should include Authorization header when apiKey is provided for custom provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-4' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await listModels('https://api.example.com/v1', 'my-secret-key');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-secret-key' }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('should throw when custom provider returns an error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(listModels('https://api.example.com/v1', 'bad-key')).rejects.toThrow(
      'Failed to fetch models'
    );

    vi.unstubAllGlobals();
  });
});
