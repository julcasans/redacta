import { BaseProvider } from './base.js';
import { GenerateOptions, LLMResponse, LLMError } from './types.js';

/**
 * OpenAI Provider
 * API Docs: https://platform.openai.com/docs/api-reference/chat/create
 */
export class OpenAIProvider extends BaseProvider {
  async generate(options: GenerateOptions): Promise<LLMResponse> {
    const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const body = {
      model: options.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: options.prompt },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature ?? 0.7,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(options.apiKey),
          'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new LLMError(
          response.status === 401 ? 'AUTHENTICATION_ERROR' :
          response.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR',
          `OpenAI Error ${response.status}: ${JSON.stringify(errorData)}`,
          'openai',
          errorData
        );
      }

      const data = await response.json();
      return {
        text: data.choices[0]?.message?.content || '',
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
      };
    } catch (error: any) {
      if (error instanceof LLMError) throw error;
      throw new LLMError('UNKNOWN_ERROR', error.message, 'openai', error);
    }
  }

  async listModels(apiKey: string): Promise<string[]> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        'SERVER_ERROR',
        `OpenAI Error ${response.status}: ${JSON.stringify(errorData)}`,
        'openai',
        errorData
      );
    }

    const data = await response.json();
    return (data.data || [])
      .map((m: any) => m.id)
      .filter((id: string) => id.includes('gpt'));
  }
}
