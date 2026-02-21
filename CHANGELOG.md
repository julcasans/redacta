# Changelog

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