import { LLMAdapter } from './types.js';

const STREAM_TIMEOUT_MS = 3 * 60 * 1000;
const STREAM_LOG_INTERVAL_MS = 2000;

/**
 * Configuration for a custom (BYOK/BYOM) LLM provider via copilot-sdk.
 * See https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md
 */
export interface CopilotProviderConfig {
  /** Provider type. The SDK supports "openai" (default), "azure", and "anthropic". */
  type?: 'openai' | 'azure' | 'anthropic';
  /** API endpoint base URL (e.g. "https://my-resource.openai.azure.com"). */
  baseUrl: string;
  /** API key. Optional for local providers such as Ollama. */
  apiKey?: string;
  /** API wire format (openai/azure only). Defaults to "completions". */
  wireApi?: 'completions' | 'responses';
}

export interface CopilotClientConfig {
  /** Optional BYOK/BYOM provider. Omit to use GitHub Copilot's own models. */
  provider?: CopilotProviderConfig;
}

/**
 * Create a Node.js LLM adapter backed by @github/copilot-sdk.
 *
 * Uses a dynamic import so bundlers targeting browsers cannot statically
 * analyse @github/copilot-sdk and its Node.js-only dependencies.
 *
 * @example
 * const adapter = await createCopilotClient();
 * const result = await adapter.call(systemPrompt, userPrompt, 'gpt-4o');
 */
export async function createCopilotClient(config?: CopilotClientConfig): Promise<LLMAdapter> {
  // Dynamic import keeps @github/copilot-sdk out of browser bundles.
  const { CopilotClient } = await import('@github/copilot-sdk');

  return {
    async call(systemPrompt, userPrompt, model, onUpdate) {
      const client = new CopilotClient();
      try {
        await client.start();
        return await sendWithOptionalStreaming(client, {
          model,
          systemPrompt,
          userPrompt,
          timeoutMs: STREAM_TIMEOUT_MS,
          onUpdate,
          provider: config?.provider,
        });
      } catch (e) {
        console.error('LLM Call Error', e);
        throw e;
      } finally {
        await client.stop();
      }
    },

    async listModels() {
      const { CopilotClient } = await import('@github/copilot-sdk');
      if (config?.provider) {
        const url = `${config.provider.baseUrl.replace(/\/$/, '')}/models`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.provider.apiKey) headers['Authorization'] = `Bearer ${config.provider.apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);
        try {
          const response = await fetch(url, { headers, signal: controller.signal });
          if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`);
          const data = await response.json() as { data?: Array<{ id: string }> };
          return (data.data ?? []).map((m) => m.id);
        } finally {
          clearTimeout(timeoutId);
        }
      }
      const client = new CopilotClient();
      try {
        await client.start();
        const models = await client.listModels();
        return models.map((m: any) => m.id);
      } finally {
        await client.stop();
      }
    },
  };
}

// ── Internal streaming helpers (extracted from llm-caller.ts) ────────────────

interface SendOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  onUpdate?: (msg: string) => void;
  streaming?: boolean;
  provider?: CopilotProviderConfig;
}

async function sendWithOptionalStreaming(client: any, opts: SendOptions): Promise<string | null> {
  try {
    return await sendOnce(client, { ...opts, streaming: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isKnownPrematureClose = message.includes('Stream completed without a response.completed event');
    if (!isKnownPrematureClose) throw error;
    if (opts.onUpdate) opts.onUpdate('[copilotClient] Streaming ended prematurely; retrying without streaming...');
    return await sendOnce(client, { ...opts, streaming: false });
  }
}

async function sendOnce(client: any, { model, systemPrompt, userPrompt, timeoutMs, streaming, onUpdate, provider }: SendOptions): Promise<string | null> {
  const session = await client.createSession({
    model,
    streaming,
    systemMessage: { content: systemPrompt, mode: 'replace' },
    ...(provider ? { provider } : {}),
  });

  try {
    if (!streaming) {
      const finalEvent = await session.sendAndWait({ prompt: userPrompt }, timeoutMs);
      return finalEvent?.data?.content ?? null;
    }

    const streamController = waitForAssistantCompletion(session, timeoutMs, onUpdate);
    streamController.promise.catch(() => {});
    try {
      await session.send({ prompt: userPrompt });
    } catch (sendError) {
      streamController.cancel(sendError instanceof Error ? sendError : new Error(String(sendError)));
      throw sendError;
    }
    return await streamController.promise;
  } finally {
    await session.destroy();
  }
}

function waitForAssistantCompletion(session: any, timeoutMs: number, onUpdate?: (msg: string) => void) {
  let resolvePromise: (value: string | null) => void;
  let rejectPromise: (reason?: any) => void;
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let partialResponse = '';
  let lastLogTime = 0;
  const unsubscribers: (() => void)[] = [];

  const cleanup = () => {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = undefined; }
    while (unsubscribers.length) unsubscribers.pop()?.();
  };

  const settleSuccess = (value: string | null) => {
    if (settled) return; settled = true; cleanup(); resolvePromise(value);
  };
  const settleFailure = (error: Error) => {
    if (settled) return; settled = true; cleanup(); rejectPromise(error);
  };

  const promise = new Promise<string | null>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    unsubscribers.push(session.on('assistant.message_delta', (event: any) => {
      const delta = event?.data?.deltaContent ?? '';
      if (!delta) return;
      partialResponse += delta;
      const now = Date.now();
      if (!lastLogTime || now - lastLogTime >= STREAM_LOG_INTERVAL_MS) {
        onUpdate?.(`[copilotClient] Streaming... (${partialResponse.length} chars)`);
        lastLogTime = now;
      }
    }));

    unsubscribers.push(session.on('assistant.message', (event: any) => {
      const content = event?.data?.content ?? partialResponse;
      onUpdate?.(`[copilotClient] Streaming complete (${content.length} chars).`);
      settleSuccess(content);
    }));

    unsubscribers.push(session.on('session.error', (event: any) => {
      const message = event?.data?.message ?? 'LLM session error';
      if (message.includes('Stream completed without a response.completed event') && partialResponse.length > 0) {
        onUpdate?.('[copilotClient] session.error after partial stream; returning partial response.');
        settleSuccess(partialResponse);
        return;
      }
      const error = new Error(message);
      if (event?.data?.stack) error.stack = event.data.stack;
      settleFailure(error);
    }));

    unsubscribers.push(session.on('abort', (event: any) => {
      const message = event?.data?.reason ?? 'LLM session aborted';
      if (message.includes('Stream completed without a response.completed event') && partialResponse.length > 0) {
        onUpdate?.('[copilotClient] abort after partial stream; returning partial response.');
        settleSuccess(partialResponse);
        return;
      }
      settleFailure(new Error(message));
    }));

    unsubscribers.push(session.on('session.idle', () => {
      if (partialResponse.length > 0) {
        onUpdate?.(`[copilotClient] Session idle (${partialResponse.length} chars).`);
        settleSuccess(partialResponse);
      }
    }));

    timeoutId = setTimeout(() => {
      settleFailure(new Error(`Timeout after ${timeoutMs}ms waiting for assistant response`));
    }, timeoutMs);
  });

  return {
    promise,
    cancel: (error?: Error) => settleFailure(error ?? new Error('LLM session cancelled')),
  };
}
