from __future__ import annotations

from importlib.resources import files
from pathlib import Path

from jinja2 import Environment, PackageLoader, select_autoescape
from playwright.sync_api import sync_playwright

from nihonez_jlpt.models import ReportDocument


def render_report_html(document: ReportDocument) -> str:
    template_env = Environment(
        loader=PackageLoader("nihonez_jlpt", "templates"),
        autoescape=select_autoescape(enabled_extensions=("html", "j2")),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    stylesheet = files("nihonez_jlpt").joinpath("templates/report.css").read_text(encoding="utf-8")
    template = template_env.get_template("report.html.j2")
    return template.render(document=document, stylesheet=stylesheet)


def write_report_html(document: ReportDocument, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    html = render_report_html(document)
    output_path.write_text(html, encoding="utf-8")
    return output_path


def write_report_pdf(document: ReportDocument, output_path: Path, *, report_html_path: Path | None = None) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    html = render_report_html(document)

    if report_html_path is not None:
        report_html_path.parent.mkdir(parents=True, exist_ok=True)
        report_html_path.write_text(html, encoding="utf-8")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        page.pdf(
            path=str(output_path),
            format="A4",
            print_background=True,
            margin={"top": "0.5in", "right": "0.4in", "bottom": "0.5in", "left": "0.4in"},
        )
        browser.close()

    return output_path
