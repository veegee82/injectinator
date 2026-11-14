#!/usr/bin/env bash
# Generate evaluation cases via OpenRouter and store them as a run artefact.
# Loads OPENROUTER_API_KEY from repo-root .env if it is not already in the environment.
# The key is never printed. Makes real OpenRouter calls unless --no-kb is only about KB.
# Usage: bash experiments/gan_generator/run.sh [N] [--no-kb] [--model ID ...]
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

_load_openrouter_key_from_env_file() {
  local env_file="$ROOT/.env"
  [ -f "$env_file" ] || return 0
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    case "$line" in
      OPENROUTER_API_KEY=*)
        value="${line#OPENROUTER_API_KEY=}"
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        export OPENROUTER_API_KEY="$value"
        ;;
    esac
  done < "$env_file"
}

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  _load_openrouter_key_from_env_file
fi
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "OPENROUTER_API_KEY is not set (add it to .env or export it)" >&2
  exit 1
fi

N=3
if [ "${1:-}" ] && [[ "$1" =~ ^[0-9]+$ ]]; then
  N="$1"
  shift
fi

if [ -x "$ROOT/.venv/bin/python" ]; then
  PY="$ROOT/.venv/bin/python"
else
  PY=python3
fi

OUT=docs/data/experiments/gan_generator_cases
RUN="$OUT/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN"

has_model=0
for arg in "$@"; do
  if [ "$arg" = "--model" ]; then
    has_model=1
    break
  fi
done

run_generate() {
  "$PY" -m experiments.gan_generator.generate --n "$N" --kb docs --out "$RUN/cases.json" "$@"
}

if [ "$has_model" -eq 1 ]; then
  run_generate "$@"
else
  if [ -n "${GAN_GENERATOR_MODEL:-}" ]; then
    MODELS=("$GAN_GENERATOR_MODEL")
  else
    MODELS=(
      particle-ai/particle-1:free
      recursive/flint-v1.0:free
      baidu/ernie-5.5-flash-preview:free
    )
  fi
  ok=0
  last_err=""
  for MODEL in "${MODELS[@]}"; do
    if last_err="$(run_generate --model "$MODEL" "$@" 2>&1)"; then
      ok=1
      break
    fi
  done
  if [ "$ok" -ne 1 ]; then
    echo "$last_err" >&2
    rmdir "$RUN" 2>/dev/null || true
    exit 1
  fi
fi

(cd "$RUN" && sha256sum cases.json > MANIFEST.sha256)
echo "cases: $RUN/cases.json"
