# AGENTS

- The first subproject lives in `Nihonez-JLPT/` as an installable Python package named `nihonez-jlpt`.
- Use the repository-root `environment.yml` and `requirements.txt` to set up the workspace before running the CLI or tests.
- Install the Playwright Chromium browser with `python -m playwright install chromium` before generating PDFs from the CLI.
- Use `Nihonez-JLPT/data/<test-name>/` for parser and renderer changes; each test directory contains one downloaded Nihonez results HTML file plus its assets.
- Live Nihonez capture currently requires login; pass a Playwright storage-state JSON file to the CLI for authenticated scraping, or work from the saved HTML fixtures in `data/`.
- Run `pytest` from the repository root for the current automated test coverage.
