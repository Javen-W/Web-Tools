# Generating exams

Saved Nihonez results pages in `.data/` become markdown exams in `outputs/`. The notebook [`generate_exams.ipynb`](../generate_exams.ipynb) and `python -m nihonez_jlpt` call the same function. Paths are resolved from the `Nihonez-JLPT/` package root, so the notebook kernel's working directory does not matter.

## Save a results page

Each exam is one immediate subdirectory of `.data/` with exactly one top-level HTML file. Nested files, including HTML inside a browser `_files/` folder, are ignored.

```text
.data/JLPT N4 Mock Test - December 2024/
  JLPT N4 Mock Test – December 2024 - Nihonez.html
  JLPT N4 Mock Test – December 2024 - Nihonez_files/
```

The directory name is the exam name. It is reused for the output directory and, after spaces are replaced, for the markdown filename. Keep the downloaded asset folder next to the HTML file so question images can be copied.

A directory with no top-level HTML file is skipped. A directory with more than one top-level HTML file stops the run.

## Run

From an environment where `nihonez-jlpt` is installed:

```bash
python -m nihonez_jlpt
```

Optional paths override the defaults `.data/` and `outputs/`:

```bash
python -m nihonez_jlpt --data-dir .data --output-dir outputs
```

An exam is skipped when its markdown file already exists. Delete that file to regenerate it. Images already present in `media/` are reused when the bytes match.

## Output layout

The output directory keeps the exam directory's name, spaces included. The markdown file does not:

```text
outputs/JLPT N4 Mock Test - December 2024/
  JLPT-N4-Mock-Test-December-2024.md
  media/
```

`JLPT N4 Mock Test - December 2024` becomes `JLPT-N4-Mock-Test-December-2024.md`. Spaces become hyphens, and the spaced dash in the exam name collapses into one hyphen.

`media/` contains only image files the exam markdown actually references. Logos, stylesheets, `srcset` variants, and `.mp3` audio are left out. Listening questions keep their transcripts in the markdown instead.
