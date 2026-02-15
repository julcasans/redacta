/**
 * Utility functions for parsing LLM responses that may contain improperly escaped JSON.
 */

export interface LLMResponse {
  text: string;
  references: Array<{ title: string; url: string }>;
}

/**
 * Safely parse the LLM response JSON without relying on JSON.parse for the entire object.
 * This function manually extracts the "text" and "references" properties to handle
 * unescaped characters, LaTeX, HTML, CSS, etc. in the text content.
 * 
 * The function first attempts standard JSON.parse as a fast path. If that fails,
 * it manually extracts the properties using regex patterns.
 * 
 * @param response - The raw JSON string response from the LLM
 * @returns An object with text and references properties
 * @throws Error if unable to parse the response
 */
export function parseLLMResponse(response: string): LLMResponse {
  try {
    // Try standard JSON.parse first as a fast path
    return JSON.parse(response);
  } catch (e) {
    // If that fails, manually extract the properties
    try {
      // Find the "text" property value
      // Match: "text": "..." where ... can contain escaped quotes
      const textMatch = response.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      let text = '';
      
      if (textMatch) {
        // Unescape the text content
        text = textMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      } else {
        // Try to find text between "text": " and ", "references"
        const altTextMatch = response.match(/"text"\s*:\s*"([\s\S]*?)",\s*"references"/);
        if (altTextMatch) {
          text = altTextMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        }
      }
      
      // Find the "references" property value (it's an array, so we can safely parse it)
      const referencesMatch = response.match(/"references"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      let references: Array<{ title: string; url: string }> = [];
      
      if (referencesMatch) {
        try {
          references = JSON.parse(referencesMatch[1]);
        } catch (refError) {
          console.warn('Failed to parse references array:', refError);
          references = [];
        }
      }
      
      return { text, references };
    } catch (parseError) {
      console.error('Failed to manually parse LLM response:', parseError);
      throw new Error('Unable to parse LLM response');
    }
  }
}
