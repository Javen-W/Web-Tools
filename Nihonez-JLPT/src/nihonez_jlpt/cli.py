from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlparse

from nihonez_jlpt.parser import parse_result_document
from nihonez_jlpt.render import write_report_html, write_report_pdf
from nihonez_jlpt.scraper import capture_results_html


def main(argv: list[str] | None = None) -> int:
    parser = _build_argument_parser()
    args = parser.parse_args(argv)

    try:
        return args.handler(args)
    except (FileNotFoundError, RuntimeError, ValueError) as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nihonez-jlpt",
        description="Capture Nihonez JLPT results pages and render printable PDFs.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture_parser = subparsers.add_parser("capture", help="Capture a Nihonez results page from a live URL.")
    capture_parser.add_argument("url", help="Nihonez test URL.")
    capture_parser.add_argument("output_html", type=Path, help="Where to save the captured HTML.")
    capture_parser.add_argument(
        "--storage-state",
        type=Path,
        help="Optional Playwright storage-state JSON file for authenticated Nihonez sessions.",
    )
    capture_parser.set_defaults(handler=_handle_capture)

    render_parser = subparsers.add_parser("render", help="Render a saved Nihonez results HTML file into a PDF.")
    render_parser.add_argument("input_html", type=Path, help="Saved Nihonez results HTML.")
    render_parser.add_argument("output_pdf", type=Path, help="PDF output path.")
    render_parser.add_argument(
        "--report-html",
        type=Path,
        help="Optional output path for the cleaned printable HTML that is rendered to PDF.",
    )
    render_parser.set_defaults(handler=_handle_render)

    build_parser = subparsers.add_parser("build", help="Capture or load a Nihonez test and render it to PDF.")
    build_parser.add_argument("source", help="Either a Nihonez URL or a saved results HTML file.")
    build_parser.add_argument("output_pdf", type=Path, help="PDF output path.")
    build_parser.add_argument(
        "--captured-html",
        type=Path,
        help="Optional path to save the live captured results HTML when the source is a URL.",
    )
    build_parser.add_argument(
        "--report-html",
        type=Path,
        help="Optional path to save the cleaned printable HTML used for the PDF.",
    )
    build_parser.add_argument(
        "--storage-state",
        type=Path,
        help="Optional Playwright storage-state JSON file for authenticated Nihonez sessions.",
    )
    build_parser.set_defaults(handler=_handle_build)

    return parser


def _handle_capture(args: argparse.Namespace) -> int:
    capture_results_html(args.url, args.output_html, storage_state_path=args.storage_state)
    print(f"Captured results HTML: {args.output_html}")
    return 0


def _handle_render(args: argparse.Namespace) -> int:
    input_html: Path = args.input_html
    if not input_html.is_file():
        raise FileNotFoundError(f"Input HTML not found: {input_html}")

    html = input_html.read_text(encoding="utf-8")
    document = parse_result_document(
        html,
        source_label=str(input_html),
        source_path=input_html.resolve(),
    )
    write_report_pdf(document, args.output_pdf, report_html_path=args.report_html)
    print(f"Generated PDF: {args.output_pdf}")
    return 0


def _handle_build(args: argparse.Namespace) -> int:
    source = args.source
    parsed = urlparse(source)

    if parsed.scheme in {"http", "https"}:
        html = capture_results_html(source, args.captured_html, storage_state_path=args.storage_state)
        document = parse_result_document(
            html,
            source_label=source,
            base_url=source,
        )
    else:
        input_html = Path(source)
        if not input_html.is_file():
            raise FileNotFoundError(f"Input HTML not found: {input_html}")
        html = input_html.read_text(encoding="utf-8")
        document = parse_result_document(
            html,
            source_label=str(input_html),
            source_path=input_html.resolve(),
        )

    write_report_pdf(document, args.output_pdf, report_html_path=args.report_html)
    print(f"Generated PDF: {args.output_pdf}")
    return 0
