import { callLLM } from './llm-caller.js';
import { chunkText } from './chunks.js'
import { editorSystemPrompt, editorPromptTemplate } from './prompts.js';

export async function formatTranscript(transcript, language, provider, apiKey, modelName, onUpdate) {
  // Simple heuristic: If the text contains basic punctuation, assume it's safe to split by sentence.
  const hasPunctuation = /[.!?]/.test(transcript);

  let chunks;
  if (hasPunctuation || true) {
    if (onUpdate) onUpdate('Chunking transcript...');
    chunks = chunkText(transcript);
  } else {
    if (onUpdate) onUpdate('Chunking raw transcript...');
    chunks = await chunkRawText(transcript, callLLM, provider, apiKey, modelName);
  }

  const formattedChunks = [];
  const allReferences = [];


  for (let i = 0; i < chunks.length; i++) {
    if (onUpdate) onUpdate(`Formatting chunk ${i + 1}/${chunks.length}...`);
    try {
      let response = await callLLM(editorSystemPrompt(language, chunks[i]), editorPromptTemplate(language, chunks[i]) + '\n\n' + chunks[i], provider, apiKey, modelName, onUpdate);

      // Clean code blocks if LLM wraps JSON in \`\`\`json ... \`\`\`
      response = response
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');
      
      const parsed = JSON.parse(response);
      formattedChunks.push(parsed.text);
      if (Array.isArray(parsed.references)) {
        allReferences.push(...parsed.references);
      }
    } catch (e) {
      console.error(e);
      if (onUpdate) onUpdate(`Error formatting chunk ${i + 1}: ${e.message}`);
      formattedChunks.push(chunks[i]); // Fallback
    }
  }

  let completion = formattedChunks.join('\n\n');

  // Deduplicate references
  const uniqueRefs = [...new Set(allReferences)];

  if (uniqueRefs.length > 0) {
    completion += '\n\n## References\n\n' + uniqueRefs.map((ref) => `- [${ref.title}](${ref.url})`).join('\n');
  }

  return completion;
}