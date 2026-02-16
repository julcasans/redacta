import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM } from './llm-caller.js';
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
