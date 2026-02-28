// Node.js entry point — re-exports everything from the browser-safe index
// plus the copilot-sdk adapter (Node.js only).
export * from "./index.js";
export { createCopilotClient } from "./src/adapters/copilot-client.js";
export type { CopilotClientConfig, CopilotProviderConfig } from "./src/adapters/copilot-client.js";
