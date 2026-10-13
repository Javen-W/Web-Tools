from pathlib import Path

from nihonez_jlpt.parser import parse_exam
from nihonez_jlpt.render import render_exam


DATA_DIR = Path(__file__).resolve().parents[1] / ".data"
JULY_HTML = (
    DATA_DIR
    / "JLPT N4 Mock Test - July 2025"
    / "JLPT N4 Mock Test – July 2025 - Nihonez.html"
)
DECEMBER_HTML = (
    DATA_DIR
    / "JLPT N4 Mock Test - December 2024"
    / "JLPT N4 Mock Test – December 2024 - Nihonez.html"
)


def test_july_exam_extracts_sections_questions_and_listening() -> None:
    exam = parse_exam(JULY_HTML.read_text(encoding="utf-8"))

    assert exam.title == "JLPT N4 Mock Test – July 2025"
    assert [section.title for section in exam.sections] == [
        "げんごちしき（もじ・ごい）",
        "言語知識（文法）・読解",
        "聴解",
    ]
    assert any(
        "Task-based Comprehension" in subsection.title
        for section in exam.sections
        for subsection in section.subsections
    )

    questions = list(exam.iter_questions())
    assert len(questions) == 85

    kanji = questions[0]
    correct = next(choice for choice in kanji.choices if choice.correct)
    assert "あつめて" in correct.html

    assert any(question.number == "18" for question in questions)
    assert any("病院" in question.transcript_html for question in questions)
    assert any("n4taskbased1_006.webp" in question.images_html for question in questions)


def test_july_markdown_includes_answer_transcript_and_image(tmp_path: Path) -> None:
    exam = parse_exam(JULY_HTML.read_text(encoding="utf-8"))
    markdown = render_exam(exam, source_html=JULY_HTML, media_dir=tmp_path / "media")

    assert "#### Question 1" in markdown
    assert "**あつめて**" in markdown
    assert "**Correct answer:** 3. あつめて" in markdown
    assert "<u>集めて</u>" in markdown
    assert "病院（びょういん）" in markdown
    assert "#### Question 18" in markdown
    assert "![n4taskbased1](media/n4taskbased1_006.webp)" in markdown
    assert "美（び）術（じゅつ）館" in markdown
    assert "1. やめて (yamete) means \"stop it\" (from 止める/辞める).\n2. きめて" in markdown
    assert "Main Notice Paper" not in markdown
    assert "Points:" not in markdown
    assert "My Notes" not in markdown
    assert (tmp_path / "media" / "n4taskbased1_006.webp").is_file()
    assert not list(tmp_path.rglob("*.mp3"))


def test_december_exam_extracts_every_question() -> None:
    exam = parse_exam(DECEMBER_HTML.read_text(encoding="utf-8"))

    assert exam.title == "JLPT N4 Mock Test – December 2024"
    assert len(list(exam.iter_questions())) == 85
