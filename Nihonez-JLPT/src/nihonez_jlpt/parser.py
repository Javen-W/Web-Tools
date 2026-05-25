from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from html import escape
from pathlib import Path
from urllib.parse import unquote, urljoin

from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag

from nihonez_jlpt.models import ReportDocument, ReportItem, ReportSection, ReportSubsection


def parse_result_document(
    html: str,
    *,
    source_label: str,
    base_url: str | None = None,
    source_path: Path | None = None,
) -> ReportDocument:
    soup = BeautifulSoup(html, "html.parser")
    form = soup.select_one("#test-form")
    if form is None:
        raise ValueError("Could not find the Nihonez test form in the provided HTML.")

    resolver = _build_asset_resolver(base_url=base_url, source_path=source_path)
    subsection_titles = _extract_sidebar_subsection_titles(soup)
    sections: list[ReportSection] = []

    for section_node in form.find_all("div", class_="test-section", recursive=False):
        sections.append(_parse_section(section_node, resolver, subsection_titles))

    if not sections:
        raise ValueError("No test sections were found in the provided Nihonez results page.")

    title = soup.title.get_text(strip=True) if soup.title else source_label
    description_node = soup.find("meta", attrs={"name": "description"})
    description = description_node.get("content", "").strip() if description_node else ""
    generated_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")

    return ReportDocument(
        title=title,
        description=description,
        source_label=source_label,
        generated_at=generated_at,
        sections=sections,
    )


def _parse_section(
    section_node: Tag,
    resolver: Callable[[str], str],
    subsection_titles: dict[str, str],
) -> ReportSection:
    title_node = section_node.select_one(".test-section-title h2")
    title = title_node.get_text(" ", strip=True) if title_node else "Untitled Section"
    subsections: list[ReportSubsection] = []

    for subsection_node in section_node.find_all("div", class_="test-subsection", recursive=False):
        subsections.append(_parse_subsection(subsection_node, resolver, subsection_titles))

    return ReportSection(title=title, subsections=subsections)


def _parse_subsection(
    subsection_node: Tag,
    resolver: Callable[[str], str],
    subsection_titles: dict[str, str],
) -> ReportSubsection:
    subsection_id = subsection_node.get("id", "")
    title_node = subsection_node.find("h3", recursive=False)
    instruction_title = title_node.get_text(" ", strip=True) if title_node else "Untitled Subsection"
    title = subsection_titles.get(subsection_id, instruction_title)
    items: list[ReportItem] = []

    if title_node is not None and instruction_title != title:
        items.append(ReportItem(kind="intro", html=_build_instruction_html(title_node)))

    for child in subsection_node.children:
        if isinstance(child, NavigableString):
            continue
        if child.name == "h3":
            continue

        classes = set(child.get("class", []))
        if "passage-question-group" in classes:
            items.extend(_parse_passage_question_group(child, resolver))
        elif "question-container" in classes:
            items.append(ReportItem(kind="question", html=_clean_question_html(child, resolver)))
        elif "jlpt-passages-wrapper" in classes:
            items.append(ReportItem(kind="passage", html=_clean_passage_html(child, resolver)))
        elif "audio-player-container" in classes:
            items.append(ReportItem(kind="audio", html=_build_audio_reference_html(child, resolver)))

    return ReportSubsection(title=title, items=items)


def _parse_passage_question_group(group_node: Tag, resolver: Callable[[str], str]) -> list[ReportItem]:
    items: list[ReportItem] = []

    for child in group_node.children:
        if isinstance(child, NavigableString):
            continue
        classes = set(child.get("class", []))
        if "jlpt-passages-wrapper" in classes:
            items.append(ReportItem(kind="passage", html=_clean_passage_html(child, resolver)))
        elif "question-container" in classes:
            items.append(ReportItem(kind="question", html=_clean_question_html(child, resolver)))

    return items


def _clean_passage_html(node: Tag, resolver: Callable[[str], str]) -> str:
    fragment = _clone_tag(node)
    for controls in fragment.select(".passage-controls"):
        controls.decompose()
    _resolve_assets(fragment, resolver)
    return str(fragment)


def _build_instruction_html(node: Tag) -> str:
    fragment = _clone_tag(node)
    fragment.name = "div"
    fragment["class"] = ["subsection-instructions"]
    return str(fragment)


