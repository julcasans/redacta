import { BaseProvider } from './base.js';
import { GenerateOptions, LLMResponse, LLMError } from './types.js';

/**
 * Anthropic Provider
 * API Docs: https://docs.anthropic.com/en/api/messages
 */
export class AnthropicProvider extends BaseProvider {
  async generate(options: GenerateOptions): Promise<LLMResponse> {
    const url = 'https://api.anthropic.com/v1/messages';

    const body = {
      model: options.model,
      messages: [{ role: 'user', content: options.prompt }],
      system: options.systemPrompt,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new LLMError(
          response.status === 401 ? 'AUTHENTICATION_ERROR' :
          response.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR',
          `Anthropic Error ${response.status}: ${JSON.stringify(errorData)}`,
          'anthropic',
          errorData
        );
      }

      const data = await response.json();
      return {
        text: data.content[0]?.text || '',
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
        },
      };
    } catch (error: any) {
      if (error instanceof LLMError) throw error;
      throw new LLMError('UNKNOWN_ERROR', error.message, 'anthropic', error);
    }
  }

  async listModels(_apiKey: string): Promise<string[]> {
    // Anthropic does not expose a list-models API; returning a curated list.
    return [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
    ];
  }
}
