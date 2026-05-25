# Website-Tools

A tool repository for misc. website functions.

## Python setup

This repository now includes a Python subproject for converting Nihonez JLPT tests into printable PDFs.

```bash
conda env create -f environment.yml
conda activate web-tools
python -m pip install -r requirements.txt
python -m playwright install chromium
```

## Nihonez JLPT CLI

The `Nihonez-JLPT/` subproject provides the `nihonez-jlpt` CLI.

```bash
nihonez-jlpt render
nihonez-jlpt render "JLPT N4 Mock Test - July 2025"
nihonez-jlpt build "https://nihonez.com/jlpt-test/jlpt-n4-past-test-july-2025-real-exam/?start=test" output.pdf --storage-state storage-state.json --captured-html captured.html --report-html report.html
```

`render` now uses `Nihonez-JLPT/data/<test-name>/` by default. With no test name it renders all saved tests, and with a test name it writes a same-named PDF into that test directory unless you override `--output-pdf`.

Nihonez now gates live tests behind login, so authenticated live capture should be run with a saved Playwright storage-state JSON file. The included saved HTML fixtures can still be rendered locally without login.
