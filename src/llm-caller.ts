import { CopilotClient } from "@github/copilot-sdk";

const STREAM_TIMEOUT_MS = 3 * 60 * 1000;
const STREAM_LOG_INTERVAL_MS = 2000;

/**
 * Configuration for a custom (BYOK/BYOM) LLM provider.
 * Mirrors the SDK's ProviderConfig; see https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md
 */
export interface LLMProviderConfig {
  /** Provider type. The SDK supports "openai" (default), "azure", and "anthropic". */
  type?: 'openai' | 'azure' | 'anthropic';
  /** API endpoint base URL (e.g. "https://my-resource.openai.azure.com"). */
  baseUrl: string;
  /** API key. Optional for local providers such as Ollama. */
  apiKey?: string;
  /** API wire format (openai/azure only). The SDK defaults to "completions" when not set. */
  wireApi?: 'completions' | 'responses';
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  provider?: LLMProviderConfig,
  onUpdate?: (msg: string) => void
): Promise<string | null> {
  const client = new CopilotClient();
  let textResponse: string | null = null;
  try {
    await client.start();

    try {
      textResponse = await sendWithOptionalStreaming(client, {
        model,
        systemPrompt,
        userPrompt,
        timeoutMs: STREAM_TIMEOUT_MS,
        onUpdate,
        provider,
      });
    } catch (e) {
      console.error('LLM Call Error', e);
      throw e;
    }
  } finally {
    await client.stop();
  }
  return textResponse;
}

/**
 * List available models.
 *
 * When a custom provider is given, fetches the model list from that
 * OpenAI-compatible endpoint (GET <baseUrl>/models).
 * Otherwise, delegates to the GitHub Copilot CLI via CopilotClient.
 */
export async function listModels(provider?: LLMProviderConfig): Promise<string[]> {
  if (provider) {
    const url = `${provider.baseUrl.replace(/\/$/, '')}/models`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${url}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id);
  }

  const client = new CopilotClient();
  await client.start();
  const models = await client.listModels();
  await client.stop();
  return models.map((m) => m.id);
}

interface SendOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  onUpdate?: (msg: string) => void;
  streaming?: boolean;
  provider?: LLMProviderConfig;
}

async function sendWithOptionalStreaming(client: CopilotClient, { model, systemPrompt, userPrompt, timeoutMs, onUpdate, provider }: SendOptions): Promise<string | null> {
  // 1) Try streaming first (faster feedback).
  try {
    return await sendOnce(client, { model, systemPrompt, userPrompt, timeoutMs, streaming: true, onUpdate, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isKnownPrematureStreamClose = message.includes('Stream completed without a response.completed event');
    if (!isKnownPrematureStreamClose) throw error;

    // 2) Fallback: retry without streaming.
    if (onUpdate) onUpdate('[callLLM] Streaming ended prematurely; retrying without streaming...');
    return await sendOnce(client, { model, systemPrompt, userPrompt, timeoutMs, streaming: false, onUpdate, provider });
  }
}

async function sendOnce(client: CopilotClient, { model, systemPrompt, userPrompt, timeoutMs, streaming, onUpdate, provider }: SendOptions): Promise<string | null> {
  const session = await client.createSession({
    model,
    streaming,
    systemMessage: {
      content: systemPrompt,
      mode: 'replace'
    },
    ...(provider ? { provider } : {}),
  });

  try {
    if (!streaming) {
      const finalEvent = await session.sendAndWait({ prompt: userPrompt }, timeoutMs);
      return finalEvent?.data?.content ?? null;
    }

    const streamController = waitForAssistantCompletion(session, timeoutMs, onUpdate);
    // Suppress unhandled rejection if session.send fails and we don't await the promise
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
  let timeoutId: NodeJS.Timeout | undefined;
  let partialResponse = '';
  let lastLogTime = 0;

  const unsubscribers: (() => void)[] = [];

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    while (unsubscribers.length) {
      const unsubscribe = unsubscribers.pop();
      if (typeof unsubscribe === 'function') unsubscribe();
    }
  };

  const settleSuccess = (value: string | null) => {
    if (settled) return;
    settled = true;
    cleanup();
    if (resolvePromise) resolvePromise(value);
  };

  const settleFailure = (error: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    if (rejectPromise) rejectPromise(error);
  };

  const promise = new Promise<string | null>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    unsubscribers.push(
      session.on('assistant.message_delta', (event: any) => {
        const delta = event?.data?.deltaContent ?? '';
        if (!delta) return;
        partialResponse += delta;
        const now = Date.now();
        if (!lastLogTime || now - lastLogTime >= STREAM_LOG_INTERVAL_MS) {
          if (onUpdate) onUpdate(`[callLLM] Streaming response... (${partialResponse.length} chars)`);
          lastLogTime = now;
        }
      })
    );

    unsubscribers.push(
      session.on('assistant.message', (event: any) => {
        const content = event?.data?.content ?? partialResponse;
        if (onUpdate) onUpdate(`[callLLM] Streaming complete (${content.length} chars).`);
        settleSuccess(content);
      })
    );

    unsubscribers.push(
      session.on('session.error', (event: any) => {
        const message = event?.data?.message ?? 'LLM session error';
        const isKnownPrematureStreamClose = message.includes('Stream completed without a response.completed event');
        if (isKnownPrematureStreamClose && partialResponse.length > 0) {
          if (onUpdate) onUpdate('[callLLM] Received session.error after partial stream; returning partial response.');
          settleSuccess(partialResponse);
          return;
        }
        const error = new Error(message);
        if (event?.data?.stack) error.stack = event.data.stack;
        settleFailure(error);
      })
    );

    unsubscribers.push(
      session.on('abort', (event: any) => {
        const message = event?.data?.reason ?? 'LLM session aborted';
        const isKnownPrematureStreamClose = message.includes('Stream completed without a response.completed event');
        if (isKnownPrematureStreamClose && partialResponse.length > 0) {
          if (onUpdate) onUpdate('[callLLM] Received abort after partial stream; returning partial response.');
          settleSuccess(partialResponse);
          return;
        }
        settleFailure(new Error(message));
      })
    );

    unsubscribers.push(
      session.on('session.idle', () => {
        // Some backends may not emit assistant.message, but do become idle.
        if (partialResponse.length > 0) {
          if (onUpdate) onUpdate(`[callLLM] Session idle (${partialResponse.length} chars).`);
          settleSuccess(partialResponse);
        }
      })
    );

    timeoutId = setTimeout(() => {
      settleFailure(new Error(`Timeout after ${timeoutMs}ms waiting for assistant response`));
    }, timeoutMs);
  });

  return {
    promise,
    cancel: (error?: Error) => settleFailure(error ?? new Error('LLM session cancelled')),
  };
}