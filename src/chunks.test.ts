import { describe, it, expect, vi } from 'vitest';
import { chunkText, chunkRawText } from './chunks.js';

describe('Chunks', () => {
  describe('chunkText', () => {
    it('should split text into chunks respecting maxChars', () => {
      const text = 'Paragraph 1.\n\nParagraph 2.';
      const chunks = chunkText(text, 20);
      // "Paragraph 1." is 12 chars.
      // "Paragraph 2." is 12 chars.
      // Total with \n\n is 26 chars.
      // Should be split into 2 chunks if maxChars is 20.
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Paragraph 1.');
      expect(chunks[1]).toBe('Paragraph 2.');
    });

    it('should split long paragraphs by sentences', () => {
      const sentence1 = 'This is a somewhat long sentence.';
      const sentence2 = 'This is another long sentence.';
      const paragraph = `${sentence1} ${sentence2}`;
      // Combined length > 40. Set maxChars to 40.
      const chunks = chunkText(paragraph, 40);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('This is a somewhat long sentence'); // Note: split removes delimiter
      expect(chunks[1]).toBe(sentence2);
    });

    it('should split incredibly long sentences by words', () => {
       const word = 'word';
       const longSentence = Array(10).fill(word).join(' '); // 9 spaces + 40 chars = 49 chars
       const chunks = chunkText(longSentence, 20);
       expect(chunks.length).toBeGreaterThan(1);
       expect(chunks.join(' ')).toBe(longSentence);
    });
    
    it('should return empty array for empty text', () => {
        expect(chunkText('')).toEqual([]);
    });
  });

  describe('chunkRawText', () => {
    it('should split raw text using LLM', async () => {
      const text = 'This is start. This is end. Next start.';
      // Mock callLLM
      const callLLM = vi.fn().mockResolvedValue('This is start. This is end.');
      
      // Use small window size (20) to force LLM call
      const chunks = await chunkRawText(text, callLLM, 'provider', 'key', 'model', 20);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(callLLM).toHaveBeenCalled();
    });

    it('should fallback if LLM fails', async () => {
        const text = 'word '.repeat(100);
        const callLLM = vi.fn().mockRejectedValue(new Error('LLM Error'));
        
        const chunks = await chunkRawText(text, callLLM, 'provider', 'key', 'model', 50);
        
        // Should fallback to space splitting
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].length).toBeLessThanOrEqual(50);
    });
  });
});
