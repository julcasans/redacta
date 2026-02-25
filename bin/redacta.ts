#!/usr/bin/env node
import readline from "readline";
import { formatTranscript } from "../src/editor.js";
import { enrichMarkdown } from "../src/illustrator.js";
import { generateBlogPost } from "../src/blogger.js";
import { generateSummary } from "../src/summarizer.js";
import React from "react";
import { render, Instance } from "ink";
import ProgressTUI from "../src/ProgressTUI.js";
import fs from "fs";
import path from "path";

// Use yargs for argument parsing
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { printModelsHelp } from "../src/cli-help.js";
import type { LLMProviderConfig } from "../src/llm-caller.js";

interface Arguments {
  [x: string]: unknown;
  "with-illustration"?: boolean;
  "with-illustration-all"?: boolean;
  blog?: boolean;
  summary?: boolean;
  language?: string;
  directory?: string;
  model?: string;
  "search-key"?: string;
  "project-id"?: string;
  "list-models"?: boolean;
  "api-key"?: string;
  "provider-url"?: string;
  "provider-type"?: string;
  "provider-wire-api"?: string;
  "transcription-only"?: boolean;
  _?: (string | number)[];
}

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 <file|--directory> [options]")
  .option("with-illustration", { type: "boolean", description: "Add essential illustrations" })
  .option("with-illustration-all", { type: "boolean", description: "Add all illustrations" })
  .option("blog", { type: "boolean", description: "Generate blog post" })
  .option("summary", { type: "boolean", description: "Generate summary" })
  .option("language", { type: "string", description: "Output language" })
  .option("directory", { type: "string", description: "Process all files in directory" })
  .option("model", { type: "string", description: "Specify model to use" })
  .option("search-key", { type: "string", description: "Custom search key for illustration (overrides env)" })
  .option("project-id", { type: "string", description: "Custom project id for illustration (overrides env)" })
  .option("list-models", { type: "boolean", description: "List available models" })
  .option("api-key", { type: "string", description: "API key for custom LLM provider (BYOK)" })
  .option("provider-url", { type: "string", description: "Base URL of custom OpenAI-compatible LLM provider (BYOM/BYOK)" })
  .option("provider-type", { type: "string", description: "Provider type: openai, azure, or anthropic (default: openai)" })
  .option("provider-wire-api", { type: "string", description: "API wire format for openai/azure providers: completions or responses (default: completions)" })
  .option("transcription-only", { type: "boolean", description: "Download only the raw transcription, without any LLM processing" })
  .help()
  .epilog("For illustration (--with-illustration, --with-illustration-all), --search-key and --project-id are required (or set via environment variables CUSTOM_SEARCH_KEY and CUSTOM_SEARCH_PROJECT).\nUse --model to specify the LLM model.\nUse --provider-url and --api-key to bring your own model/key (BYOM/BYOK). Optionally set --provider-type and --provider-wire-api.\nRun with --list-models to see available models.")
  .parseSync() as Arguments;

const defaultModel = "gpt-4.1";


