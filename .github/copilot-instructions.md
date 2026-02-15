# Copilot Instructions for Redacta

## Build, Test, and Lint Commands

- **Install dependencies:**
  ```bash
  npm install
  ```
- **Build step:** No explicit build step is required; this is a Node.js CLI tool.
- **Test command:**
  ```bash
  npm test
  ```
  (Note: No tests are currently implemented; this command will exit with an error.)
- **Lint command:** No lint script is defined in package.json.

## Running Redacta

- **Single file:**
  ```bash
  redacta <transcript_file> [options]
  ```
- **Batch directory:**
  ```bash
  redacta --directory <path_to_directory> [options]
  ```
- **Common options:**
  - `--blog` — Generate a blog post
  - `--summary` — Generate a summary
  - `--language=<lang>` — Output language
  - `--with-illustration` — Add essential illustrations
  - `--with-illustration-all` — Add comprehensive illustrations
  - `--model=<model_id>` — Specify LLM model (default: gpt-4.1)
  - `--search-key` and `--project-id` — Google Custom Search credentials (can also be set as env vars)

## High-Level Architecture

- **CLI entrypoint:** `src/cli.js` parses arguments and orchestrates the pipeline.
- **Pipeline steps:**
  1. **Format transcript** (`formatTranscript` in `editor.js`): Cleans and chunks transcript, applies LLM formatting.
  2. **Enrich with illustrations** (`enrichMarkdown` in `illustrator.js`): Adds images/diagrams using Google Custom Search and LLMs.
  3. **Generate blog post** (`generateBlogPost` in `blogger.js`): Produces a structured blog post from the formatted/enriched transcript.
  4. **Generate summary** (`generateSummary` in `summarizer.js`): Produces a summary from the formatted/enriched transcript.
- **Interactive TUI:** Progress is displayed using Ink-based TUI (`ProgressTUI.js`).
- **Outputs:** Markdown files are written alongside the input transcript, suffixed with `_formatted.md`, `_blog.md`, or `_summary.md`.

## Key Conventions

- **Environment variables:**
  - `CUSTOM_SEARCH_KEY` and `CUSTOM_SEARCH_PROJECT` are required for illustration features if not provided via CLI.
- **LLM Model selection:**
  - Use `--model` or set `MODEL` env var to override the default model.
- **Chunking:**
  - All LLM operations process text in chunks for reliability and scalability.
- **Error handling:**
  - If LLM output cannot be parsed, the original chunk is used as fallback.
- **Extensibility:**
  - New pipeline steps can be added by following the modular pattern in `src/cli.js`.

---

Would you like to configure any MCP servers (e.g., for Playwright or other integrations) for this project?

Summary: Created a .github/copilot-instructions.md with build/run instructions, architecture, and conventions. Let me know if you want to adjust or expand coverage.