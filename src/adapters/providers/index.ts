// NOTE: To extract providers to a package later, replace this entire directory with
// `import { createProvider, generateText, listModels } from 'easy-llm-text';`

import { LLMProvider, LLMError, GenerateOptions } from './types.js';
import { IProvider } from './base.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { AnthropicProvider } from './anthropic.js';
import { HuggingFaceProvider } from './huggingface.js';

export * from './types.js';
export * from './base.js';

export function createProvider(providerType: LLMProvider): IProvider {
  switch (providerType) {
    case 'openai':      return new OpenAIProvider();
    case 'gemini':      return new GeminiProvider();
    case 'anthropic':   return new AnthropicProvider();
    case 'huggingface': return new HuggingFaceProvider();
    default:
      throw new LLMError('INVALID_REQUEST', `Provider ${providerType} not supported`, providerType as LLMProvider);
  }
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const provider = createProvider(options.provider);
  const response = await provider.generate(options);
  return response.text;
}

export async function listModels(providerType: LLMProvider, apiKey: string): Promise<string[]> {
  const provider = createProvider(providerType);
  return provider.listModels(apiKey);
}
