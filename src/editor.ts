import { callLLM } from './llm-caller.js';
import { chunkText, chunkRawText } from './chunks.js'
import { editorSystemPrompt, editorPromptTemplate } from './prompts.js';

interface Reference {
  title: string;
  url: string;
}

export async function formatTranscript(
  transcript: string,
  language: string | null,
  provider: string,
  apiKey: string,
  modelName: string,
  onUpdate?: (msg: string) => void
): Promise<string> {
  // Simple heuristic: If the text contains basic punctuation, assume it's safe to split by sentence.
  const hasPunctuation = /[.!?]/.test(transcript);

  let chunks: string[];
  if (hasPunctuation || true) {
    onUpdate?.('Chunking transcript...');
    chunks = chunkText(transcript);
  } else {
    onUpdate?.('Chunking raw transcript...');
    chunks = await chunkRawText(transcript, callLLM, provider, apiKey, modelName);
  }

  const formattedChunks: string[] = [];
  const allReferences: Reference[] = [];


  for (let i = 0; i < chunks.length; i++) {
    onUpdate?.(`Formatting chunk ${i + 1}/${chunks.length}...`);
    try {
      let response = await callLLM(editorSystemPrompt(), editorPromptTemplate(language, chunks[i]) + '\n\n' + chunks[i], provider, apiKey, modelName, onUpdate);

      // Clean code blocks if LLM wraps JSON in \`\`\`json ... \`\`\`
      if (response) {
        response = response
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '');
        
        const parsed = JSON.parse(response);
        formattedChunks.push(parsed.text);
        if (Array.isArray(parsed.references)) {
          allReferences.push(...parsed.references);
        }
      } else {
         formattedChunks.push(chunks[i]); // Fallback if response is null
      }
    } catch (e: any) {
      console.error(e);
      onUpdate?.(`Error formatting chunk ${i + 1}: ${e.message}`);
      formattedChunks.push(chunks[i]); // Fallback
    }
  }

  let completion = formattedChunks.join('\n\n');

  // Deduplicate references
  // Deduplicate references by url
  const uniqueRefs = allReferences.filter((ref, index, self) =>
    index === self.findIndex((t) => (
      t.url === ref.url
    ))
  );

  if (uniqueRefs.length > 0) {
    completion += '\n\n## References\n\n' + uniqueRefs.map((ref) => `- [${ref.title}](${ref.url})`).join('\n');
  }

  return completion;
}