async function promptIfMissing(value: string | undefined | null, promptText: string): Promise<string> {
  if (value) return value;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(promptText, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function processFile(transcriptPath: string, options: Arguments) {
  const transcript = fs.readFileSync(transcriptPath, "utf-8");
  const baseName = path.basename(transcriptPath, path.extname(transcriptPath));
  const dirName = path.dirname(transcriptPath);
  const formattedPath = path.join(dirName, `${baseName}_formatted.md`);

  // If --transcription-only is set, save the raw transcript without any LLM processing
  if (options["transcription-only"]) {
    const transcriptionPath = path.join(dirName, `${baseName}_transcription.md`);
    fs.writeFileSync(transcriptionPath, transcript);
    console.log(`Transcription saved to ${transcriptionPath}`);
    return;
  }

  const model = options.model || process.env.MODEL || defaultModel;
  const providerUrl = options["provider-url"] || process.env.PROVIDER_URL;
  const apiKey = options["api-key"] || process.env.API_KEY;
  const providerType = (options["provider-type"] || process.env.PROVIDER_TYPE) as LLMProviderConfig['type'] | undefined;
  const wireApi = (options["provider-wire-api"] || process.env.PROVIDER_WIRE_API) as LLMProviderConfig['wireApi'] | undefined;
  const provider: LLMProviderConfig | undefined = providerUrl
    ? { baseUrl: providerUrl, ...(apiKey ? { apiKey } : {}), ...(providerType ? { type: providerType } : {}), ...(wireApi ? { wireApi } : {}) }
    : undefined;
  // CLI args take precedence, then env, then prompt
  let searchKey = options["search-key"] || process.env.CUSTOM_SEARCH_KEY;
  let projectId = options["project-id"] || process.env.CUSTOM_SEARCH_PROJECT;

  // Progress steps
  const steps = [
    "Formatting transcript",
    options["with-illustration"] || options["with-illustration-all"] ? "Adding illustrations" : null,
    options.blog ? "Generating blog post" : null,
    options.summary ? "Generating summary" : null
  ].filter(Boolean) as string[];

  let currentStep = 0;
  let status = "";
  let tuiInstance: Instance | undefined;
  function updateTUI(step: number, stat: string) {
    const app = React.createElement(ProgressTUI, { steps, currentStep: step, status: stat });
    if (tuiInstance) {
      tuiInstance.rerender(app);
    } else {
      tuiInstance = render(app);
    }
  }

  // Step 1: Format transcript
  status = "Processing...";
  updateTUI(currentStep, status);
  const formattedOutput = await formatTranscript(
    transcript,
    options.language || null,
    model,
    provider,
    (msg) => updateTUI(currentStep, msg)
  );
  fs.writeFileSync(formattedPath, formattedOutput);
  status = "Done";
  updateTUI(currentStep, status);
  currentStep++;

  let latestFormattedOutput = formattedOutput;

  // Step 2: Illustrate if requested
  if (options["with-illustration"] || options["with-illustration-all"]) {
    status = "Processing...";
    updateTUI(currentStep, status);
    if (!searchKey) {
      searchKey = await promptIfMissing(null, "Enter search key for illustration (CUSTOM_SEARCH_KEY): ");
    }
    if (!projectId) {
      projectId = await promptIfMissing(null, "Enter project id for illustration (CUSTOM_SEARCH_PROJECT): ");
    }
    const mode = options["with-illustration-all"] ? "all" : "essential";
    latestFormattedOutput = await enrichMarkdown(
      formattedOutput,
      searchKey,
      projectId,
      model,
      provider,
      mode,
      (msg) => updateTUI(currentStep, msg)
    );
    fs.writeFileSync(formattedPath, latestFormattedOutput);
    status = "Done";
    updateTUI(currentStep, status);
    currentStep++;
  }

  // Step 3: Blog
  if (options.blog) {
    status = "Processing...";
    updateTUI(currentStep, status);
    const blogPath = path.join(dirName, `${baseName}_blog.md`);
    const blogOutput = await generateBlogPost(
      latestFormattedOutput,
      options.language || null,
      model,
      provider,
      (msg) => updateTUI(currentStep, msg)
    );
    fs.writeFileSync(blogPath, blogOutput);
    status = "Done";
    updateTUI(currentStep, status);
    currentStep++;
  }

  // Step 4: Summary
  if (options.summary) {
    status = "Processing...";
    updateTUI(currentStep, status);
    const summaryPath = path.join(dirName, `${baseName}_summary.md`);
    const summaryOutput = await generateSummary(
      latestFormattedOutput,
      options.language || null,
      model,
      provider,
      (msg) => updateTUI(currentStep, msg)
    );
    fs.writeFileSync(summaryPath, summaryOutput);
    status = "Done";
    updateTUI(currentStep, status);
    currentStep++;
  }
  // Ensure the final state (all green) is rendered
  updateTUI(currentStep - 1, "Done");
  // Give Ink a moment to render the final state before unmounting
  await new Promise(resolve => setTimeout(resolve, 100));
  if (tuiInstance) tuiInstance.unmount();
}

async function main() {
  if (argv["list-models"]) {
    const providerUrl = argv["provider-url"] || process.env.PROVIDER_URL;
    const apiKey = argv["api-key"] || process.env.API_KEY;
    const listProvider: LLMProviderConfig | undefined = providerUrl
      ? { baseUrl: providerUrl, ...(apiKey ? { apiKey } : {}) }
      : undefined;
    await printModelsHelp(listProvider);
    process.exit(0);
  }

  // Prompt for illustration credentials at the start if needed
  let searchKey = argv["search-key"] || process.env.CUSTOM_SEARCH_KEY;
  let projectId = argv["project-id"] || process.env.CUSTOM_SEARCH_PROJECT;
  if ((argv["with-illustration"] || argv["with-illustration-all"]) && (!searchKey || !projectId)) {
    if (!searchKey) {
      searchKey = await promptIfMissing(null, "Enter search key for illustration (CUSTOM_SEARCH_KEY): ");
      argv["search-key"] = searchKey; // Is this safe? argv is const but properties are mutable? No, it's typed as Arguments.
      // We can't mutate argv directly if it's strict. But yargs return is usually an object we can modify.
      // Let's assume we can or use local variables. We are passing `argv` to `processFile`.
    }
    if (!projectId) {
      projectId = await promptIfMissing(null, "Enter project id for illustration (CUSTOM_SEARCH_PROJECT): ");
      argv["project-id"] = projectId;
    }
  }

  if (argv.directory) {
    const files = fs.readdirSync(argv.directory)
      .filter(f => f.endsWith(".srt"))
      .map(f => path.join(argv.directory!, f));
    for (const file of files) {
      await processFile(file, argv);
    }
  } else if (argv._ && argv._[0]) {
    await processFile(String(argv._[0]), argv);
  } else {
    yargs(hideBin(process.argv)).showHelp();
    process.exit(1);
  }
}

main();
