from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlparse

from nihonez_jlpt.parser import parse_result_document
from nihonez_jlpt.render import write_report_pdf
from nihonez_jlpt.scraper import capture_results_html

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"


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

    render_parser = subparsers.add_parser(
        "render",
        help="Render one named test from data/ or all saved tests into PDFs.",
    )
    render_parser.add_argument(
        "test_name",
        nargs="?",
        help="Optional data/ subdirectory name. Omit it to render every test under the data directory.",
    )
    render_parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Directory containing per-test subdirectories. Defaults to {DEFAULT_DATA_DIR}.",
    )
    render_parser.add_argument(
        "--output-pdf",
        type=Path,
        help="Optional PDF output path for a single named test. Defaults to <data>/<test>/<test>.pdf.",
    )
    render_parser.add_argument(
        "--report-html",
        type=Path,
        help="Optional output path for the cleaned printable HTML for a single named test.",
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
    render_targets = _resolve_render_targets(args.data_dir, args.test_name)
    if args.output_pdf is not None and len(render_targets) != 1:
        raise ValueError("--output-pdf can only be used when rendering a single named test.")
    if args.report_html is not None and len(render_targets) != 1:
        raise ValueError("--report-html can only be used when rendering a single named test.")

    for test_dir, input_html in render_targets:
        html = input_html.read_text(encoding="utf-8")
        document = parse_result_document(
            html,
            source_label=str(input_html),
            source_path=input_html.resolve(),
        )
        output_pdf = args.output_pdf or test_dir / f"{test_dir.name}.pdf"
        report_html = args.report_html
        write_report_pdf(document, output_pdf, report_html_path=report_html)
        print(f"Generated PDF: {output_pdf}")

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


def _resolve_render_targets(data_dir: Path, test_name: str | None) -> list[tuple[Path, Path]]:
    data_dir = data_dir.resolve()
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    if test_name is not None:
        test_dir = data_dir / test_name
        if not test_dir.is_dir():
            available_tests = ", ".join(_list_available_tests(data_dir))
            raise FileNotFoundError(
                f"Test directory not found: {test_dir}. Available tests: {available_tests}"
            )
        return [(test_dir, _find_test_html(test_dir))]

    render_targets: list[tuple[Path, Path]] = []
    for test_dir in sorted(path for path in data_dir.iterdir() if path.is_dir()):
        render_targets.append((test_dir, _find_test_html(test_dir)))

    if not render_targets:
        raise FileNotFoundError(f"No test subdirectories were found in {data_dir}")

    return render_targets


def _find_test_html(test_dir: Path) -> Path:
    html_files = sorted(test_dir.glob("*.html"))
    if not html_files:
        raise FileNotFoundError(f"No HTML fixture was found in {test_dir}")
    if len(html_files) > 1:
        names = ", ".join(path.name for path in html_files)
        raise ValueError(f"Expected exactly one HTML fixture in {test_dir}, found: {names}")
    return html_files[0]


def _list_available_tests(data_dir: Path) -> list[str]:
    return sorted(path.name for path in data_dir.iterdir() if path.is_dir())
