# Changelog

## [2.0.0] — BREAKING CHANGE

### Added
- **Pluggable LLM transport layer** via the new `LLMAdapter` interface.
- `createFetchClient(config)` — browser-safe adapter using direct `fetch` calls. Supports OpenAI, Gemini, Anthropic, and HuggingFace. Zero Node.js dependencies; works in Chrome extensions and any browser environment.
- `createCopilotClient(config?)` — Node.js adapter wrapping `@github/copilot-sdk`. Uses a dynamic `import()` so bundlers targeting browsers never pull in Node.js-only code.
- `index.node.ts` entry point that re-exports everything from `index.ts` plus `createCopilotClient`.

### Changed (BREAKING)
- All high-level functions now accept an `LLMAdapter` instead of `(model, provider?, onUpdate?)`:
  ```ts
  // v1
  formatTranscript(transcript, language, model, provider?, onUpdate?)
  // v2
  formatTranscript(transcript, language, model, adapter, onUpdate?)
  ```
- `enrichMarkdown` parameter order changed — `adapter` replaces `provider` (same position):
  ```ts
  // v1
  enrichMarkdown(markdown, searchKey, engineId, model, provider?, mode?, onUpdate?)
  // v2
  enrichMarkdown(markdown, searchKey, engineId, model, adapter, mode?, onUpdate?)
  ```

### Removed
- `callLLM` function (replaced by `adapter.call`)
- `listModels` standalone function (replaced by `adapter.listModels()`)
- `LLMProviderConfig` type (replaced by `CopilotProviderConfig` for copilot-sdk usage)

### Migration guide (v1 → v2)

**CLI / Node.js** — create a copilot adapter once, pass it everywhere:
```ts
import { createCopilotClient, formatTranscript } from 'redacta/index.node.js';
const adapter = await createCopilotClient({ provider: { baseUrl, apiKey } });
const result = await formatTranscript(transcript, language, model, adapter);
```

**Browser / Chrome extension** — use the fetch adapter:
```ts
import { createFetchClient, formatTranscript } from 'redacta';
const adapter = createFetchClient({ provider: 'openai', apiKey: 'sk-...' });
const result = await formatTranscript(transcript, language, model, adapter);
```



### Fixed
- Build now generates `dist/index.js` by compiling TypeScript before bundling the CLI output.
- `package.json` `bin`, `main`, and `exports` fields now point to `dist/` (was incorrectly pointing to `dist/bin/` after the `outDir` change). Added `exports` map for `redacta` and `redacta/index.node.js` subpath imports.
- TUI status lines were duplicating during processing (e.g. 30× "✔ Formatting transcript"). Root cause: high-level functions were forwarding their `onUpdate` into `adapter.call()`, causing a TUI rerender on every streaming token. Fixed by not passing `onUpdate` to individual `adapter.call()` invocations inside `editor.ts`, `blogger.ts`, `summarizer.ts`, and `illustrator.ts`.
- Suppressed the `ExperimentalWarning: SQLite is an experimental feature` message in the CLI. The warning is emitted by `undici` (a transitive dependency of `@github/copilot-sdk`) when it probes `node:sqlite` at load time. The warning is now intercepted and discarded before it reaches stderr.

## [1.1.0]

### Added
- BYOM/BYOK support: allows using custom models and API keys via `--provider-url`, `--api-key`, `--provider-type`, and `--provider-wire-api`.
- `--list-models` option to list available models from the configured provider.
- New examples and documentation for art analysis and LLM talk processing.
- CLI: options for illustrations (`--with-illustration`, `--with-illustration-all`), blog generation (`--blog`), summary (`--summary`), language (`--language`), and directory batch processing (`--directory`).
- Support for environment variables and CLI arguments for Google Custom Search (`--search-key`, `--project-id`).
- Improved TUI interface to show progress and final status.

### Changed
- Refactor: centralized LLM provider configuration in `LLMProviderConfig`.
- Improved error handling and robust JSON parsing for LLM output.
- Complete migration of source code to TypeScript.
- Expanded and updated documentation to reflect new options and examples.

### Fixed
- Fixed TUI final display to correctly show 'Done' status.
- Test cleanup and proper resource handling in tests.

## [1.0.0]

### Initial
- Core functionality: blog, summary, and enriched document generation from transcripts.
- Multilingual support, image search, ASCII diagrams, and batch processing.
