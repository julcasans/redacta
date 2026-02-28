import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock – must be declared before any import that resolves @github/copilot-sdk.
const { MockCopilotClient } = vi.hoisted(() => {
  const MockCopilotClient = vi.fn();
  return { MockCopilotClient };
});

vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: MockCopilotClient,
}));

import { createCopilotClient } from './copilot-client.js';

// ── test helpers ──────────────────────────────────────────────────────────────

/** Create a minimal mock session that supports event subscriptions. */
function makeSession() {
  const handlers: Record<string, Array<(e: any) => void>> = {};
  const session = {
    on: vi.fn((event: string, handler: (e: any) => void) => {
      (handlers[event] ??= []).push(handler);
      return () => {
        handlers[event] = handlers[event].filter((h) => h !== handler);
      };
    }),
    send: vi.fn().mockResolvedValue(undefined),
    sendAndWait: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
    /** Synchronously fire an event at all registered listeners. */
    emit(event: string, data?: any) {
      handlers[event]?.forEach((h) => h(data));
    },
  };
  return session;
}

/** Create a mock CopilotClient instance backed by the given session. */
function makeClient(session: ReturnType<typeof makeSession>) {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(session),
    listModels: vi.fn().mockResolvedValue([{ id: 'gpt-4o' }, { id: 'gpt-4.1' }]),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('copilot-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── session lifecycle ─────────────────────────────────────────────────────

  describe('session lifecycle – call()', () => {
    it('calls client.start() before and client.stop() after a successful streaming call', async () => {
      const session = makeSession();
      const sdkClient = makeClient(session);
      MockCopilotClient.mockImplementation(function () { return sdkClient; });

      // After send() resolves, fire the assistant.message event so the stream settles.
      session.send.mockImplementation(async () => {
        await Promise.resolve();
        session.emit('assistant.message', { data: { content: 'Hello' } });
      });

      const adapter = await createCopilotClient();
      await adapter.call('sys', 'user', 'gpt-4o');

      expect(sdkClient.start).toHaveBeenCalledOnce();
      expect(sdkClient.stop).toHaveBeenCalledOnce();
      expect(sdkClient.start.mock.invocationCallOrder[0]).toBeLessThan(
        sdkClient.stop.mock.invocationCallOrder[0],
      );
    });

    it('calls client.stop() even when the LLM call throws', async () => {
      const session = makeSession();
      const sdkClient = makeClient(session);
      MockCopilotClient.mockImplementation(function () { return sdkClient; });

      // A non-retryable error so sendWithOptionalStreaming re-throws immediately.
      session.send.mockRejectedValue(new Error('network error'));

      const adapter = await createCopilotClient();
      await expect(adapter.call('sys', 'user', 'gpt-4o')).rejects.toThrow('network error');

      expect(sdkClient.stop).toHaveBeenCalledOnce();
    });
  });

  // ── retry-without-streaming path ──────────────────────────────────────────

  describe('retry-without-streaming', () => {
    const PREMATURE_CLOSE = 'Stream completed without a response.completed event';

    it('falls back to non-streaming when the streaming session closes prematurely', async () => {
      const session = makeSession();
      const sdkClient = makeClient(session);
      MockCopilotClient.mockImplementation(function () { return sdkClient; });

      // First createSession → streaming attempt that fails with the known message.
      // Second createSession → non-streaming fallback succeeds.
      sdkClient.createSession
        .mockResolvedValueOnce({
          ...session,
          send: vi.fn().mockRejectedValue(new Error(PREMATURE_CLOSE)),
          destroy: vi.fn().mockResolvedValue(undefined),
        })
        .mockResolvedValueOnce({
          ...session,
          sendAndWait: vi
            .fn()
            .mockResolvedValue({ data: { content: 'fallback response' } }),
          destroy: vi.fn().mockResolvedValue(undefined),
        });

      const onUpdate = vi.fn();
      const adapter = await createCopilotClient();
      const result = await adapter.call('sys', 'user', 'gpt-4o', onUpdate);

      expect(result).toBe('fallback response');
      expect(sdkClient.createSession).toHaveBeenCalledTimes(2);
      // Confirm the first attempt used streaming and the retry did not.
      expect(sdkClient.createSession.mock.calls[0][0]).toMatchObject({ streaming: true });
      expect(sdkClient.createSession.mock.calls[1][0]).toMatchObject({ streaming: false });
      expect(onUpdate).toHaveBeenCalledWith(expect.stringContaining('retrying without streaming'));
    });

    it('does NOT retry for unrelated errors', async () => {
      const session = makeSession();
      const sdkClient = makeClient(session);
      MockCopilotClient.mockImplementation(function () { return sdkClient; });

      session.send.mockRejectedValue(new Error('some unrelated network error'));

      const adapter = await createCopilotClient();
      await expect(adapter.call('sys', 'user', 'gpt-4o')).rejects.toThrow(
        'some unrelated network error',
      );
      // Only one createSession call – no retry.
      expect(sdkClient.createSession).toHaveBeenCalledTimes(1);
    });
  });

  // ── BYOK listModels ───────────────────────────────────────────────────────

  describe('listModels() – BYOK provider', () => {
    it('fetches models from the provider base URL with the Authorization header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-a' }, { id: 'model-b' }] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const adapter = await createCopilotClient({
          provider: { baseUrl: 'https://my.provider.com', apiKey: 'secret' },
        });
        const models = await adapter.listModels();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://my.provider.com/models',
          expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
          }),
        );
        expect(models).toEqual(['model-a', 'model-b']);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('strips a trailing slash from the provider base URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-x' }] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const adapter = await createCopilotClient({
          provider: { baseUrl: 'https://my.provider.com/', apiKey: 'k' },
        });
        await adapter.listModels();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://my.provider.com/models',
          expect.anything(),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('throws when the provider returns a non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      try {
        const adapter = await createCopilotClient({
          provider: { baseUrl: 'https://my.provider.com', apiKey: 'secret' },
        });
        await expect(adapter.listModels()).rejects.toThrow('Failed to fetch models: 401');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('aborts the fetch request after the 30-second timeout', async () => {
      vi.useFakeTimers();

      let capturedSignal: AbortSignal | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
          capturedSignal = opts.signal as AbortSignal;
          return new Promise(() => {}); // never resolves – simulates a hung request
        }),
      );

      try {
        const adapter = await createCopilotClient({
          provider: { baseUrl: 'https://my.provider.com', apiKey: 'key' },
        });

        // Start without awaiting so we can advance timers while it's pending.
        const listModelsPromise = adapter.listModels();
        void listModelsPromise; // intentionally not awaited – the request hangs forever

        // Flush the pending microtasks (await import + fetch setup inside listModels).
        await Promise.resolve();
        await Promise.resolve();

        // Advance past the 30-second timeout.
        await vi.advanceTimersByTimeAsync(30_001);

        expect(capturedSignal?.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
      }
    });
  });

  // ── GitHub Copilot listModels (no provider) ───────────────────────────────

  describe('listModels() – GitHub Copilot models', () => {
    it('lists models via CopilotClient and maps ids', async () => {
      const sdkClient = {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        listModels: vi.fn().mockResolvedValue([{ id: 'gpt-4o' }, { id: 'claude-3.7' }]),
        createSession: vi.fn(),
      };
      MockCopilotClient.mockImplementation(function () { return sdkClient; });

      const adapter = await createCopilotClient();
      const models = await adapter.listModels();

      expect(models).toEqual(['gpt-4o', 'claude-3.7']);
      expect(sdkClient.start).toHaveBeenCalledOnce();
      expect(sdkClient.stop).toHaveBeenCalledOnce();
    });

    it('calls client.stop() even when listModels throws', async () => {
      const sdkClient = {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        listModels: vi.fn().mockRejectedValue(new Error('SDK error')),
        createSession: vi.fn(),
      };
      MockCopilotClient.mockImplementation(function () { return sdkClient; });

      const adapter = await createCopilotClient();
      await expect(adapter.listModels()).rejects.toThrow('SDK error');

      expect(sdkClient.stop).toHaveBeenCalledOnce();
    });
  });
});
