import { callLLM } from './llm-caller.js';
import { chunkText } from './chunks.js';
import {
  preSummarizerPromptTemplate,
  summarizerSystemPrompt,
  summarizerPromptTemplate,
} from './prompts.js';

export async function generateSummary(text, language, provider, apiKey, modelName, onUpdate) {
  const chunks = chunkText(text);
  const condensedChunks = [];

  // 1. Condense
  for (let i = 0; i < chunks.length; i++) {
    if (onUpdate) onUpdate(`Summarizing: Condensing chunk ${i + 1}/${chunks.length}...`);

    try {
      let condensed = await callLLM(summarizerSystemPrompt, preSummarizerPromptTemplate(language, chunks[i]), provider, apiKey, modelName, onUpdate);

      condensedChunks.push(condensed);
    } catch (e) {
      console.error(e);
      condensedChunks.push(chunks[i]);
    }
  }

  const fullCondensed = condensedChunks.join('\n\n');

  // 2. Global Summary
  if (onUpdate) onUpdate('Summarizing: Generating abstract...');
  let globalMeta = '';
  try {
    globalMeta = await callLLM(
      summarizerSystemPrompt(),
      summarizerPromptTemplate(language, fullCondensed),
      provider,
      apiKey,
      modelName,
      onUpdate
    );
  } catch (e) {
    globalMeta = '## Abstract\nError generating summary.';
  }

  // return `${globalMeta}\n\n## Condensed Content\n${fullCondensed}${referencesSection}`;
  return `${globalMeta}\n\n${fullCondensed}`;
}
