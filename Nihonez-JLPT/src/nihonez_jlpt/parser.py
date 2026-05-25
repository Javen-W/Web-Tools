from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
import re
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
    replace_question_images = title == "聴解"

    for subsection_node in section_node.find_all("div", class_="test-subsection", recursive=False):
        subsections.append(
            _parse_subsection(
                subsection_node,
                resolver,
                subsection_titles,
                replace_question_images=replace_question_images,
            )
        )

    return ReportSection(title=title, subsections=subsections)


def _parse_subsection(
    subsection_node: Tag,
    resolver: Callable[[str], str],
    subsection_titles: dict[str, str],
    *,
    replace_question_images: bool,
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
            items.extend(
                _parse_passage_question_group(
                    child,
                    resolver,
                    replace_question_images=replace_question_images,
                )
            )
        elif "question-container" in classes:
            items.append(
                ReportItem(
                    kind="question",
                    html=_clean_question_html(
                        child,
                        resolver,
                        replace_question_images=replace_question_images,
                    ),
                )
            )
        elif "jlpt-passages-wrapper" in classes:
            items.append(ReportItem(kind="passage", html=_clean_passage_html(child, resolver)))

    return ReportSubsection(title=title, items=items)


def _parse_passage_question_group(
    group_node: Tag,
    resolver: Callable[[str], str],
    *,
    replace_question_images: bool,
) -> list[ReportItem]:
    items: list[ReportItem] = []

    for child in group_node.children:
        if isinstance(child, NavigableString):
            continue
        classes = set(child.get("class", []))
        if "jlpt-passages-wrapper" in classes:
            items.append(ReportItem(kind="passage", html=_clean_passage_html(child, resolver)))
        elif "question-container" in classes:
            items.append(
                ReportItem(
                    kind="question",
                    html=_clean_question_html(
                        child,
                        resolver,
                        replace_question_images=replace_question_images,
                    ),
                )
            )

    return items


def _clean_passage_html(node: Tag, resolver: Callable[[str], str]) -> str:
    fragment = _clone_tag(node)
    for controls in fragment.select(".passage-controls"):
        controls.decompose()
    for constrained in fragment.select(".jlpt-passages, .passage"):
        if constrained.has_attr("style"):
            constrained["style"] = _strip_style_properties(
                constrained["style"],
                {"height", "max-height", "min-height", "overflow"},
            )
            if not constrained["style"]:
                del constrained["style"]
    _resolve_assets(fragment, resolver)
    return str(fragment)


def _build_instruction_html(node: Tag) -> str:
    fragment = _clone_tag(node)
    fragment.name = "div"
    fragment["class"] = ["subsection-instructions"]
    return str(fragment)


def _clean_question_html(
    node: Tag,
    resolver: Callable[[str], str],
    *,
    replace_question_images: bool,
) -> str:
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

    if replace_question_images:
        for question_images in fragment.select(".question-images"):
            question_images.replace_with(
                BeautifulSoup(
                    _build_question_image_label_html(question_images),
                    "html.parser",
                ).find()
            )

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


def _strip_style_properties(style_value: str, blocked_properties: set[str]) -> str:
    kept_rules: list[str] = []
    for raw_rule in style_value.split(";"):
        rule = raw_rule.strip()
        if not rule or ":" not in rule:
            continue
        property_name, property_value = rule.split(":", 1)
        if property_name.strip().lower() in blocked_properties:
            continue
        kept_rules.append(f"{property_name.strip()}: {property_value.strip()}")
    return "; ".join(kept_rules)


def _build_question_image_label_html(question_images: Tag) -> str:
    labels = [_extract_image_label(image) for image in question_images.select("img")]
    labels = [label for label in labels if label]
    if not labels:
        return '<div class="question-image-labels"><div class="question-image-label">Visual reference</div></div>'

    labels_markup = "".join(
        f'<div class="question-image-label">{label}</div>'
        for label in labels
    )
    return (
        '<div class="question-image-labels">'
        '<div class="question-image-labels-title">Visual reference</div>'
        f"{labels_markup}"
        "</div>"
    )


def _extract_image_label(image: Tag) -> str:
    for attribute in ("data-image-title", "alt"):
        value = image.get(attribute, "").strip()
        if value:
            return value

    source = image.get("src", "").strip()
    if not source:
        return ""

    filename = Path(unquote(source.split("?", 1)[0].split("#", 1)[0])).stem
    return re.sub(r"_\d+$", "", filename)


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
