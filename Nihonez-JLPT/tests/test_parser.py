from pathlib import Path

from nihonez_jlpt.parser import parse_result_document
from nihonez_jlpt.render import render_report_html


FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "JLPT N4 Mock Test - July 2025"
    / "JLPT N4 Mock Test – July 2025 - Nihonez.html"
)


def test_parse_result_document_extracts_sections() -> None:
    html = FIXTURE.read_text(encoding="utf-8")

    document = parse_result_document(
        html,
        source_label=str(FIXTURE),
        source_path=FIXTURE,
    )

    titles = [section.title for section in document.sections]
    assert titles == ["げんごちしき（もじ・ごい）", "言語知識（文法）・読解", "聴解"]
    assert any(
        "Task-based Comprehension" in subsection.title
        for section in document.sections
        for subsection in section.subsections
    )


def test_render_report_html_includes_key_result_content() -> None:
    html = FIXTURE.read_text(encoding="utf-8")
    document = parse_result_document(
        html,
        source_label=str(FIXTURE),
        source_path=FIXTURE,
    )

    report_html = render_report_html(document)

    assert "Correct Answer" in report_html
    assert "Question Translation" in report_html
    assert "下の" in report_html
    assert "Visual reference" in report_html
    assert "n4taskbase3" in report_html
    assert "Audio reference" not in report_html
    assert "file://" in report_html
