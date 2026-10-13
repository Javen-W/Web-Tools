from __future__ import annotations

import argparse
from pathlib import Path

from nihonez_jlpt.pipeline import DEFAULT_DATA_DIR, DEFAULT_OUTPUT_DIR, generate_missing


def main(argv: list[str] | None = None) -> int:
    parser = _build_argument_parser()
    args = parser.parse_args(argv)
    try:
        result = generate_missing(args.data_dir, args.output_dir)
    except (FileNotFoundError, ValueError) as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")

    for name in result.written:
        print(f"Wrote {name}")
    for name in result.skipped:
        print(f"Skipped {name}")
    return 0


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nihonez-jlpt",
        description="Generate markdown JLPT exams from saved Nihonez HTML.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Directory of saved exam HTML folders. Defaults to {DEFAULT_DATA_DIR}.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for generated exams. Defaults to {DEFAULT_OUTPUT_DIR}.",
    )
    return parser
