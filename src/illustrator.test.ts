import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichMarkdown } from './illustrator.js';
import type { LLMAdapter } from './adapters/types.js';
import * as chunks from './chunks.js';
import * as imageFinder from './image-finder.js';

function mockAdapter(responses: (string | null)[]): LLMAdapter {
  const call = vi.fn();
  responses.forEach(r => call.mockResolvedValueOnce(r));
  call.mockResolvedValue(null); // default
  return { call, listModels: vi.fn().mockResolvedValue([]) };
}

describe('Illustrator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should enrich markdown with diagrams', async () => {
    const markdown = 'Some text about a process.';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);

    const adapter = mockAdapter([
      'Some text <!-- DIAGRAM_GENERATE: "process flow" -->',
      '```text\n+---+\n|Box|\n+---+\n```',
    ]);

    const result = await enrichMarkdown(markdown, 'searchKey', 'cx', 'model', adapter, 'all');

    expect(result).toContain('+---+');
    expect(result).toContain('|Box|');
    expect(adapter.call).toHaveBeenCalledTimes(2);
  });

  it('should handle image search replacement', async () => {
    const markdown = 'Text with image <!-- IMAGE_SEARCH: "van gogh" -->';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);

    const adapter = mockAdapter([markdown]);

    vi.spyOn(imageFinder, 'callCustomSearch').mockResolvedValue({
      link: 'http://image.url',
      title: 'Starry Night',
    });

    const result = await enrichMarkdown(markdown, 'searchKey', 'cx', 'model', adapter);

    expect(result).toContain('![Starry Night](http://image.url)');
  });

  it('should handle missing search key', async () => {
    const markdown = 'Text <!-- IMAGE_SEARCH: "test" -->';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);

    const adapter = mockAdapter([markdown]);

    const result = await enrichMarkdown(markdown, '', '', 'model', adapter);

    expect(result).toContain('<!-- IMAGE_SEARCH: "test" -->');
  });

  it('should handle failed diagram generation', async () => {
    const markdown = '<!-- DIAGRAM_GENERATE: "fail" -->';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);

    const adapter = mockAdapter([markdown, null]);

    const result = await enrichMarkdown(markdown, 's', 'c', 'model', adapter);

    expect(result).toContain('Failed to generate diagram');
  });
});
