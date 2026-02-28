import { createCopilotClient, CopilotProviderConfig } from "./adapters/copilot-client.js";

export async function printModelsHelp(provider?: CopilotProviderConfig) {
  const adapter = await createCopilotClient({ provider });
  const models = await adapter.listModels();
  console.log("\nAvailable models:");
  models.forEach(id => {
    console.log(`- ${id}`);
  });
}
