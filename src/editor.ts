import { LLMAdapter } from './adapters/types.js';
import { chunkText, chunkRawText } from './chunks.js'
import { editorSystemPrompt, editorPromptTemplate } from './prompts.js';
import { parseLLMResponse } from './json-parser.js';

interface Reference {
  title: string;
  url: string;
}

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

export async function formatTranscript(
  transcript: string,
  language: string | null,
  model: string,
  adapter: LLMAdapter,
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
    chunks = await chunkRawText(transcript, adapter.call.bind(adapter), model);
  }

  const formattedChunks: string[] = [];
  const allReferences: Reference[] = [];


  for (let i = 0; i < chunks.length; i++) {
    onUpdate?.(`Formatting chunk ${i + 1}/${chunks.length}...`);
    try {
      let response = await adapter.call(editorSystemPrompt(), editorPromptTemplate(language, chunks[i]) + '\n\n' + chunks[i], model);

      // Clean code blocks if LLM wraps JSON in \`\`\`json ... \`\`\`
      if (response) {
        response = response
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '');
        
        const parsed = parseLLMResponse(response);
        const cleanedText = fixLatexDelimiters(parsed.text);
        formattedChunks.push(cleanedText);
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