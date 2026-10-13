# Nihonez JLPT

Turn saved Nihonez JLPT exam pages into markdown.

## Layout

- `.data/<exam-name>/` holds one saved results HTML file and its downloaded assets.
- `outputs/<exam-name>/<Exam-Name>.md` is the generated exam. Spaces become hyphens, so `JLPT N4 Mock Test - July 2025` is written as `JLPT-N4-Mock-Test-July-2025.md`.
- `outputs/<exam-name>/media/` holds the images that exam references.

Listening sections include transcripts. Audio files are not copied.

## Generate

Open [`generate_exams.ipynb`](generate_exams.ipynb) and run it. The notebook writes markdown for every exam in `.data/` that does not already have its markdown file under `outputs/<exam-name>/`.

The same pipeline can be run from a terminal:

```bash
python -m nihonez_jlpt
```

Delete an exam's markdown file to generate it again.

See [`docs/generating-exams.md`](docs/generating-exams.md) for the saved-HTML layout and [`docs/markdown-format.md`](docs/markdown-format.md) for how a generated exam is structured.

## Tests

From the repository root:

```bash
pytest
```
