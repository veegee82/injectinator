#!/usr/bin/env bash
# Iteration 4: rule-based criteria over the existing corpus. No model/API calls.
# Usage: bash experiments/nebius_faq_iter4/run.sh
set -eu
cd "$(dirname "$0")/../.."
python3 experiments/nebius_faq_iter4/calibration.py
OUT=docs/data/experiments/nebius_faq_iter4
RUN="$OUT/$(date +%Y%m%d-%H%M%S)"
python3 experiments/nebius_faq_iter4/analyze.py "$RUN"
(cd "$RUN" && sha256sum *.json *.csv > MANIFEST.sha256)
echo "manifest: $RUN/MANIFEST.sha256"
