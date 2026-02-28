import { LLMAdapter } from './types.js';
import { generateText, listModels, LLMProvider } from './providers/index.js';

export type FetchProvider = LLMProvider;

export interface FetchClientConfig {
  /** Provider type: openai, gemini, anthropic, or huggingface */
  provider: FetchProvider;
  /** API key for the chosen provider */
  apiKey: string;
  /** Optional custom base URL for OpenAI-compatible endpoints (e.g. Azure, Ollama) */
  baseUrl?: string;
}

/**
 * Create a browser-safe LLM adapter using direct fetch calls.
 * Supports OpenAI, Gemini, Anthropic, and HuggingFace.
 * Has zero Node.js dependencies — works in browsers and Chrome extensions.
 *
 * @example
 * const adapter = createFetchClient({ provider: 'openai', apiKey: 'sk-...' });
 * const result = await adapter.call(systemPrompt, userPrompt, 'gpt-4o');
 */
export function createFetchClient(config: FetchClientConfig): LLMAdapter {
  return {
    async call(systemPrompt, userPrompt, model, onUpdate) {
      onUpdate?.(`[fetchClient] Calling ${config.provider} model ${model}...`);
      const text = await generateText({
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model,
        systemPrompt,
        prompt: userPrompt,
      });
      onUpdate?.(`[fetchClient] Response received (${text.length} chars).`);
      return text || null;
    },

    async listModels() {
      return listModels(config.provider, config.apiKey);
    },
  };
}
