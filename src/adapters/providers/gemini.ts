import { BaseProvider } from './base.js';
import { GenerateOptions, LLMResponse, LLMError } from './types.js';

/**
 * Google Gemini Provider
 * API Docs: https://ai.google.dev/api/generate-content
 */
export class GeminiProvider extends BaseProvider {
  async generate(options: GenerateOptions): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${options.apiKey}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      systemInstruction: options.systemPrompt
        ? { role: 'user', parts: [{ text: options.systemPrompt }] }
        : undefined,
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new LLMError(
          response.status === 401 ? 'AUTHENTICATION_ERROR' :
          response.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR',
          `Gemini Error ${response.status}: ${JSON.stringify(errorData)}`,
          'gemini',
          errorData
        );
      }

      const data = await response.json();
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        },
      };
    } catch (error: any) {
      if (error instanceof LLMError) throw error;
      throw new LLMError('UNKNOWN_ERROR', error.message, 'gemini', error);
    }
  }

  async listModels(apiKey: string): Promise<string[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        'SERVER_ERROR',
        `Gemini Error ${response.status}: ${JSON.stringify(errorData)}`,
        'gemini',
        errorData
      );
    }

    const data = await response.json();
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));
  }
}
