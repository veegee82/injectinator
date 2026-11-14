---
id: ADR-0001
uid: 01M7D15VA72CW2N0Y6WBERXA1E
title: Build the experiment results UI as a static, read-only React app over a build-time corpus.json
status: proposed
created: '2026-11-14T12:40:35+00:00'
links:
- rel: formalized_as
  to: CONCEPT-0001
- rel: related
  to: PLAN-0004
depends_on: []
related: []
supersedes: []
paths: []
docs: []
commits: []
paths:
- webui/
docs:
- docs/concepts/CONCEPT-0001-experiment-results-webui-make-every-number-traceable-to-its.md
---

# ADR-0001 — Build the experiment results UI as a static, read-only React app over a build-time corpus.json

**Status:** proposed (decided by the assistant as a draft; acceptance is a human decision)

## Context
CONCEPT-0001 asks for a UI in which every experiment number is traceable to evidence. Three levels:
- **Conceptual:** the UI is a lens on committed evidence, never a second source of truth. It computes nothing that a committed analysis already states and it never writes.
- **Structural:** `docs/data/experiments/**` and the KB stay authoritative; the UI sits beside them in `webui/` and reads one derived file. No server API, no database, no model call.
- **Implementation:** a Node build script produces `webui/public/data/corpus.json`; a Vite + React + TypeScript SPA renders it; hand-written SVG charts; hash routes.

## Decision
1. React 18 + TypeScript + Vite 5 (Node 18 compatible - the host runs Node 18.19), static bundle, served by `vite` / `vite preview` on 127.0.0.1 only.
2. A build-time data step (`webui/scripts/build-data.mjs`) re-verifies every `MANIFEST.sha256`, parses KB frontmatter, and cross-checks `analysis.json` against the per-call files. Disagreement is data (a warning in the Evidence view), never silently resolved.
3. Charts are hand-written SVG (no chart library): the encodings are few and fixed, and a testable encoding module avoids a dependency that Node 18 may stop supporting.
4. Proportions are drawn with Wilson 95 % intervals and always with k/n; no significance language.
5. v1 makes no AI call. If a judge view is added later it uses `claude-opus-5-5`, behind its own preregistration and a spend cap.

## Consequences
- Positive: no runtime coupling to experiments, offline, reproducible build, trivial to host as static files.
- Negative: data refresh needs `npm run build:data` (the dev script runs it first); the UI cannot show a run that is not yet on disk.
- Must NOT do: write into `docs/`; recompute an analysis that exists as a committed artifact without reconciling; invent sample data for an empty state; call the network at runtime.

## Alternatives considered
Streamlit/Dash (Python server, less control over the evidence drawer), Jupyter report (not explorable, drifts), live in-browser analysis (second source of truth). See CONCEPT-0001.

## Amendment 2026-11-14: live refresh by polling, outcome from the preregistered rubric
- **Polling over push.** The page polls an ETag-validated endpoint. Alternatives: server-sent events / WebSocket (needs a persistent connection and a file watcher; `fs.watch` is not recursive on Linux with the Node 18 this host runs; breaks in plain static hosting) and Vite HMR (dev only). Polling works identically under `vite`, `vite preview` and any static server that rebuilds `corpus.json`, and the fingerprint makes an idle poll cost a stat walk.
- **One builder, two entry points.** `scripts/corpus.mjs::buildCorpus` is used by the CLI (`build-data.mjs`) and by the dev/preview middleware, so a served corpus and a built one cannot disagree.
- **Outcome = PLAN-0001 rubric, one module.** `src/lib/outcome.js` is imported by the build script and the UI. Changing what counts as success means changing PLAN-0001 first (never edit a preregistration; amend it), then that module.
- **Must NOT do (added):** let the UI decide success from reply text; count an unrated trial in a denominator; fail the build on a half-written file; write into `docs/` from the live endpoint.
- **Proof:** `webui/e2e/live.e2e.mjs` starts a real dev server over a throw-away fixture tree, changes files on disk and asserts, in a real browser and without a reload, that the page updates and classifies success and failure.

