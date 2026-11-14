#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../.."
OUT=docs/data/experiments/nebius_faq_iter6
python3 experiments/runner.py run experiments/nebius_faq_iter6/config.json --out "$OUT" || exit $?
RUN="$OUT/$(ls -1 "$OUT" | sort | tail -1)"
python3 experiments/nebius_faq_iter6/analyze.py "$RUN"
(cd "$RUN" && sha256sum *.json run.log manifest.json analysis.json analysis.csv > MANIFEST.sha256)
echo "manifest: $RUN/MANIFEST.sha256"
