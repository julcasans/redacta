/**
 * The single abstraction between redacta's high-level functions and any LLM transport.
 *
 * Two built-in implementations:
 *   - createFetchClient()   → browser-safe, pure fetch (src/adapters/fetch-client.ts)
 *   - createCopilotClient() → Node.js only, wraps @github/copilot-sdk (src/adapters/copilot-client.ts)
 */
export interface LLMAdapter {
  /**
   * Send a prompt to the LLM and return the text response.
   * @param systemPrompt - The system instruction.
   * @param userPrompt   - The user message.
   * @param model        - The model identifier (e.g. "gpt-4.1").
   * @param onUpdate     - Optional streaming progress callback.
   */
  call(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    onUpdate?: (msg: string) => void
  ): Promise<string | null>;

  /** List models available from this adapter's provider. */
  listModels(): Promise<string[]>;
}
