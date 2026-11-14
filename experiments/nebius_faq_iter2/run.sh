#!/usr/bin/env bash
# Iteration 2: 80 real Nebius calls (max 300 tokens each). Needs NEBIUS_API_KEY (env or ./.env, never printed).
# Usage: bash experiments/nebius_faq_iter2/run.sh [--dry-run]
set -u
cd "$(dirname "$0")/../.."
OUT=docs/data/experiments/nebius_faq_iter2
python3 experiments/runner.py run experiments/nebius_faq_iter2/config.json --out "$OUT" "$@" || exit $?
[ "${1:-}" = "--dry-run" ] && exit 0
RUN="$OUT/$(ls -1 "$OUT" | sort | tail -1)"
python3 experiments/nebius_faq_iter2/analyze.py "$RUN"
python3 experiments/runner.py eval "$RUN" > "$RUN/eval.txt"
(cd "$RUN" && sha256sum *.json *.csv run.log eval.txt > MANIFEST.sha256)
echo "manifest: $RUN/MANIFEST.sha256"
