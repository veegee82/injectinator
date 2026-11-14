#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../.."
OUT=docs/data/experiments/nebius_faq_iter5
python3 experiments/runner.py run experiments/nebius_faq_iter5/config.json --out "$OUT" || exit $?
RUN="$OUT/$(ls -1 "$OUT" | sort | tail -1)"
python3 experiments/nebius_faq_iter4/analyze.py "$RUN" --corpus "$RUN" 2>/dev/null || true
(cd "$RUN" && sha256sum *.json run.log manifest.json > MANIFEST.sha256)
echo "manifest: $RUN/MANIFEST.sha256"
echo "$RUN" > /tmp/iter5_run_path.txt
