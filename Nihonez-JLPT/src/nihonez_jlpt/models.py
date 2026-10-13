from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field


@dataclass(slots=True)
class Choice:
    number: str
    html: str
    correct: bool


@dataclass(slots=True)
class Question:
    number: str
    stem_html: str
    images_html: str
    choices: list[Choice] = field(default_factory=list)
    transcript_html: str = ""
    explanation_html: str = ""


@dataclass(slots=True)
class PassageGroup:
    passage_html: str
    translation_html: str
    questions: list[Question] = field(default_factory=list)


@dataclass(slots=True)
class Subsection:
    title: str
    instruction_html: str
    blocks: list[Question | PassageGroup] = field(default_factory=list)


@dataclass(slots=True)
class Section:
    title: str
    subsections: list[Subsection] = field(default_factory=list)


@dataclass(slots=True)
class Exam:
    title: str
    sections: list[Section] = field(default_factory=list)

    def iter_questions(self) -> Iterator[Question]:
        for section in self.sections:
            for subsection in section.subsections:
                for block in subsection.blocks:
                    if isinstance(block, Question):
                        yield block
                    else:
                        yield from block.questions
