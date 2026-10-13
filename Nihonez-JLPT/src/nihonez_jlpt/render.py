from __future__ import annotations

from pathlib import Path
import re
import shutil
from urllib.parse import quote, unquote, urlparse

from bs4 import BeautifulSoup
from bs4.element import Comment, NavigableString, Tag

from nihonez_jlpt.models import Exam, PassageGroup, Question


_HEADING_LABELS = {
    "correct answer": "Correct Answer",
    "question translation": "Question Translation",
    "word translation": "Word Translation",
    "correct sentence translation": "Correct Sentence Translation",
    "explanation": "Explanation",
    "why other options are incorrect": "Why Other Options Are Incorrect",
    "other options": "Other Options",
    "usage note": "Usage Note",
    "grammar/vocabulary note": "Grammar/Vocabulary Note",
    "answer (★ position)": "Answer (★ Position)",
    "correct order": "Correct Order",
    "chunk-by-chunk breakdown": "Chunk-by-Chunk Breakdown",
    "reconstructed sentence": "Reconstructed Sentence",
    "why this order works": "Why This Order Works",
    "test-taking tip": "Test-Taking Tip",
}

_BLOCK_TAGS = {
    "p",
    "div",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "figure",
    "section",
    "article",
}
_SKIP_TAGS = {"button", "input", "svg", "script", "style", "audio", "source", "noscript", "iframe"}
_ASCII_SPACE = " \t\r\n\f"


class MediaCopier:
    def __init__(self, source_html: Path, media_dir: Path) -> None:
        self.source_html = source_html
        self.media_dir = media_dir
        self._copied: dict[Path, str] = {}

    def copy(self, raw_src: str) -> str:
        source = _resolve_image_path(raw_src, self.source_html)
        cached = self._copied.get(source)
        if cached is not None:
            return cached

        self.media_dir.mkdir(parents=True, exist_ok=True)
        destination = self._destination_for(source)
        if not destination.exists():
            shutil.copy2(source, destination)
        relative = f"media/{quote(destination.name)}"
        self._copied[source] = relative
        return relative

    def _destination_for(self, source: Path) -> Path:
        candidate = self.media_dir / source.name
        if not candidate.exists() or candidate.read_bytes() == source.read_bytes():
            return candidate

        counter = 2
        while True:
            candidate = self.media_dir / f"{source.stem}-{counter}{source.suffix}"
            if not candidate.exists() or candidate.read_bytes() == source.read_bytes():
                return candidate
            counter += 1


