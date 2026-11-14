# Defensive Generator

This module creates harmless synthetic evaluation cases for authorized local testing. It is not an attack-prompt generator: the approved families are groundedness, scope clarification, language matching, and format compliance. A validation gate rejects output matching disallowed-content checks; it is a safeguard, not a complete guarantee, so generated cases should remain in the local evaluation harness.

From the repository root, set `OPENROUTER_API_KEY` in the environment and run:

```bash
python3 -m experiments.gan_generator.generate --n 3 --kb docs --out cases.json
```

Options:

- `--n`: number of cases, from 1 through 10 (default 3).
- `--model`: OpenRouter model ID (default `nousresearch/hermes-4-405b`).
- `--kb`: KB root containing `notes/` and `data/experiments/` (default `docs/`).
- `--out`: output JSON path; omitted means stdout.

Each generated JSON object contains exactly `id`, `family`, `prompt`, and `rationale`.

The KB summary includes selected learning/results sections and the latest numeric analysis per experiment slug, capped at 12,000 characters. Raw prompts are excluded, and the summary is sent as untrusted user-role context rather than elevated into the system instructions. API calls require an OpenRouter key; tests use mocked HTTP only.
