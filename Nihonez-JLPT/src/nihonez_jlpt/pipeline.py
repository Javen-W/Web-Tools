from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re

from nihonez_jlpt.parser import parse_exam
from nihonez_jlpt.render import render_exam


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = PROJECT_ROOT / ".data"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "outputs"


@dataclass(slots=True)
class ExamSource:
    name: str
    html_path: Path


@dataclass(slots=True)
class GenerateResult:
    written: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def exam_markdown_filename(exam_name: str) -> str:
    """Name the markdown file after the exam, with hyphens between words.

    Spaces become hyphens and a spaced dash such as `` - `` collapses, so
    ``JLPT N4 Mock Test - July 2025`` becomes
    ``JLPT-N4-Mock-Test-July-2025.md``.
    """
    slug = re.sub(r"\s+", "-", exam_name.strip())
    slug = re.sub(r"-{2,}", "-", slug)
    return f"{slug}.md"


def discover_exams(data_dir: Path) -> list[ExamSource]:
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    exams: list[ExamSource] = []
    for exam_dir in sorted(path for path in data_dir.iterdir() if path.is_dir()):
        html_files = sorted(path for path in exam_dir.glob("*.html") if path.is_file())
        if not html_files:
            continue
        if len(html_files) != 1:
            names = ", ".join(path.name for path in html_files)
            raise ValueError(f"Expected exactly one HTML file in {exam_dir.name}, found: {names}")
        exams.append(ExamSource(name=exam_dir.name, html_path=html_files[0]))
    return exams


def generate_missing(
    data_dir: Path | None = None,
    output_dir: Path | None = None,
) -> GenerateResult:
    data_dir = data_dir if data_dir is not None else DEFAULT_DATA_DIR
    output_dir = output_dir if output_dir is not None else DEFAULT_OUTPUT_DIR
    result = GenerateResult()

    for source in discover_exams(data_dir):
        markdown_path = output_dir / source.name / exam_markdown_filename(source.name)
        if markdown_path.exists():
            result.skipped.append(source.name)
            continue

        exam = parse_exam(source.html_path.read_text(encoding="utf-8"))
        markdown_path.parent.mkdir(parents=True, exist_ok=True)
        markdown = render_exam(
            exam,
            source_html=source.html_path,
            media_dir=markdown_path.parent / "media",
        )
        markdown_path.write_text(markdown, encoding="utf-8")
        result.written.append(source.name)

    return result
