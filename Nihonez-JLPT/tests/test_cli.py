from pathlib import Path

import pytest

from nihonez_jlpt.cli import _find_test_html, _resolve_render_targets


def test_resolve_render_targets_returns_all_tests(tmp_path: Path) -> None:
    july_dir = tmp_path / "July"
    july_dir.mkdir()
    (july_dir / "fixture.html").write_text("<html></html>", encoding="utf-8")

    december_dir = tmp_path / "December"
    december_dir.mkdir()
    (december_dir / "fixture.html").write_text("<html></html>", encoding="utf-8")

    targets = _resolve_render_targets(tmp_path, None)

    assert [(test_dir.name, html.name) for test_dir, html in targets] == [
        ("December", "fixture.html"),
        ("July", "fixture.html"),
    ]


def test_resolve_render_targets_returns_named_test(tmp_path: Path) -> None:
    july_dir = tmp_path / "JLPT N4 Mock Test - July 2025"
    july_dir.mkdir()
    fixture = july_dir / "JLPT N4 Mock Test – July 2025 - Nihonez.html"
    fixture.write_text("<html></html>", encoding="utf-8")

    targets = _resolve_render_targets(tmp_path, "JLPT N4 Mock Test - July 2025")

    assert targets == [(july_dir.resolve(), fixture.resolve())]


def test_find_test_html_rejects_multiple_html_files(tmp_path: Path) -> None:
    (tmp_path / "a.html").write_text("<html></html>", encoding="utf-8")
    (tmp_path / "b.html").write_text("<html></html>", encoding="utf-8")

    with pytest.raises(ValueError, match="Expected exactly one HTML fixture"):
        _find_test_html(tmp_path)
