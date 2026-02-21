import { callLLM, LLMProviderConfig } from './llm-caller.js';
import { chunkText } from './chunks.js';
import {
  illustratorSystemPrompt,
  illustratorPromptTemplate,
  sketcherSystemPrompt,
  sketcherPromptTemplate,
} from './prompts.js';
import { callCustomSearch } from './image-finder.js';

export async function enrichMarkdown(
  markdown: string,
  searchKey: string,
  engineId: string,
  model: string,
  provider?: LLMProviderConfig,
  mode: 'all' | 'essential' = 'essential',
  onUpdate?: (msg: string) => void
): Promise<string> {
  // 1. Identify Placeholders
  const chunks = chunkText(markdown);
  const enrichedChunks: string[] = [];


  for (let i = 0; i < chunks.length; i++) {
    if (onUpdate) onUpdate(`Enriching: Identifying images in chunk ${i + 1}/${chunks.length}...`);
    try {
      let chunk = await callLLM(illustratorSystemPrompt(), illustratorPromptTemplate(chunks[i], mode), model, provider, onUpdate);
      if (chunk) {
        chunk = chunk
          .replace(/^```markdown\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '');
        enrichedChunks.push(chunk);
      } else {
        enrichedChunks.push(chunks[i]);
      }
    } catch (e: any) {
      console.error(e);
      if (onUpdate) onUpdate(`Error enriching chunk ${i + 1}: ${e.message}`);
      enrichedChunks.push(chunks[i]);
    }
  }

  let textWithPlaceholders = enrichedChunks.join('\n\n');
  let finalText = textWithPlaceholders;


  // 2. Process Generative Diagrams
  const diagMatches = [...finalText.matchAll(/<!--\s*DIAGRAM_GENERATE:\s*"(.*?)"\s*-->/g)];

  if (diagMatches.length > 0) {
    for (let i = 0; i < diagMatches.length; i++) {
      const fullTag = diagMatches[i][0];
      const description = diagMatches[i][1];

      if (onUpdate) onUpdate(`Enriching: Generating diagram for "${description}" (${i + 1}/${diagMatches.length})...`);

      try {
        let diagram = await callLLM(sketcherSystemPrompt(), sketcherPromptTemplate(description), model, provider, onUpdate);
        if (diagram) {
            diagram = diagram.trim();
            if (!diagram.startsWith('```')) {
            diagram = '```text\n' + diagram + '\n```';
            }
            finalText = finalText.replace(fullTag, diagram + `\n*Diagram: ${description}*`);
        } else {
            finalText = finalText.replace(fullTag, `<!-- Failed to generate diagram: ${description} -->`);
        }
      } catch (e) {
        console.error("Error generating diagram", e);
        // Keep the tag or a failure comment so we don't lose the context entirely or break the text
        finalText = finalText.replace(fullTag, `<!-- Failed to generate diagram: ${description} -->`);
      }
    }
  }

  // 3. Replace Image Placeholders
  if (!searchKey || !engineId) {
    if (onUpdate) onUpdate('No Search Key/ID provided. Skipping image replacement.');
    return finalText;
  }

  const matches = [...finalText.matchAll(/<!--\s*IMAGE_SEARCH:\s*"(.*?)"\s*-->/g)];

  if (matches.length === 0) return finalText;

  // Process replacements sequentially to avoid rate limits
  for (let i = 0; i < matches.length; i++) {
    const fullTag = matches[i][0];
    const query = matches[i][1];

    if (onUpdate) onUpdate(`Enriching: Searching image for "${query}" (${i + 1}/${matches.length})...`);

    const image = await callCustomSearch(query, searchKey, engineId);
    if (image) {
      const imageMd = `![${image.title}](${image.link})\n*Image: ${image.title}*`;
      finalText = finalText.replace(fullTag, imageMd);
    } else {
      finalText = finalText.replace(fullTag, `<!-- Image not found: ${query} -->`);
    }
  }

  return finalText;
}