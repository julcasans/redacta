import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTranscript } from './editor.js';
import type { LLMAdapter } from './adapters/types.js';
import * as chunks from './chunks.js';

function mockAdapter(response: string | null): LLMAdapter {
  return {
    call: vi.fn().mockResolvedValue(response),
    listModels: vi.fn().mockResolvedValue([]),
  };
}

describe('Editor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should format transcript with punctuation', async () => {
    const transcript = 'Hello world. This is a test.';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([transcript]);

    const response = JSON.stringify({ text: '# Hello World\nThis is a test.', references: [] });
    const adapter = mockAdapter(response);

    const result = await formatTranscript(transcript, 'English', 'model', adapter);

    expect(result).toContain('# Hello World');
    expect(chunks.chunkText).toHaveBeenCalledWith(transcript);
    expect(adapter.call).toHaveBeenCalled();
  });

  it('should handle LLM errors gracefully', async () => {
    const transcript = 'Test.';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([transcript]);

    const adapter: LLMAdapter = {
      call: vi.fn().mockRejectedValue(new Error('LLM Fail')),
      listModels: vi.fn().mockResolvedValue([]),
    };

    const result = await formatTranscript(transcript, 'English', 'model', adapter);

    expect(result).toBe(transcript);
  });

  it('should deduplicate references', async () => {
    const transcript = 'Ref 1. Ref 2.';
    vi.spyOn(chunks, 'chunkText').mockReturnValue(['chunk1']);

    const response = JSON.stringify({
      text: 'Formatted text',
      references: [
        { title: 'Ref 1', url: 'http://ref1.com' },
        { title: 'Ref 1 Duplicate', url: 'http://ref1.com' },
        { title: 'Ref 2', url: 'http://ref2.com' },
      ],
    });
    const adapter = mockAdapter(response);

    const result = await formatTranscript(transcript, 'English', 'model', adapter);

    expect(result).toContain('http://ref1.com');
    expect(result).toContain('http://ref2.com');
  });
});
