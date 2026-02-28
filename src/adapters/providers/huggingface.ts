import { BaseProvider } from './base.js';
import { GenerateOptions, LLMResponse, LLMError } from './types.js';

/**
 * HuggingFace Provider
 * API Docs: https://huggingface.co/docs/api-inference/index
 */
export class HuggingFaceProvider extends BaseProvider {
  async generate(options: GenerateOptions): Promise<LLMResponse> {
    const url = `https://api-inference.huggingface.co/models/${options.model}`;

    const body = {
      inputs: options.prompt,
      parameters: {
        max_new_tokens: options.maxTokens,
        temperature: options.temperature,
        return_full_text: false,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorCode: any = 'SERVER_ERROR';
        if (response.status === 401) errorCode = 'AUTHENTICATION_ERROR';
        if (response.status === 429) errorCode = 'RATE_LIMIT';
        if (typeof errorData?.error === 'string' && errorData.error.includes('loading')) {
          errorCode = 'RATE_LIMIT';
        }
        throw new LLMError(
          errorCode,
          `HuggingFace Error ${response.status}: ${JSON.stringify(errorData)}`,
          'huggingface',
          errorData
        );
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        return { text: data[0]?.generated_text || '' };
      }
      if (data?.generated_text) {
        return { text: data.generated_text };
      }
      return { text: JSON.stringify(data) };
    } catch (error: any) {
      if (error instanceof LLMError) throw error;
      throw new LLMError('UNKNOWN_ERROR', error.message, 'huggingface', error);
    }
  }

  async listModels(apiKey: string): Promise<string[]> {
    const url = 'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=50';
    const headers: HeadersInit = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        'SERVER_ERROR',
        `HuggingFace Error ${response.status}: ${errorText}`,
        'huggingface'
      );
    }

    const data = await response.json();
    return (data || []).map((m: any) => m.id);
  }
}
