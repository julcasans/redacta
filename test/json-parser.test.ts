import { describe, it, expect } from 'vitest';
import { parseLLMResponse } from '../src/json-parser';

describe('parseLLMResponse', () => {
  it('should parse valid JSON correctly', () => {
    const validJson = JSON.stringify({
      text: 'This is a test',
      references: [{ title: 'Test', url: 'https://example.com' }]
    });
    
    const result = parseLLMResponse(validJson);
    expect(result.text).toBe('This is a test');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].title).toBe('Test');
  });

  it('should handle text with escaped quotes', () => {
    const jsonWithEscapedQuotes = '{"text": "He said \\"hello\\" to me", "references": []}';
    
    const result = parseLLMResponse(jsonWithEscapedQuotes);
    expect(result.text).toBe('He said "hello" to me');
    expect(result.references).toHaveLength(0);
  });

  it('should handle text with LaTeX notation', () => {
    const jsonWithLatex = '{"text": "The formula is $E = mc^2$ and $\\\\frac{1}{2}$", "references": []}';
    
    const result = parseLLMResponse(jsonWithLatex);
    expect(result.text).toContain('$E = mc^2$');
    expect(result.references).toHaveLength(0);
  });

  it('should handle text with newlines', () => {
    const jsonWithNewlines = '{"text": "Line 1\\nLine 2\\nLine 3", "references": []}';
    
    const result = parseLLMResponse(jsonWithNewlines);
    expect(result.text).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should handle text with HTML/CSS', () => {
    const jsonWithHtml = '{"text": "Use <div class=\\"container\\">content</div> for layout", "references": []}';
    
    const result = parseLLMResponse(jsonWithHtml);
    expect(result.text).toContain('<div class="container">');
  });

  it('should handle multiple references', () => {
    const jsonWithRefs = JSON.stringify({
      text: 'Check these resources',
      references: [
        { title: 'Ref 1', url: 'https://example1.com' },
        { title: 'Ref 2', url: 'https://example2.com' }
      ]
    });
    
    const result = parseLLMResponse(jsonWithRefs);
    expect(result.references).toHaveLength(2);
  });

  it('should handle malformed JSON with manual parsing fallback', () => {
    // This is a case where standard JSON.parse would fail but our parser should handle it
    const malformedJson = '{"text": "This has an unescaped " quote in the middle", "references": []}';
    
    // This should either parse successfully or throw a clear error
    // The exact behavior depends on the regex matching
    expect(() => parseLLMResponse(malformedJson)).not.toThrow();
  });

  it('should return empty references array when none provided', () => {
    const jsonNoRefs = '{"text": "Just text", "references": []}';
    
    const result = parseLLMResponse(jsonNoRefs);
    expect(result.references).toEqual([]);
  });
});