def _build_audio_reference_html(node: Tag, resolver: Callable[[str], str]) -> str:
    fragment = _clone_tag(node)
    urls = []
    for source in fragment.select("source[src]"):
        urls.append(resolver(source["src"]))

    if not urls:
        return '<div class="audio-reference"><p>No audio source was found for this subsection.</p></div>'

    items = "".join(
        f'<li><a href="{escape(url)}">{escape(url)}</a></li>'
        for url in urls
    )
    return (
        '<div class="audio-reference">'
        "<strong>Audio reference</strong>"
        "<p>The printable PDF cannot embed playable audio, so the original track links are included below.</p>"
        f"<ul>{items}</ul>"
        "</div>"
    )


def _clean_question_html(node: Tag, resolver: Callable[[str], str]) -> str:
    fragment = _clone_tag(node)

    for removable in fragment.select(
        "button.report-question-btn, .question-notes-wrapper, .nihonez-notes-panel, "
        ".nihonez-notes-list, .nihonez-notes-empty"
    ):
        removable.decompose()

    for input_node in fragment.select("input"):
        input_node.decompose()

    for choice in fragment.select(".answer-choice"):
        choice.name = "div"
        choice.attrs.pop("for", None)

    for collapse_button in fragment.select(".collapse-button"):
        collapse_button.decompose()

    for expandable in fragment.select(".listening-script, .explanation, .question-notes"):
        classes = [name for name in expandable.get("class", []) if name != "collapsed"]
        if "expanded" not in classes:
            classes.append("expanded")
        expandable["class"] = classes

    for wrapper in fragment.select(".answer-wrapper"):
        wrapper.attrs.pop("style", None)

    for listening_wrapper in fragment.select(".listening-script-wrapper"):
        script_node = listening_wrapper.select_one(".listening-script")
        if script_node is None or not script_node.get_text(" ", strip=True):
            listening_wrapper.decompose()

    _resolve_assets(fragment, resolver)
    return str(fragment)


def _clone_tag(node: Tag) -> Tag:
    cloned = BeautifulSoup(str(node), "html.parser")
    first = cloned.find()
    if first is None:
        raise ValueError("Failed to clone HTML fragment.")
    return first


def _resolve_assets(node: Tag, resolver: Callable[[str], str]) -> None:
    for element in node.find_all(src=True):
        element["src"] = resolver(element["src"])
        if element.name == "img":
            element.attrs.pop("srcset", None)
            element.attrs.pop("sizes", None)

    for element in node.find_all(href=True):
        element["href"] = resolver(element["href"])


def _build_asset_resolver(
    *,
    base_url: str | None,
    source_path: Path | None,
) -> Callable[[str], str]:
    if base_url:
        return lambda raw_url: _resolve_remote_url(raw_url, base_url)
    if source_path:
        return lambda raw_url: _resolve_local_path(raw_url, source_path)
    return lambda raw_url: raw_url


def _resolve_remote_url(raw_url: str, base_url: str) -> str:
    if raw_url.startswith(("http://", "https://", "file://", "data:")):
        return raw_url
    return urljoin(base_url, raw_url)


def _resolve_local_path(raw_url: str, source_path: Path) -> str:
    if raw_url.startswith(("http://", "https://", "file://", "data:")):
        return raw_url
    clean_path = unquote(raw_url.split("?", 1)[0].split("#", 1)[0])
    return (source_path.parent / clean_path).resolve().as_uri()


def _extract_sidebar_subsection_titles(soup: BeautifulSoup) -> dict[str, str]:
    titles: dict[str, str] = {}
    sidebar_sections = soup.select(".test-structure .section[data-section-index]")

    for section in sidebar_sections:
        section_index = section.get("data-section-index")
        if section_index is None:
            continue

        subsection_nodes = section.select(".subsection-sidebar-container .subsection")
        for subsection_index, subsection_node in enumerate(subsection_nodes):
            title_node = subsection_node.select_one(".sidebar-subsection-title")
            if title_node is None:
                continue

            title = title_node.get_text(" ", strip=True)
            titles[f"subsection-{section_index}-{subsection_index}"] = title

    return titles
