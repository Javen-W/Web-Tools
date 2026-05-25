from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class ReportItem:
    kind: str
    html: str


@dataclass(slots=True)
class ReportSubsection:
    title: str
    items: list[ReportItem] = field(default_factory=list)


@dataclass(slots=True)
class ReportSection:
    title: str
    subsections: list[ReportSubsection] = field(default_factory=list)


@dataclass(slots=True)
class ReportDocument:
    title: str
    description: str
    source_label: str
    generated_at: str
    sections: list[ReportSection] = field(default_factory=list)
