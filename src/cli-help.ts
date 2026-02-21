import { listModels, LLMProviderConfig } from "./llm-caller.js";

export async function printModelsHelp(provider?: LLMProviderConfig) {
  const models = await listModels(provider);
  console.log("\nAvailable models:");
  models.forEach(id => {
    console.log(`- ${id}`);
  });
}
