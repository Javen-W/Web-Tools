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
nihonez-jlpt render "Nihonez-JLPT/example_html/JLPT N4 Mock Test – July 2025 - Nihonez.html" output.pdf
nihonez-jlpt build "https://nihonez.com/jlpt-test/jlpt-n4-past-test-july-2025-real-exam/?start=test" output.pdf --storage-state storage-state.json --captured-html captured.html --report-html report.html
```

Nihonez now gates live tests behind login, so authenticated live capture should be run with a saved Playwright storage-state JSON file. The included sample HTML can still be rendered locally without login.
