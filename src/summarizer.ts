import { LLMAdapter } from './adapters/types.js';
import { chunkText } from './chunks.js';
import {
  preSummarizerPromptTemplate,
  summarizerSystemPrompt,
  summarizerPromptTemplate,
} from './prompts.js';

/**
 * Fix LaTeX delimiters in the text by replacing incorrect ones with correct ones
 */
function fixLatexDelimiters(text: string): string {
  return text
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

export async function generateSummary(
  text: string,
  language: string | null,
  model: string,
  adapter: LLMAdapter,
  onUpdate?: (msg: string) => void
): Promise<string> {
  const chunks = chunkText(text);
  const condensedChunks: string[] = [];

  // 1. Condense
  for (let i = 0; i < chunks.length; i++) {
    if (onUpdate) onUpdate(`Summarizing: Condensing chunk ${i + 1}/${chunks.length}...`);

    try {
      let condensed = await adapter.call(summarizerSystemPrompt(), preSummarizerPromptTemplate(language, chunks[i]), model);

      if (condensed) {
        condensedChunks.push(condensed);
      } else {
        condensedChunks.push(chunks[i]);
      }
    } catch (e) {
      console.error(e);
      condensedChunks.push(chunks[i]);
    }
  }

  const fullCondensed = condensedChunks.join('\n\n');

  // 2. Global Summary
  if (onUpdate) onUpdate('Summarizing: Generating abstract...');
  let globalMeta: string | null = '';
  try {
    globalMeta = await adapter.call(
      summarizerSystemPrompt(),
      summarizerPromptTemplate(language, fullCondensed),
      model
    );
  } catch (e) {
    globalMeta = '## Abstract\nError generating summary.';
  }

  // return `${globalMeta}\n\n## Condensed Content\n${fullCondensed}${referencesSection}`;
  return `${globalMeta || ''}\n\n${fullCondensed}`;
}
