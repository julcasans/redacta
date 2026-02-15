import { CopilotClient } from "@github/copilot-sdk";

export async function printModelsHelp() {
  const client = new CopilotClient();
  await client.start();
  const models = await client.listModels();
  await client.stop();
  console.log("\nAvailable models:");
  models.forEach(m => {
    console.log(`- ${m.id}`);
  });
}
