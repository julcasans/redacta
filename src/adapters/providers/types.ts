// NOTE: This file is inlined from easy-llm-text for browser compatibility.
// To extract to a package later, replace imports of './providers/*' in fetch-client.ts
// with 'easy-llm-text' and delete this directory.

export type LLMProvider = 'openai' | 'gemini' | 'anthropic' | 'huggingface';

export interface GenerateOptions {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type LLMErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR';

export class LLMError extends Error {
  public code: LLMErrorCode;
  public provider: LLMProvider;
  public originalError?: any;

  constructor(code: LLMErrorCode, message: string, provider: LLMProvider, originalError?: any) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.provider = provider;
    this.originalError = originalError;
  }
}
