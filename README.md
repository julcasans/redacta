# Redacta

## Overview

Redacta is a library and CLI tool for generating blog posts, summaries, and enriched documents from video transcripts. It supports multilingual output, image search, and concept illustrations (including ASCII diagrams).

Redacta uses a pluggable LLM transport layer — choose between a **fetch-based adapter** (browser-safe; works in Chrome extensions and any environment with `fetch`) or a **Copilot SDK adapter** (Node.js; uses your GitHub Copilot subscription).

## Features

- Generate blog posts and summaries from transcript files (.srt)
- Multilingual support (specify output language)
- Add illustrations: image search and ASCII diagrams to explain concepts
- Outputs in Markdown format with embedded images and diagrams
- Batch processing: Process all `.srt` files in a directory
- Interactive progress display (TUI)
- **Browser-safe library** — use `createFetchClient` in Chrome extensions or web apps
- **Pluggable adapters** — swap LLM providers without changing application code

## Requirements

- **LLM access** (choose one):
  - GitHub Copilot (authenticated via `gh` CLI) — used by the CLI by default
  - Any OpenAI-compatible API, Gemini, Anthropic, or HuggingFace — pass an API key via `--api-key` / `--provider-url`
- **Node.js** v18+ (for the CLI; library works in browsers too)
- **Google Custom Search API key and Search Engine ID**: Required for image search features (`--with-illustration`).

## Installation

```bash
npm install -g redacta       # CLI (global)
npm install redacta          # library
```

### GitHub Copilot Setup (CLI default)

The CLI uses `@github/copilot-sdk` by default. To authenticate:

1. **Install GitHub CLI (`gh`) and Copilot extension**:
   Follow the official guide: [Installing GitHub Copilot in the CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli/installing-github-copilot-in-the-cli)

2. **Authenticate**:
   Run `gh auth login` and ensure you grant access to GitHub Copilot.

Alternatively, skip Copilot entirely and bring your own key with `--api-key` and `--provider-url`.


## Library Usage

Redacta exports its high-level functions and adapter factories so you can use it programmatically.

### Node.js / CLI scripts

```ts
import { createCopilotClient, formatTranscript, generateBlogPost } from 'redacta/index.node.js';

const adapter = await createCopilotClient(); // uses gh auth
// or with a custom provider:
// const adapter = await createCopilotClient({ provider: { baseUrl, apiKey } });

const formatted = await formatTranscript(transcript, 'english', 'gpt-4o', adapter);
const blog = await generateBlogPost(formatted, 'english', 'gpt-4o', adapter);
```

### Browser / Chrome extension

```ts
import { createFetchClient, formatTranscript, generateBlogPost } from 'redacta';

const adapter = createFetchClient({ provider: 'openai', apiKey: 'sk-...' });
// or Gemini:
// const adapter = createFetchClient({ provider: 'gemini', apiKey: '...' });
// or Anthropic:
// const adapter = createFetchClient({ provider: 'anthropic', apiKey: '...' });

const formatted = await formatTranscript(transcript, 'english', 'gpt-4o', adapter);
const blog = await generateBlogPost(formatted, 'english', 'gpt-4o', adapter);
```

### Supported fetch providers

| Provider | `provider` value | Custom `baseUrl` |
| :--- | :--- | :--- |
| OpenAI | `'openai'` | Optional — point to any OpenAI-compatible endpoint (Azure, Ollama, etc.) |
| Google Gemini | `'gemini'` | — |
| Anthropic Claude | `'anthropic'` | — |
| HuggingFace | `'huggingface'` | — |

To use a local Ollama instance or any OpenAI-compatible server, pass `baseUrl`:

```ts
const adapter = createFetchClient({
  provider: 'openai',
  apiKey: 'ollama',           // Ollama ignores the key
  baseUrl: 'http://localhost:11434/v1',
});
```

### Available exports

**`redacta`** (browser-safe):
- `createFetchClient(config)` — creates a fetch-based adapter
- `formatTranscript`, `enrichMarkdown`, `generateBlogPost`, `generateSummary`
- Types: `LLMAdapter`, `FetchClientConfig`, `FetchProvider`

**`redacta/index.node.js`** (Node.js):
- Everything above, plus `createCopilotClient(config?)` and `CopilotProviderConfig`

## CLI Usage

```bash
redacta <transcript_file> [options]
# OR process a directory
redacta --directory <path_to_directory> [options]
```


### Options

| Option | Description |
| :--- | :--- |
| `--blog` | Generate blog post (`_blog.md`) |
| `--summary` | Generate summary (`_summary.md`) |
| `--language <lang>` | Output language |
| `--with-illustration` | Add essential illustrations |
| `--with-illustration-all` | Add all illustrations |
| `--directory <dir>` | Process all files in directory |
| `--model <model_id>` | Specify model to use |
| `--search-key <key>` | Custom search key for illustration (overrides env) |
| `--project-id <id>` | Custom project id for illustration (overrides env) |
| `--list-models` | List available models |
| `--api-key <key>` | API key for custom LLM provider (BYOK) |
| `--provider-url <url>` | Base URL of custom OpenAI-compatible LLM provider (BYOM/BYOK) |
| `--provider-type <type>` | Provider type: openai, azure, or anthropic (default: openai) |
| `--provider-wire-api <format>` | API wire format for openai/azure providers: completions or responses (default: completions) |
| `--help` | Show help |

#### Notes

- For illustration (`--with-illustration`, `--with-illustration-all`), `--search-key` and `--project-id` are required (or set via environment variables `CUSTOM_SEARCH_KEY` and `CUSTOM_SEARCH_PROJECT`).
- Use `--model` to specify the LLM model.
- Use `--provider-url` and `--api-key` to bring your own model/key (BYOM/BYOK). Optionally set `--provider-type` and `--provider-wire-api`.
- Run with `--list-models` to see available models.


### Examples

#### 1. Format transcript and output in Italian
```bash
redacta my_transcript.srt --language italian
```

#### 2. Format transcript and add essential illustrations
```bash
redacta my_transcript.srt --with-illustration
```

#### 3. Full pipeline: All illustrations, blog post, and summary
```bash
redacta my_transcript.srt --with-illustration-all --blog --summary
```

#### 4. Batch process a directory to Spanish
```bash
redacta --directory ./transcripts --with-illustration-all --blog --summary --language spanish
```

#### 5. Use a custom LLM provider (BYOK/BYOM)
```bash
redacta my_transcript.srt --api-key <your_api_key> --provider-url <your_provider_url> --provider-type openai --provider-wire-api completions
```

## Google Custom Search Configuration

To enable image search (`--with-illustration` or `--with-illustration-all`), you need Google Custom Search credentials.

1. **API Key:** Get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. **Search Engine ID (CX):** Get from [Google Custom Search Engine](https://cse.google.com/cse/all).

You can provide these via **Environment Variables** (recommended) or CLI flags.

**Environment Variables:**
- `CUSTOM_SEARCH_KEY`: Your Google API key
- `CUSTOM_SEARCH_PROJECT`: Your Custom Search Engine ID (CX)

**CLI Flags:**
- `--search-key`
- `--project-id`

## Output

Outputs are written as Markdown files in the same directory as the source transcript:
- `*_formatted.md`: The cleaned and formatted transcript (with illustrations if requested).
- `*_blog.md`: Generated blog post (if `--blog` is used).
- `*_summary.md`: Generated summary (if `--summary` is used).

## License
MIT
