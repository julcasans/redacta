
export const languageInstruction = (language: string | null) => language
  ? `The output MUST be in ${language}. Translate the content if necessary.`
  : 'The output MUST be in the same language as the input transcript. Do NOT translate.';

export const editorSystemPrompt = () => 'You are an expert editor.';
export const editorPromptTemplate = (language: string | null, segment: string) => `
  You are an expert editor. I will provide you with a raw transcript of a video.
  Your task is to convert this transcript into a well-formatted Markdown document AND extract any references mentioned.
  
  Follow these strict rules:
  1.  **Content Fidelity**: Preserve the core information and meaning.  You MUST remove speech artifacts such as repetitions, filler words, false starts, but just that, the content must be practically the same word by word. Do NOT summarize or delete substantive information.
  2.  **Formatting**:
      *   Add proper punctuation (periods, commas, question marks).
      *   Fix capitalization.
      *   Break the text into logical paragraphs.
      *   Use Markdown headers (#, ##, ###) to create sections based on the flow of the content.
      *   Use bullet points or numbered lists where appropriate.
  3.  **References**: Extract ONLY highly specific and actionable references.
      *   **INCLUDE**: Full URLs, specific book/article titles, specific paper names, unique tool names mentioned as resources (e.g., "Oh My Posh", "Spec Kit").
      *   **EXCLUDE**: Generic technology names ("React", "Python", "Azure", "GitHub", "VS Code"), general concepts ("Cloud", "AI"), or broad platform names unless a specific deep-link or specific article is discussed.
      *   Your goal is a curated reading list, not a keyword cloud.
  4.  **Mathematical Expressions**: You MUST format ALL mathematical expressions using LaTeX with dollar sign delimiters ONLY:
      *   **Inline math**: Wrap in single dollar signs: $x^2 + y^2 = z^2$
      *   **Block/display math**: Wrap in double dollar signs on separate lines:
          $$
          \\frac{\\partial L}{\\partial w} = \\frac{1}{n} \\sum_{i=1}^{n} x_i
          $$
      *   Use SINGLE backslashes in LaTeX commands: \\frac, \\partial, \\sum, \\lim, \\to, \\times
      *   **ONLY use $ and $$ delimiters. No other delimiters are allowed.**
      *   **Examples of CORRECT formatting**: 
          - Inline: $\\alpha + \\beta = \\gamma$
          - Inline with fractions: $\\frac{\\partial l}{\\partial d} = f$
          - Block: $$\\int_{0}^{\\infty} e^{-x} dx = 1$$
          - Limits: $$\\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}$$
  5.  **Language**: ${languageInstruction(language)}
  6.  **Output Format**: Return a valid JSON object with the following structure:
  {
      "text": "The formatted markdown text...",
      "references": [{title: "Reference 1", "url": "URL 1"}, {title: "Reference 2", "url": "URL 2"}, ...] // An array of reference objects
  }
  > ATTENTION! The JSON must be valid and complete. Check the JSON validity before returning (you can use JSON.parse to check it).
  (If no references are found, "references" should be an empty array).
  
  Here is the transcript segment:

  ${segment}
  `;
export const illustratorSystemPrompt = () => 'You are an expert editor enriching a document with visual content.';
/**
 * @param {string} segment - The markdown/text to enrich
 * @param {'all'|'essential'} [mode='essential'] - If 'essential', solo agrega esquemas realmente necesarios para la comprensión; si 'all', agrega todos los posibles como antes.
 */
export const illustratorPromptTemplate = (segment: string, mode: 'all' | 'essential' = 'essential') => {
  let modeInstruction = '';
  if (mode === 'essential') {
    modeInstruction = `\nIMPORTANT: Only add diagrams or visualizations that are truly essential for understanding the text. Do NOT add diagrams for every possible concept—only for those that would be confusing or unclear without a visual aid. Be selective and minimal.`;
  } else {
    modeInstruction = `\nAdd diagrams and visualizations wherever they could help, as in the previous behavior.`;
  }
  return `
  You are an expert editor enriching a document.
  Your task is to identify mentions of visual content or concepts that would benefit from visualization.
  
  There are two types of visualizations you can add:

  1. **Searchable Images**: For specific works of art, famous people, historical photos, or specific real-world objects where an exact image exists.
    - Use tag: <!-- IMAGE_SEARCH: "Specific Query" -->
    - Example: <!-- IMAGE_SEARCH: "The Starry Night by Van Gogh" -->

  2. **Generative Diagrams**: For conceptual explanations, process flows, data tables, or specific graphs described in the text where a specific image search might be too generic, inaccurate, or where a custom diagram explains it better.
    - Use tag: <!-- DIAGRAM_GENERATE: "Detailed description of the flow, concept, or diagram to generate" -->
    - Example: <!-- DIAGRAM_GENERATE: "A flow chart showing the water cycle with arrows indicating evaporation, condensation, and precipitation" -->
  
  Rules:
  1.  Insert the tag IMMEDIATELY AFTER the paragraph where the visual element is first discussed.
  2.  Do NOT change any existing text.
  3.  Do NOT add tags for generic terms unless a specific one is described or a diagram would be helpful.
  4.  For IMAGE_SEARCH, the query should be specific enough for a search engine.
  5.  For DIAGRAM_GENERATE, the description should be detailed enough for an AI to generate the ASCII art.
  6.  Return the full Markdown text with the tags inserted.
  ${modeInstruction}
  
  Text to process:
 
  ${segment} 
  `;
};

