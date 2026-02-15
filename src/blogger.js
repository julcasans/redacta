import { callLLM } from './llm-caller.js';
import { chunkText } from './chunks.js';
import {
  blogWriterSystemPrompt,
  blogWriterPromptTemplate,
} from './prompts.js';

export async function generateBlogPost(text, language, provider, apiKey, modelName, onUpdate) {
  const chunks = chunkText(text);
  const blogSections = [];
  const references = [];

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
      section = section
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');

      const sectionJson = JSON.parse(section);
      blogSections.push(sectionJson.text);
      if (Array.isArray(sectionJson.references)) {
        references.push(...sectionJson.references);
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