# AGENTS

- The first subproject lives in `Nihonez-JLPT/` as an installable Python package named `nihonez-jlpt`.
- Use the repository-root `environment.yml` and `requirements.txt` to set up the workspace before running the CLI or tests.
- Install the Playwright Chromium browser with `python -m playwright install chromium` before generating PDFs from the CLI.
- Use `Nihonez-JLPT/example_html/` for parser and renderer changes; it contains a downloaded Nihonez results page with passages, explanations, and listening content.
- Live Nihonez capture currently requires login; pass a Playwright storage-state JSON file to the CLI for authenticated scraping, or work from the saved example HTML.
- Run `pytest` from the repository root for the current automated test coverage.