class HtmlMarkdown:
    def __init__(self, media: MediaCopier) -> None:
        self.media = media

    def render_fragment(self, html: str) -> str:
        if not html or not html.strip():
            return ""
        soup = BeautifulSoup(html, "html.parser")
        return self._render_children(soup, block=True)

    def render_explanation(self, html: str) -> str:
        if not html or not html.strip():
            return ""
        soup = BeautifulSoup(html, "html.parser")
        root = soup.find("div", class_="explanation") or soup
        element_children = [child for child in root.children if isinstance(child, Tag)]
        if (
            len(element_children) == 1
            and "translation-section" in element_children[0].get("class", [])
        ):
            body = self._render_children(element_children[0], block=True).strip(_ASCII_SPACE)
            if not body:
                return ""
            return f"**Explanation**\n\n{body}"

        sections = _split_explanation(root)
        if len(sections) == 1 and sections[0][0] is None:
            body = self.render_fragment(sections[0][1]).strip(_ASCII_SPACE)
            if not body:
                return ""
            return f"**Explanation**\n\n{body}"

        parts: list[str] = []
        for title, fragment in sections:
            body = self.render_fragment(fragment).strip(_ASCII_SPACE)
            if title is None:
                if body:
                    parts.extend([body, ""])
                continue
            parts.extend([f"**{title}**", ""])
            if body:
                parts.extend([body, ""])
        return "\n".join(parts).strip(_ASCII_SPACE)

    def _render_children(self, node: BeautifulSoup | Tag, *, block: bool) -> str:
        tokens: list[tuple[str, str]] = []
        for child in node.children:
            if isinstance(child, Comment):
                continue
            if isinstance(child, NavigableString):
                text = _normalize_inline(str(child))
                if (
                    block
                    and "\n" not in text
                    and "\u3000" not in text
                    and not text.strip(_ASCII_SPACE)
                ):
                    continue
                if text:
                    tokens.append(("text", text))
                continue
            if not isinstance(child, Tag) or child.name in _SKIP_TAGS:
                continue
            if child.name == "br":
                tokens.append(("br", ""))
                continue
            if child.name == "img":
                tokens.append(("block", self._render_image(child)))
                continue
            if child.name == "table":
                tokens.append(("block", self._render_table(child)))
                continue
            if child.name == "ruby":
                tokens.append(("text", self._render_ruby(child)))
                continue
            if child.name in {"strong", "b"}:
                tokens.append(("text", _wrap_markup(self._render_children(child, block=False), "**")))
                continue
            if _is_underline(child):
                tokens.append(("text", _wrap_markup(self._render_children(child, block=False), "<u>", "</u>")))
                continue
            if child.name in _BLOCK_TAGS:
                tokens.append(("block", self._render_children(child, block=True)))
                continue
            tokens.append(("text", self._render_children(child, block=False)))
        return _join_tokens(tokens)

    def _render_ruby(self, tag: Tag) -> str:
        parts: list[str] = []
        base: list[str] = []
        for child in tag.children:
            if isinstance(child, Tag) and child.name == "rt":
                reading = child.get_text("", strip=True)
                base_text = "".join(base)
                base.clear()
                parts.append(f"{base_text}（{reading}）" if reading else base_text)
                continue
            if isinstance(child, Tag) and child.name == "rp":
                continue
            if isinstance(child, Tag):
                base.append(self._render_children(child, block=False))
            else:
                base.append(_normalize_inline(str(child)))
        if base:
            parts.append("".join(base))
        return "".join(parts)

    def _render_image(self, tag: Tag) -> str:
        src = tag.get("src", "").strip()
        if not src:
            return ""
        relative = self.media.copy(src)
        alt = tag.get("alt", "").strip().replace("\n", " ")
        alt = alt.replace("[", "\\[").replace("]", "\\]")
        return f"![{alt}]({relative})"

    def _render_table(self, table: Tag) -> str:
        rows: list[list[str]] = []
        for row_node in table.find_all("tr"):
            cells = []
            for cell in row_node.find_all(["th", "td"], recursive=False):
                content = self._render_children(cell, block=False)
                content = re.sub(r"\s*\n\s*", " ", content).strip(_ASCII_SPACE)
                content = content.replace("|", "\\|")
                cells.append(content)
            if cells:
                rows.append(cells)
        if not rows:
            return ""

        width = max(len(row) for row in rows)
        for row in rows:
            row.extend("" for _ in range(width - len(row)))
        header = rows[0]
        lines = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join("---" for _ in header) + " |",
        ]
        lines.extend("| " + " | ".join(row) + " |" for row in rows[1:])
        return "\n".join(lines)


def render_exam(exam: Exam, *, source_html: Path, media_dir: Path) -> str:
    writer = HtmlMarkdown(MediaCopier(source_html, media_dir))
    parts = [f"# {exam.title}", ""]
    for section in exam.sections:
        parts.extend([f"## {section.title}", ""])
        for subsection in section.subsections:
            parts.extend([f"### {subsection.title}", ""])
            instruction = writer.render_fragment(subsection.instruction_html).strip(_ASCII_SPACE)
            if instruction:
                parts.extend([_blockquote(instruction), ""])
            for block in subsection.blocks:
                if isinstance(block, PassageGroup):
                    rendered = _render_passage_group(writer, block)
                else:
                    rendered = _render_question(writer, block)
                if rendered:
                    parts.extend([rendered, ""])
    return _tidy("\n".join(parts))


def _render_passage_group(writer: HtmlMarkdown, group: PassageGroup) -> str:
    parts: list[str] = []
    passage = writer.render_fragment(group.passage_html).strip(_ASCII_SPACE)
    if passage:
        parts.extend([passage, ""])
    translation = writer.render_fragment(group.translation_html).strip(_ASCII_SPACE)
    if translation:
        parts.extend(["**Passage translation**", "", translation, ""])
    for question in group.questions:
        parts.extend([_render_question(writer, question), ""])
    return "\n".join(parts).strip(_ASCII_SPACE)


def _render_question(writer: HtmlMarkdown, question: Question) -> str:
    parts = [f"#### Question {question.number}", ""]
    stem = writer.render_fragment(question.stem_html).strip(_ASCII_SPACE)
    if stem:
        parts.extend([stem, ""])
    images = writer.render_fragment(question.images_html).strip(_ASCII_SPACE)
    if images:
        parts.extend([images, ""])

    for choice in question.choices:
        text = _single_line(writer.render_fragment(choice.html))
        line = f"{choice.number}. {text}".rstrip()
        if choice.correct:
            line = f"{choice.number}. **{text}**" if text else f"{choice.number}."
        parts.append(line)
    if question.choices:
        parts.append("")

    correct = [choice for choice in question.choices if choice.correct]
    if len(correct) == 1:
        text = _single_line(writer.render_fragment(correct[0].html))
        answer = f"{correct[0].number}. {text}".rstrip()
        parts.extend([f"**Correct answer:** {answer}", ""])

    transcript = writer.render_fragment(question.transcript_html).strip(_ASCII_SPACE)
    if transcript:
        parts.extend(["**Transcript**", "", transcript, ""])

    explanation = writer.render_explanation(question.explanation_html).strip(_ASCII_SPACE)
    if explanation:
        parts.extend([explanation, ""])
    return "\n".join(parts).strip(_ASCII_SPACE)