export const sketcherSystemPrompt = () => 'You are an expert at creating ASCII art diagrams.';
export const sketcherPromptTemplate = (description: string) => `Create a clear and concise ASCII diagram or flow chart to visualize the following concept:\n${description}\n\nWrap the output in a markdown code block (e.g. \`\`\`text ... \`\`\`).`;

export const summarizerSystemPrompt = () => 'You are an expert summarizer.';
export const preSummarizerPromptTemplate = (language: string | null, segment: string) => `
You are an expert summarizer.
Your task is to rewrite the following text to be concise and straight to the point.
- Remove unnecessary words, filler, and fluff.
- Preserve all key technical details, facts, and steps.
- The output text should be readable as a continuous text (not just a list of bullets), but much shorter than the original.
- Do NOT add any meta-commentary like "Here is the summary".
- Include the reference section if found
- **Mathematical Expressions**: Format all mathematical expressions using LaTeX notation:
    * Inline math: Use single dollar signs: $x^2 + y^2 = z^2$
    * Block math: Use double dollar signs on separate lines
    * CRITICAL: Always use SINGLE backslashes in LaTeX commands (e.g., \\frac, \\partial, \\sum)
- Language: ${languageInstruction(language)}

Text to condense:

${segment}
`;

export const summarizerPromptTemplate = (language: string | null, text: string) => `
    You are an expert summarizer.
    Your task is to rewrite the following text to be concise and straight to the point.
    - Remove unnecessary words, filler, and fluff.
    - Preserve all key technical details, facts, and steps.
    - The output should be readable as a continuous text (not just a list of bullets), but much shorter than the original.
    - Do NOT add any meta-commentary like "Here is the summary".
    - **Mathematical Expressions**: Format all mathematical expressions using LaTeX notation:
        * Inline math: Use single dollar signs: $x^2 + y^2 = z^2$
        * Block math: Use double dollar signs on separate lines
        * CRITICAL: Always use SINGLE backslashes in LaTeX commands (e.g., \\frac, \\partial, \\sum)
    ${languageInstruction(language)}
    
    Format:
    ## <abstract (title according to language)>
    ...
    ## <main_content (title according to language)>
    ...
    ## <condensed_content (title according to language)>
    
    Input:
    ${text}
    `;

export const blogWriterSystemPrompt = () => 'You are an expert blog writer.';
export const blogWriterPromptTemplate = (language: string | null, segment: string, position: string) => `
  You are an expert blog writer.
  Your task is to rewrite the provided transcript segment into an engaging, well-structured blog post section.

  Current Position: ${position}

  Rules:
  - **Content Focus**: REWRITE ONLY the content provided in the transcript segment. Do NOT hallucinate content from other parts of the text you might "know" or guess.
  - **No Repetition**: If this is a MIDDLE section, do NOT write an introduction, welcome message, or summary of what the post will be about. Jump straight into the content.
  - **Style**: Write as a human blog author. Not a transcript summary. This is a blog post, not a transcript, not a talk, not a class, not a conversation. Make it engaging and easy to read, with a natural flow.
  - **Tone**: Engaging, informative, and professional.
  - **Formatting**: Use Markdown headers, bold text, and lists.
  - **Mathematical Expressions**: You MUST format ALL mathematical expressions using LaTeX with dollar sign delimiters ONLY:
      *   **Inline math**: Wrap in single dollar signs: $x^2 + y^2 = z^2$
      *   **Block/display math**: Wrap in double dollar signs on separate lines:
          $$
          \\frac{\\partial L}{\\partial w} = \\frac{1}{n} \\sum_{i=1}^{n} x_i
          $$
      *   Use SINGLE backslashes in LaTeX commands: \\frac, \\partial, \\sum, \\lim, \\to, \\times
      *   **ONLY use $ and $$ delimiters. No other delimiters are allowed.**
      *   **Examples of CORRECT formatting**: 
          - Inline: $\\alpha + \\beta = \\gamma$
          - Inline with fractions: $\\frac{\\partial l}{\\partial d} = f$
          - Block: $$\\int_{0}^{\\infty} e^{-x} dx = 1$$
          - Limits: $$\\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}$$
  - **Images**: PRESERVE all <!-- IMAGE_SEARCH --> and ![...] tags.
  - **Fidelity**: Keep the core information accurate.
  - The output should have a json object with the following structure:
  {
      "text": "...", // string markdown content
      "references": [{title: "Reference 1", "url": "URL 1"}, {title: "Reference 2", "url": "URL 2"}, ...] // An array of reference objects
  }
  > ATTENTION! The JSON must be valid and complete. Check the JSON validity before returning (you can use JSON.parse to check it).
  ${languageInstruction(language)}

  Transcript Segment to Rewrite:

  ${segment}`;