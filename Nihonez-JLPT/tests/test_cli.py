from pathlib import Path

import pytest

from nihonez_jlpt.cli import main
from nihonez_jlpt.pipeline import discover_exams, exam_markdown_filename, generate_missing


DATA_DIR = Path(__file__).resolve().parents[1] / ".data"
JULY_NAME = "JLPT N4 Mock Test - July 2025"
IMAGE_NAME = "n4taskbased1_006.webp"


def test_exam_markdown_filename_uses_hyphens() -> None:
    assert (
        exam_markdown_filename("JLPT N4 Mock Test - December 2024")
        == "JLPT-N4-Mock-Test-December-2024.md"
    )


def test_generate_missing_copies_images_and_skips_existing(tmp_path: Path) -> None:
    output_dir = tmp_path / "outputs"

    first = generate_missing(DATA_DIR, output_dir)
    second = generate_missing(DATA_DIR, output_dir)

    assert first.written == ["JLPT N4 Mock Test - December 2024", JULY_NAME]
    assert first.skipped == []
    assert second.written == []
    assert second.skipped == first.written

    july_dir = output_dir / JULY_NAME
    markdown_path = july_dir / exam_markdown_filename(JULY_NAME)
    markdown = markdown_path.read_text(encoding="utf-8")
    assert not (july_dir / "exam.md").exists()
    assert f"media/{IMAGE_NAME}" in markdown
    assert (july_dir / "media" / IMAGE_NAME).is_file()
    assert not list(output_dir.rglob("*.mp3"))


def test_discover_exams_rejects_multiple_html_files(tmp_path: Path) -> None:
    exam_dir = tmp_path / "Exam"
    exam_dir.mkdir()
    (exam_dir / "a.html").write_text("<html></html>", encoding="utf-8")
    (exam_dir / "b.html").write_text("<html></html>", encoding="utf-8")

    with pytest.raises(ValueError, match="Expected exactly one HTML file"):
        discover_exams(tmp_path)


def test_cli_reports_skipped_exams(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    output_dir = tmp_path / "outputs"
    exam_dir = output_dir / "Existing"
    exam_dir.mkdir(parents=True)
    (exam_dir / exam_markdown_filename("Existing")).write_text("# Existing\n", encoding="utf-8")
    data_dir = tmp_path / "data" / "Existing"
    data_dir.mkdir(parents=True)
    (data_dir / "exam.html").write_text("<html><title>Existing</title></html>", encoding="utf-8")

    status = main(["--data-dir", str(data_dir.parent), "--output-dir", str(output_dir)])

    assert status == 0
    assert "Skipped Existing" in capsys.readouterr().out
