import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, listModels, LLMProviderConfig } from './llm-caller.js';
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
    const eventCallbacks = (mockSession as any).eventCallbacks;

    mockSession.send.mockImplementation(async () => {
        if (eventCallbacks['assistant.message_delta']) {
            eventCallbacks['assistant.message_delta']({ data: { deltaContent: 'LLM ' } });
            eventCallbacks['assistant.message_delta']({ data: { deltaContent: 'Response' } });
        }
        if (eventCallbacks['assistant.message']) {
            eventCallbacks['assistant.message']({ data: { content: 'LLM Response' } });
        }
    });

    const result = await callLLM('sys', 'user', 'model');
    
    expect(result).toBe('LLM Response');
    expect(mockClientInstance.start).toHaveBeenCalled();
    expect(mockClientInstance.stop).toHaveBeenCalled();
    expect(mockClientInstance.createSession).toHaveBeenCalled();
  });

  it('should pass provider config object to createSession when provider is set', async () => {
    const eventCallbacks = (mockSession as any).eventCallbacks;

    mockSession.send.mockImplementation(async () => {
      if (eventCallbacks['assistant.message']) {
        eventCallbacks['assistant.message']({ data: { content: 'BYOK Response' } });
      }
    });

    const provider: LLMProviderConfig = {
      type: 'openai',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'my-api-key',
      wireApi: 'responses',
    };

    await callLLM('sys', 'user', 'gpt-4', provider);

    expect(mockClientInstance.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          type: 'openai',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'my-api-key',
          wireApi: 'responses',
        },
      })
    );
  });

  it('should not pass provider config to createSession when provider is undefined', async () => {
    const eventCallbacks = (mockSession as any).eventCallbacks;

    mockSession.send.mockImplementation(async () => {
      if (eventCallbacks['assistant.message']) {
        eventCallbacks['assistant.message']({ data: { content: 'Default Response' } });
      }
    });

    await callLLM('sys', 'user', 'gpt-4.1');

    const sessionConfig = mockClientInstance.createSession.mock.calls[0][0];
    expect(sessionConfig).not.toHaveProperty('provider');
  });

  it('should fallback to non-streaming if streaming fails with specific error', async () => {
      mockSession.send.mockRejectedValue(new Error('Stream completed without a response.completed event'));
      mockSession.sendAndWait.mockResolvedValue({ data: { content: 'Fallback Response' } });
      
      const result = await callLLM('sys', 'user', 'model');
      
      expect(result).toBe('Fallback Response');
      expect(mockClientInstance.createSession).toHaveBeenCalledTimes(2);
  });

  it('should throw on generic error', async () => {
      const error = new Error('Generic Error');
      mockClientInstance.createSession.mockRejectedValue(error);
      
      await expect(callLLM('sys', 'user', 'model'))
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

  it('should list models from GitHub Copilot when no provider is given', async () => {
    const models = await listModels();
    expect(models).toEqual(['gpt-4.1', 'claude-sonnet']);
  });

  it('should fetch models from custom provider when provider is given', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'llama3' }, { id: 'mistral' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const models = await listModels({ baseUrl: 'http://localhost:11434/v1' });
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

    await listModels({ baseUrl: 'https://api.example.com/v1', apiKey: 'my-secret-key' });
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

    await expect(listModels({ baseUrl: 'https://api.example.com/v1', apiKey: 'bad-key' })).rejects.toThrow(
      'Failed to fetch models'
    );

    vi.unstubAllGlobals();
  });
});
