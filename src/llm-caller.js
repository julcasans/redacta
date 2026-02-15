import { CopilotClient } from "@github/copilot-sdk";

const STREAM_TIMEOUT_MS = 3 * 60 * 1000;
const STREAM_LOG_INTERVAL_MS = 2000;

export async function callLLM(
  systemPrompt,
  userPrompt,
  provider,
  apiKey,
  model,
  onUpdate
) {
  const client = new CopilotClient();
  let textResponse = null;
  try {
    await client.start();

    try {
      textResponse = await sendWithOptionalStreaming(client, {
        model,
        systemPrompt,
        userPrompt,
        timeoutMs: STREAM_TIMEOUT_MS,
        onUpdate
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

async function sendWithOptionalStreaming(client, { model, systemPrompt, userPrompt, timeoutMs, onUpdate }) {
  // 1) Try streaming first (faster feedback).
  try {
    return await sendOnce(client, { model, systemPrompt, userPrompt, timeoutMs, streaming: true, onUpdate });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isKnownPrematureStreamClose = message.includes('Stream completed without a response.completed event');
    if (!isKnownPrematureStreamClose) throw error;

    // 2) Fallback: retry without streaming.
    if (onUpdate) onUpdate('[callLLM] Streaming ended prematurely; retrying without streaming...');
    return await sendOnce(client, { model, systemPrompt, userPrompt, timeoutMs, streaming: false, onUpdate });
  }
}

async function sendOnce(client, { model, systemPrompt, userPrompt, timeoutMs, streaming, onUpdate }) {
  const session = await client.createSession({
    model,
    streaming,
    systemMessage: {
      content: systemPrompt,
      mode: 'replace'
    },
  });

  try {
    if (!streaming) {
      const finalEvent = await session.sendAndWait({ prompt: userPrompt }, timeoutMs);
      return finalEvent?.data?.content ?? null;
    }

    const streamController = waitForAssistantCompletion(session, timeoutMs, onUpdate);
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

function waitForAssistantCompletion(session, timeoutMs, onUpdate) {
  let resolvePromise;
  let rejectPromise;
  let settled = false;
  let timeoutId;
  let partialResponse = '';
  let lastLogTime = 0;

  const unsubscribers = [];

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

  const settleSuccess = (value) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise(value);
  };

  const settleFailure = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise(error);
  };

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    unsubscribers.push(
      session.on('assistant.message_delta', (event) => {
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
      session.on('assistant.message', (event) => {
        const content = event?.data?.content ?? partialResponse;
        if (onUpdate) onUpdate(`[callLLM] Streaming complete (${content.length} chars).`);
        settleSuccess(content);
      })
    );

    unsubscribers.push(
      session.on('session.error', (event) => {
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
      session.on('abort', (event) => {
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
    cancel: (error) => settleFailure(error ?? new Error('LLM session cancelled')),
  };
}