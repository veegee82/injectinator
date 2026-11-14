#!/usr/bin/env bash
# Generate harmless evaluation cases (groundedness / scope / language / format) and store them
# as a run artefact. This makes REAL OpenRouter calls and sends the KB summary unless --no-kb.
# Needs OPENROUTER_API_KEY in the environment (never printed).
# Usage: bash experiments/gan_generator/run.sh [N] [--no-kb]
set -eu
cd "$(dirname "$0")/../.."
N="${1:-3}"; shift || true
OUT=docs/data/experiments/gan_generator_cases
RUN="$OUT/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN"
python3 -m experiments.gan_generator.generate --n "$N" --kb docs --out "$RUN/cases.json" "$@"
(cd "$RUN" && sha256sum cases.json > MANIFEST.sha256)
echo "cases: $RUN/cases.json"
