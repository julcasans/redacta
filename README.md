# Redacta

## Overview

Redacta is a CLI tool for generating blog posts, summaries, and enriched documents from video transcripts. It supports multilingual output, image search, and concept illustrations (including ASCII diagrams).

Redacta leverages `@github/copilot-sdk` for LLM-powered text generation and `ink` for an interactive terminal UI.

## Features

- Generate blog posts and summaries from transcript files (.srt)
- Multilingual support (specify output language)
- Add illustrations: image search and ASCII diagrams to explain concepts
- Outputs in Markdown format with embedded images and diagrams
- Batch processing: Process all `.srt` files in a directory
- Interactive progress display (TUI)

## Requirements

- **GitHub Copilot**: You must have access to GitHub Copilot and an authenticated environment. Redacta uses the Copilot SDK to interact with LLMs.
- **Node.js**: (v18+ recommended)
- **Google Custom Search API key and Search Engine ID**: Required for image search features (`--with-illustration`).

## Installation

Install package:
	```bash
	npm install -g redacta
	```
### GitHub Copilot Setup

Redacta requires an authenticated GitHub Copilot environment.

1. **Install GitHub CLI (`gh`) and Copilot extension**:
   Follow the official guide: [Installing GitHub Copilot in the CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli/installing-github-copilot-in-the-cli)

2. **Authenticate**:
   Run `gh auth login` and ensure you grant access to GitHub Copilot.


## Usage

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
