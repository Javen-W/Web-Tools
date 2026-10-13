# Nihonez JLPT

Turn saved Nihonez JLPT exam pages into markdown.

## Layout

- `.data/<exam-name>/` holds one saved results HTML file and its downloaded assets.
- `outputs/<exam-name>/exam.md` is the generated exam.
- `outputs/<exam-name>/media/` holds the images that exam references.

Listening sections include transcripts. Audio files are not copied.

## Generate

Open [`generate_exams.ipynb`](generate_exams.ipynb) and run it. The notebook writes markdown for every exam in `.data/` that does not already have `outputs/<exam-name>/exam.md`.

The same pipeline can be run from a terminal:

```bash
python -m nihonez_jlpt
```

Delete an exam's `exam.md` to generate it again.

## Tests

From the repository root:

```bash
pytest
```
