import { describe, it, expect } from 'vitest';
import {
  languageInstruction,
  editorSystemPrompt,
  editorPromptTemplate,
  illustratorSystemPrompt,
  illustratorPromptTemplate,
  sketcherSystemPrompt,
  sketcherPromptTemplate,
  summarizerSystemPrompt,
  preSummarizerPromptTemplate,
  summarizerPromptTemplate,
  blogWriterSystemPrompt,
  blogWriterPromptTemplate,
} from './prompts.js';

describe('Prompts', () => {
  describe('languageInstruction', () => {
    it('should return valid instruction for null language', () => {
      const result = languageInstruction(null);
      expect(result).toContain('Do NOT translate');
      expect(result).toContain('same language as the input');
    });

    it('should return valid instruction for specific language', () => {
      const result = languageInstruction('Spanish');
      expect(result).toContain('MUST be in Spanish');
      expect(result).toContain('Translate the content if necessary');
    });
  });

  describe('Editor Prompts', () => {
    it('should return correct system prompt', () => {
      expect(editorSystemPrompt()).toBe('You are an expert editor.');
    });

    it('should return correct template with language and segment', () => {
      const segment = 'This is a test segment.';
      const result = editorPromptTemplate('English', segment);
      expect(result).toContain('You are an expert editor');
      expect(result).toContain(segment);
      expect(result).toContain('MUST be in English'); // valid language instruction
      expect(result).toContain('"references":'); // Checks for JSON structure instruction
    });
  });

  describe('Illustrator Prompts', () => {
    it('should return correct system prompt', () => {
      expect(illustratorSystemPrompt()).toBe('You are an expert editor enriching a document with visual content.');
    });

    it('should return correct template for essential mode', () => {
      const result = illustratorPromptTemplate('some text', 'essential');
      expect(result).toContain('truly essential');
      expect(result).toContain('IMAGE_SEARCH');
    });

    it('should return correct template for all mode', () => {
      const result = illustratorPromptTemplate('some text', 'all');
      expect(result).toContain('Add diagrams and visualizations wherever they could help');
    });
  });

  describe('Sketcher Prompts', () => {
    it('should return correct system prompt', () => {
        expect(sketcherSystemPrompt()).toBe('You are an expert at creating ASCII art diagrams.');
    });
    it('should return correct template', () => {
        const result = sketcherPromptTemplate('A flow chart');
        expect(result).toContain('A flow chart');
        expect(result).toContain('ASCII diagram');
    });
  });

  describe('Summarizer Prompts', () => {
      it('should return correct system prompt', () => {
          expect(summarizerSystemPrompt()).toBe('You are an expert summarizer.');
      });

      it('should return correct pre-summarizer template', () => {
          const result = preSummarizerPromptTemplate('English', 'text to summarize');
          expect(result).toContain('text to summarize');
          expect(result).toContain('concise and straight to the point');
      });

      it('should return correct summarizer template', () => {
        const result = summarizerPromptTemplate('English', 'text');
        expect(result).toContain('Input:');
        expect(result).toContain('text');
        expect(result).toContain('## <abstract');
      });
  });

  describe('Blog Writer Prompts', () => {
      it('should return correct system prompt', () => {
          expect(blogWriterSystemPrompt()).toBe('You are an expert blog writer.');
      });

      it('should return correct template', () => {
          const result = blogWriterPromptTemplate('English', 'transcript content', 'middle');
          expect(result).toContain('transcript content');
          expect(result).toContain('Current Position: middle');
          expect(result).toContain('engaging, well-structured blog post');
      });
  });
});
