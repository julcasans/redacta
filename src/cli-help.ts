import { listModels } from "./llm-caller.js";

export async function printModelsHelp(providerUrl?: string, apiKey?: string) {
  const models = await listModels(providerUrl, apiKey);
  console.log("\nAvailable models:");
  models.forEach(id => {
    console.log(`- ${id}`);
  });
}
