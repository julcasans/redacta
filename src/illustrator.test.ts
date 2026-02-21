import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichMarkdown } from './illustrator.js';
import * as llmCaller from './llm-caller.js';
import * as chunks from './chunks.js';
import * as imageFinder from './image-finder.js';

describe('Illustrator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should enrich markdown with diagrams and images', async () => {
    const markdown = 'Some text about a process.';
    
    // Mock chunks
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);
    
    // Mock LLM to return a diagram tag
    const llmResponse = 'Some text <!-- DIAGRAM_GENERATE: "process flow" -->';
    vi.spyOn(llmCaller, 'callLLM').mockImplementation(async (sys, user) => {
        if (user.includes('enriching')) return llmResponse;
        if (user.includes('ASCII')) return '```text\n+---+\n|Box|\n+---+\n```';
        return null;
    });

    const result = await enrichMarkdown(markdown, 'searchKey', 'cx', 'model', undefined, 'all');
    
    expect(result).toContain('+---+');
    expect(result).toContain('|Box|');
    expect(llmCaller.callLLM).toHaveBeenCalledTimes(2); // Once for enrich, once for diagram
  });

  it('should handle image search replacement', async () => {
    const markdown = 'Text with image <!-- IMAGE_SEARCH: "van gogh" -->';
    
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);
    
    // Mock LLM to return text with image tag preserved (or added)
    // Actually enrichMarkdown calls LLM first to *add* tags, then processes them.
    // If input already has tags, enrichMarkdown splits it, calls LLM to "enrich".
    // If LLM returns text with tags, they are processed.
    
    vi.spyOn(llmCaller, 'callLLM').mockResolvedValue(markdown); // LLM returns same text
    
    vi.spyOn(imageFinder, 'callCustomSearch').mockResolvedValue({
        link: 'http://image.url',
        title: 'Starry Night'
    });

    const result = await enrichMarkdown(markdown, 'searchKey', 'cx', 'model');
    
    expect(result).toContain('![Starry Night](http://image.url)');
  });

  it('should handle missing search key', async () => {
    const markdown = 'Text <!-- IMAGE_SEARCH: "test" -->';
    vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);
    vi.spyOn(llmCaller, 'callLLM').mockResolvedValue(markdown);
    
    // Pass empty search key
    const result = await enrichMarkdown(markdown, '', '', 'model');
    
    // Should return text as is (with tags)
    expect(result).toContain('<!-- IMAGE_SEARCH: "test" -->');
  });
  
  it('should handle failed diagram generation', async () => {
      const markdown = '<!-- DIAGRAM_GENERATE: "fail" -->';
      vi.spyOn(chunks, 'chunkText').mockReturnValue([markdown]);
      // First LLM call returns the markdown with the tag
      vi.spyOn(llmCaller, 'callLLM')
        .mockResolvedValueOnce(markdown) // Enrich step
        .mockResolvedValueOnce(null); // Diagram step fails

      const result = await enrichMarkdown(markdown, 's', 'c', 'm');
      expect(result).toContain('Failed to generate diagram');
  });
});
