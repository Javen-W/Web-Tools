# Nihonez JLPT

Python CLI for capturing Nihonez JLPT test result pages and converting them into printable PDFs.

## Commands

```bash
nihonez-jlpt capture "https://nihonez.com/jlpt-test/..." captured.html --storage-state storage-state.json
nihonez-jlpt render
nihonez-jlpt render "JLPT N4 Mock Test - July 2025"
nihonez-jlpt render "JLPT N4 Mock Test - July 2025" --output-pdf custom-output.pdf
nihonez-jlpt build "https://nihonez.com/jlpt-test/..." output.pdf --storage-state storage-state.json --captured-html captured.html --report-html report.html
```

## Notes

- Saved fixtures live under `Nihonez-JLPT/data/<test-name>/`, with one source HTML file per test directory.
- `render` with no test name renders every test in `data/`.
- `render "<test-name>"` writes `<test-name>.pdf` inside that test directory by default.
- `build` accepts either a Nihonez URL or a local saved results HTML file.
- When given a live URL, the CLI auto-selects answers, submits the test, then renders the result page.
- Nihonez currently shows a login gate on public test URLs, so live capture requires an authenticated Playwright storage-state JSON file.
- Install the Chromium browser once with `python -m playwright install chromium`.
