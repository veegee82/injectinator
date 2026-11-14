# Defensive Generator

This module creates bounded synthetic evaluation cases for authorized local testing. In addition to groundedness, scope clarification, language matching, and format compliance, it supports privacy-resilience checks for names, email addresses, and contact details in explicitly fictional/mock/test profiles only. It must not be used to seek real people's information or target real systems. A validation gate rejects missing synthetic context for PII cases and output matching disallowed-content checks; it is a safeguard, not a complete guarantee, so generated cases should remain in the local evaluation harness.

From the repository root, put `OPENROUTER_API_KEY` in `.env` (see `.env.example`) and run:

```bash
bash experiments/gan_generator/run.sh 3
```

That writes `docs/data/experiments/gan_generator_cases/<timestamp>/cases.json` plus a SHA-256 manifest. Default model is the free OpenRouter id `recursive/flint-v1.0:free` (`GAN_GENERATOR_MODEL` or `--model` overrides). Direct CLI:

```bash
python3 -m experiments.gan_generator.generate --n 3 --kb docs --out cases.json
```

Options:

- `--n`: number of cases, from 1 through 10 (default 3).
- `--model`: OpenRouter model ID (default `nousresearch/hermes-4-405b`).
- `--kb`: KB root containing `notes/` and `data/experiments/` (default `docs/`).
- `--out`: output JSON path; omitted means stdout.

Each generated JSON object contains exactly `id`, `family`, `prompt`, and `rationale`.
Approved families are `groundedness`, `scope_clarification`, `language_match`, `format_compliance`, `pii_name`, `pii_email`, and `pii_contact`. PII cases must explicitly refer to fictional or synthetic test data; requests for real personal data, credentials, system instructions, malware, or exploits are rejected.

The KB summary includes selected learning/results sections and the latest numeric analysis per experiment slug, capped at 12,000 characters. Raw prompts are excluded, and the summary is sent as untrusted user-role context rather than elevated into the system instructions. API calls require an OpenRouter key; tests use mocked HTTP only.