def _split_explanation(root: BeautifulSoup | Tag) -> list[tuple[str | None, str]]:
    sections: list[tuple[str | None, str]] = []
    current_title: str | None = None
    current_nodes: list[Tag | NavigableString] = []

    def flush() -> None:
        fragment = "".join(str(node) for node in current_nodes).strip()
        if current_title is None and not fragment:
            return
        sections.append((current_title, fragment))

    for child in list(root.children):
        if isinstance(child, Tag) and child.name == "strong":
            heading = _match_heading(child.get_text("", strip=True))
            if heading is not None:
                flush()
                current_title = heading
                current_nodes = []
                continue
        current_nodes.append(child)
    flush()
    return sections


def _match_heading(text: str) -> str | None:
    cleaned = re.sub(r"^[^\w★(]+", "", text.strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return _HEADING_LABELS.get(cleaned.casefold())


def _resolve_image_path(raw_src: str, source_html: Path) -> Path:
    parsed = urlparse(raw_src)
    if parsed.scheme in {"http", "https", "data"}:
        raise ValueError(f"Exam image is not a local file: {raw_src}")
    if parsed.scheme == "file":
        path = Path(unquote(parsed.path))
    else:
        clean = unquote(raw_src.split("?", 1)[0].split("#", 1)[0])
        path = source_html.parent / clean
    if not path.is_file():
        raise FileNotFoundError(f"Referenced exam image was not found: {path}")
    return path.resolve()


def _normalize_inline(text: str) -> str:
    placeholder = "\uE000"
    normalized = text.replace("\u3000", placeholder)
    normalized = normalized.replace("\xa0", " ")
    # Indented newlines are source formatting. A newline before a lowercase
    # letter is an English soft wrap. Remaining newlines are real line breaks.
    normalized = re.sub(r"\n[ \t]{2,}", " ", normalized)
    normalized = re.sub(r"\n[ \t]*(?=[a-z])", " ", normalized)
    normalized = re.sub(r"[ \t]*\n[ \t]*", "\n", normalized)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    return normalized.replace(placeholder, "\u3000")


def _is_underline(tag: Tag) -> bool:
    if "underline" in tag.get("class", []):
        return True
    style = tag.get("style", "")
    return "text-decoration" in style and "underline" in style


def _wrap_markup(text: str, opening: str, closing: str | None = None) -> str:
    closing = opening if closing is None else closing
    stripped = text.strip(_ASCII_SPACE)
    if not stripped:
        return ""
    leading = text[: len(text) - len(text.lstrip(_ASCII_SPACE))]
    trailing = text[len(text.rstrip(_ASCII_SPACE)) :]
    return f"{leading}{opening}{stripped}{closing}{trailing}"


def _join_tokens(tokens: list[tuple[str, str]]) -> str:
    pieces: list[str] = []
    pending_breaks = 0

    def flush_breaks() -> None:
        nonlocal pending_breaks
        if pending_breaks <= 0:
            return
        pieces.append("\n" if pending_breaks == 1 else "\n\n")
        pending_breaks = 0

    for kind, value in tokens:
        if kind == "br":
            pending_breaks += 1
            continue
        if kind == "block":
            value = value.strip(_ASCII_SPACE)
            if not value:
                continue
            flush_breaks()
            if pieces and not pieces[-1].endswith("\n"):
                pieces.append("\n\n")
            elif pieces and pieces[-1].endswith("\n") and not pieces[-1].endswith("\n\n"):
                pieces.append("\n")
            pieces.extend([value, "\n\n"])
            continue
        if pending_breaks:
            flush_breaks()
            value = value.lstrip(_ASCII_SPACE)
        pieces.append(value)

    flush_breaks()
    return re.sub(r"\n{3,}", "\n\n", "".join(pieces)).strip(_ASCII_SPACE)


def _single_line(text: str) -> str:
    return re.sub(r"\s*\n\s*", " ", text).strip(_ASCII_SPACE)


def _blockquote(text: str) -> str:
    lines = text.splitlines() or [""]
    return "\n".join(f"> {line}" if line else ">" for line in lines)


def _tidy(markdown: str) -> str:
    text = markdown.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip(_ASCII_SPACE) + "\n"
