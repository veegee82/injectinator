#!/usr/bin/env bash
# Runs the Nebius FAQ baseline (16 real LLM calls, max 300 tokens each), then evaluates it.
# Needs NEBIUS_API_KEY in the environment or in ./.env (never printed).
# Usage: bash experiments/nebius_faq_baseline/run.sh [--dry-run]
set -u
cd "$(dirname "$0")/../.."
OUT=docs/data/experiments/nebius_faq_baseline
python3 experiments/runner.py run experiments/nebius_faq_baseline/config.json --out "$OUT" "$@" || exit $?
[ "${1:-}" = "--dry-run" ] && exit 0
RUN="$OUT/$(ls -1 "$OUT" | sort | tail -1)"
python3 experiments/runner.py eval "$RUN"
(cd "$RUN" && sha256sum *.json *.csv run.log > MANIFEST.sha256)
echo "manifest: $RUN/MANIFEST.sha256"
