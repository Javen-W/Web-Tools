from __future__ import annotations

import re

from bs4 import BeautifulSoup
from bs4.element import Tag

from nihonez_jlpt.models import Choice, Exam, PassageGroup, Question, Section, Subsection


def parse_exam(html: str) -> Exam:
    soup = BeautifulSoup(html, "html.parser")
    form = soup.select_one("#test-form")
    if form is None:
        raise ValueError("Could not find the Nihonez test form in the provided HTML.")

    subsection_titles = _extract_sidebar_subsection_titles(soup)
    sections = [
        _parse_section(section_node, subsection_titles)
        for section_node in form.find_all("div", class_="test-section", recursive=False)
    ]
    if not sections:
        raise ValueError("No test sections were found in the provided Nihonez results page.")

    raw_title = soup.title.get_text(strip=True) if soup.title else "JLPT exam"
    title = re.sub(r"\s*-\s*Nihonez\s*$", "", raw_title).strip() or raw_title
    return Exam(title=title, sections=sections)


def _parse_section(section_node: Tag, subsection_titles: dict[str, str]) -> Section:
    title_node = section_node.select_one(".test-section-title h2")
    title = title_node.get_text(" ", strip=True) if title_node else "Untitled Section"
    subsections = [
        _parse_subsection(subsection_node, subsection_titles)
        for subsection_node in section_node.find_all("div", class_="test-subsection", recursive=False)
    ]
    return Section(title=title, subsections=subsections)


def _parse_subsection(subsection_node: Tag, subsection_titles: dict[str, str]) -> Subsection:
    subsection_id = str(subsection_node.get("id", ""))
    title_node = subsection_node.find("h3", recursive=False)
    instruction_html = _inner_html(title_node) if title_node else ""
    instruction_text = title_node.get_text(" ", strip=True) if title_node else ""
    title = subsection_titles.get(subsection_id, instruction_text or "Untitled Subsection")
    blocks: list[Question | PassageGroup] = []

    for child in subsection_node.children:
        if not isinstance(child, Tag):
            continue
        classes = set(child.get("class", []))
        if "passage-question-group" in classes:
            blocks.append(_parse_passage_group(child))
        elif "question-container" in classes:
            blocks.append(_parse_question(child))
        elif "jlpt-passages-wrapper" in classes:
            blocks.append(
                PassageGroup(
                    passage_html=_passage_html(child),
                    translation_html="",
                    questions=[],
                )
            )

    return Subsection(title=title, instruction_html=instruction_html, blocks=blocks)


def _parse_passage_group(group_node: Tag) -> PassageGroup:
    wrapper = group_node.select_one(".jlpt-passages-wrapper")
    questions_root = group_node.select_one(".questions-under-passage")
    if questions_root is not None:
        question_nodes = questions_root.select(".question-container")
    else:
        question_nodes = [
            child
            for child in group_node.find_all("div", class_="question-container", recursive=False)
        ]

    return PassageGroup(
        passage_html=_passage_html(wrapper) if wrapper else "",
        translation_html=_translation_html(group_node.select_one(".passage-translation")),
        questions=[_parse_question(node) for node in question_nodes],
    )


def _parse_question(node: Tag) -> Question:
    order_node = node.select_one(".question-order")
    number = order_node.get_text(strip=True) if order_node else ""
    stem = node.select_one(".question-content")
    script = node.select_one(".listening-script")
    explanation = node.select_one(".explanation")
    transcript_html = ""
    if script is not None and script.get_text(strip=True):
        transcript_html = _inner_html(script)
    explanation_html = str(explanation) if explanation is not None and explanation.get_text(strip=True) else ""

    return Question(
        number=number,
        stem_html=_inner_html(stem) if stem else "",
        images_html="".join(str(image) for image in node.select(".question-images img")),
        choices=[_parse_choice(choice) for choice in node.select(".answer-choice")],
        transcript_html=transcript_html,
        explanation_html=explanation_html,
    )


def _parse_choice(node: Tag) -> Choice:
    order_node = node.select_one(".answer-order")
    number = order_node.get_text("", strip=True).rstrip(".").strip() if order_node else ""
    text_node = node.select_one(".choice-text-furigana")
    return Choice(
        number=number,
        html=_inner_html(text_node) if text_node else "",
        correct="correct-answer" in node.get("class", []),
    )


def _passage_html(wrapper: Tag) -> str:
    fragment = BeautifulSoup(str(wrapper), "html.parser").find()
    if fragment is None:
        return ""
    for controls in fragment.select(".passage-controls"):
        controls.decompose()
    content = fragment.select_one(".jlpt-passages") or fragment
    return str(content)


def _translation_html(node: Tag | None) -> str:
    if node is None:
        return ""
    fragment = BeautifulSoup(str(node), "html.parser").find()
    if fragment is None:
        return ""
    for label in fragment.select(".translation-label"):
        label.decompose()
    return _inner_html(fragment)


def _inner_html(node: Tag) -> str:
    return "".join(str(child) for child in node.contents)


def _extract_sidebar_subsection_titles(soup: BeautifulSoup) -> dict[str, str]:
    titles: dict[str, str] = {}
    for section in soup.select(".test-structure .section[data-section-index]"):
        section_index = section.get("data-section-index")
        if section_index is None:
            continue
        subsection_nodes = section.select(".subsection-sidebar-container .subsection")
        for subsection_index, subsection_node in enumerate(subsection_nodes):
            title_node = subsection_node.select_one(".sidebar-subsection-title")
            if title_node is None:
                continue
            titles[f"subsection-{section_index}-{subsection_index}"] = title_node.get_text(" ", strip=True)
    return titles
