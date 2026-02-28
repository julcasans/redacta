import { GenerateOptions, LLMResponse } from './types.js';

export interface IProvider {
  generate(options: GenerateOptions): Promise<LLMResponse>;
  listModels(apiKey: string): Promise<string[]>;
}

export abstract class BaseProvider implements IProvider {
  abstract generate(options: GenerateOptions): Promise<LLMResponse>;

  async listModels(_apiKey: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  protected getHeaders(_apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }
}
