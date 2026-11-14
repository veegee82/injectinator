"""Command-line entry point for the defensive OpenRouter test-case generator."""
import argparse
import json
import sys
from pathlib import Path

from experiments.gan_generator.generator import DEFAULT_COUNT, DEFAULT_MODEL, generate_cases
from experiments.openrouter_client.openrouter_client import OpenRouterError


def main(argv=None):
    repo_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Generate harmless synthetic safety-evaluation cases.")
    parser.add_argument("--n", type=int, default=DEFAULT_COUNT, help="number of cases (1-10)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="OpenRouter model ID")
    parser.add_argument("--kb", type=Path, default=repo_root / "docs", help="local KB root directory")
    parser.add_argument("--out", type=Path, help="write JSON output to this path (default: stdout)")
    parser.add_argument("--no-kb", action="store_true",
                        help="do not send any KB summary to OpenRouter (project data stays local)")
    args = parser.parse_args(argv)

    try:
        cases = generate_cases(n=args.n, model=args.model, kb_path=args.kb,
                               memory="" if args.no_kb else None)
    except OpenRouterError as error:
        parser.exit(1, f"generator error: {error}\n")

    output = json.dumps(cases, indent=2, ensure_ascii=False) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
