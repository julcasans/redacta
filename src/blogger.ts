import { callLLM } from './llm-caller.js';
import { chunkText } from './chunks.js';
import {
  blogWriterSystemPrompt,
  blogWriterPromptTemplate,
} from './prompts.js';
import { parseLLMResponse } from './json-parser.js';

interface BlogReference {
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

export async function generateBlogPost(
  text: string,
  language: string | null,
  provider: string,
  apiKey: string,
  modelName: string,
  onUpdate?: (msg: string) => void
): Promise<string> {
  const chunks = chunkText(text);
  const blogSections: string[] = [];
  const references: BlogReference[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (onUpdate) onUpdate(`Blog: Writing section ${i + 1}/${chunks.length}...`);

    let position = 'This is the MIDDLE of the post. Maintain the flow from the previous section.';
    if (i === 0)
      position =
        'This is the START of the post. You can include an engaging hook, but do not write a title. Include meta information: (post title, video url).';
    if (i === chunks.length - 1)
      position = 'This is the END of the post. You can include a brief wrap-up or conclusion';

    try {
      let section = await callLLM(blogWriterSystemPrompt(), blogWriterPromptTemplate(language, chunks[i], position), provider, apiKey, modelName, onUpdate);
      
      if (section) {
        section = section
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/\s*```$/, '');

        const sectionJson = parseLLMResponse(section);
        const cleanedText = fixLatexDelimiters(sectionJson.text);
        blogSections.push(cleanedText);
        if (Array.isArray(sectionJson.references)) {
            references.push(...sectionJson.references);
        }
      } else {
        blogSections.push(chunks[i]);
      }
    } catch (e) {
      console.error("Error parsing blog section JSON", e);
      blogSections.push(chunks[i]);
    }
  }

  let referencesSection = '';

  if (references.length > 0) {
    referencesSection += '\n\n## References\n\n' + references.map((ref) => `- [${ref.title}](${ref.url})`).join('\n');
  }

  return blogSections.join('\n\n') + referencesSection;
}