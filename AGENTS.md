# AGENTS

- The first subproject lives in `Nihonez-JLPT/` as an installable Python package named `nihonez-jlpt`.
- Use the repository-root `environment.yml` and `requirements.txt` to set up the workspace before running the CLI or tests.
- Saved Nihonez results HTML lives in `Nihonez-JLPT/.data/<test-name>/`. Each test directory contains one source HTML file plus its assets.
- Generate markdown exams with `Nihonez-JLPT/generate_exams.ipynb`, or `python -m nihonez_jlpt`. The pipeline writes `Nihonez-JLPT/outputs/<test-name>/<Test-Name>.md` (spaces become hyphens, so `JLPT N4 Mock Test - July 2025` is `JLPT-N4-Mock-Test-July-2025.md`) and copies referenced images into `media/`. Exams that already have that markdown file are skipped. Audio files are not copied; listening sections include transcripts only.
- Run `pytest` from the repository root for the current automated test coverage.
