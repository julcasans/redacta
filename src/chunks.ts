// utils.js

type CallLLMFunction = (
  systemPrompt: string,
  userPrompt: string,
  model: string,
  onUpdate?: (msg: string) => void
) => Promise<string | null>;
export function chunkText(text: string, maxChars = 20000): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  function flushChunk() {
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentLength = 0;
    }
  }

  // Split by double newlines to preserve paragraphs
  const paragraphs = text.split(/\n\n/);

  for (const paragraph of paragraphs) {
    // If a single paragraph is too long, try splitting by sentences
    if (paragraph.length > maxChars) {
      flushChunk();

      // Split by ". " but keep the delimiter conceptually
      // In Python: paragraph.split(". ")
      const sentences = paragraph.split('. ');

      let sentChunk: string[] = [];
      let sentChunkLen = 0;

      for (const sentence of sentences) {
        const sentenceLen = sentence.length + 2; // +2 for ". "

        if (sentence.length > maxChars) {
          // Huge sentence, split by words
          if (sentChunk.length > 0) {
            chunks.push(sentChunk.join('. '));
            sentChunk = [];
            sentChunkLen = 0;
          }

          const words = sentence.split(' ');
          let wordChunk: string[] = [];
          let wordChunkLen = 0;

          for (const word of words) {
            const wordLen = word.length + 1; // +1 for space
            if (wordChunkLen + wordLen > maxChars) {
              chunks.push(wordChunk.join(' '));
              wordChunk = [word];
              wordChunkLen = wordLen;
            } else {
              wordChunk.push(word);
              wordChunkLen += wordLen;
            }
          }
          if (wordChunk.length > 0) {
            chunks.push(wordChunk.join(' '));
          }
        } else {
          // Sentence fits
          if (sentChunkLen + sentenceLen > maxChars) {
            chunks.push(sentChunk.join('. '));
            sentChunk = [sentence];
            sentChunkLen = sentenceLen;
          } else {
            sentChunk.push(sentence);
            sentChunkLen += sentenceLen;
          }
        }
      }

      if (sentChunk.length > 0) {
        chunks.push(sentChunk.join('. '));
      }
    } else {
      // Paragraph fits
      const paraLen = paragraph.length + 2; // "\n\n"
      if (currentLength + paraLen > maxChars) {
        flushChunk();
        currentChunk.push(paragraph);
        currentLength = paraLen;
      } else {
        currentChunk.push(paragraph);
        currentLength += paraLen;
      }
    }
  }

  flushChunk();
  return chunks;
}


/**
 * Splits raw text (no punctuation) into chunks using an LLM to find logical boundaries.
 * Implements a Dynamic Cursor (Streaming Buffer) approach.
 *
 * @param {string} text - The raw text to chunk.
 * @param {Function} callLLM - The function to call the LLM.
 * @param {string} model - Model name.
 * @param {number} windowSize - Size of the window to analyze in characters (approx 500 words ~ 3000 chars).
 * @returns {Promise<string[]>} Array of text chunks.
 */
export async function chunkRawText(
  text: string,
  callLLM: CallLLMFunction,
  model: string,
  windowSize = 3000
): Promise<string[]> {
  const chunks: string[] = [];
  let cursor = 0;
  const totalLength = text.length;

  const systemPrompt =
    'You are an expert text processor. Your task is to split a continuous stream of raw text into coherent chunks.';

  // Safety check just in case
  if (!text) return [];

  let loopCount = 0;
  const maxLoops = Math.ceil(totalLength / 100) + 100; // Protection against infinite loops

  while (cursor < totalLength && loopCount < maxLoops) {
    loopCount++;
    const remainingChars = totalLength - cursor;

    // If remaining text fits in window, just take it.
    if (remainingChars <= windowSize) {
      chunks.push(text.slice(cursor));
      break;
    }

    const windowText = text.slice(cursor, cursor + windowSize);

    // Prompt Construction
    const prompt = `
I have a long raw text with no reliable punctuation or formatting.
I need to split it into chunks to process it.

Here is the current window of text (approx ${windowText.length} chars):
"""
${windowText}
"""

TASK:
Identify the LAST complete thought, sentence, or paragraph that finishes within this window.
Return the exact text from the START of the window up to the END of that last complete unit.
The goal is to find a safe place to cut the text so the next chunk starts cleanly.

OUTPUT format:
Just the text segment. Do NOT add quotes, do NOT add markdown, do NOT add explanations.
`;

    try {
      // Note: systemPrompt is first arg to callLLM based on background.js context
      let result = await callLLM(systemPrompt, prompt, model);

      // Clean up result
      if (result) {
        result = result.trim();
        // Remove code blocks
        result = result
          .replace(/^```\w*\s*/, '')
          .replace(/```$/, '')
          .trim();
        // Remove quotes
        if (result.startsWith('"') && result.endsWith('"') && result.length > 20) {
          result = result.slice(1, -1);
        }
      }

      let splitIndex = -1;

      // Validate LLM output against windowText
      if (result) {
        // Strategy: Fuzzy Match Tail
        // We take the last 50 chars of the result and find them in the windowText.
        // We look for the last occurrence to match the "last complete thought".
        const searchLen = Math.min(50, result.length);
        const suffix = result.slice(-searchLen);
        const lastIdx = windowText.lastIndexOf(suffix);

        if (lastIdx !== -1) {
          splitIndex = lastIdx + suffix.length;
        }
      }

      // Validation of splitIndex
      // If splitIndex is too small (e.g. < 10% of window), the LLM might have failed to find a good break or hallucinated.
      if (splitIndex <= 0 || splitIndex < windowSize * 0.1) {
        console.warn(`chunkRawText: LLM returned questionable split index ${splitIndex}. Fallback to size limit.`);
        // Fallback: splitting at last space in the safe zone
        const safeZoneStart = Math.floor(windowSize * 0.75);
        const lastSpace = windowText.lastIndexOf(' ', windowSize);
        if (lastSpace > safeZoneStart) {
          splitIndex = lastSpace + 1;
        } else {
          splitIndex = windowSize;
        }
      }

      chunks.push(text.slice(cursor, cursor + splitIndex));
      cursor += splitIndex;
    } catch (error) {
      console.error('chunkRawText: LLM Error', error);
      // Fallback: Split at last space space
      const lastSpace = windowText.lastIndexOf(' ');
      const splitIndex = lastSpace > windowSize * 0.5 ? lastSpace + 1 : windowSize;
      chunks.push(text.slice(cursor, cursor + splitIndex));
      cursor += splitIndex;
    }
  }

  return chunks;
}
