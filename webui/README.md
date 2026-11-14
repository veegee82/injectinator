# injectinator webui

A read-only, local React app that shows the experiment results under `docs/data/experiments/` together with the
knowledge-base entities that frame them (plans = preregistrations, notes = results). Every number opens an evidence
drawer with its source path, run id and manifest status. Design: `docs/concepts/CONCEPT-0001-*`, decision `docs/decisions/ADR-0001-*`.

```bash
cd webui
npm install
npm run dev        # builds data, serves http://127.0.0.1:5173 (localhost only)
npm run build      # data + typecheck + production bundle in dist/
npm test           # unit tests: manifest verification, Wilson interval, floor/ceiling
npm run e2e        # real-browser run against the running dev server (needs Node >= 20 and Google Chrome)
npm run e2e:live   # starts its own dev server over a throw-away fixture tree; proves live refresh + injection outcomes
```

- **Live:** the page polls `/data/corpus.json` every 4 s (`VITE_POLL_MS` overrides), only while the tab is visible, and updates itself without a reload; a toast says what changed, the rail shows Live / Paused / Offline and offers Pause. `vite` and `vite preview` serve the corpus from the builder on demand (stat-walk fingerprint + ETag). Run folders without a manifest are “in progress” for 10 minutes, then “unsealed” (a warning).
- **Attacks (injection outcomes):** reads `docs/data/experiments/riley-leak-matrix/trials.jsonl` (schema in `SCHEMA.md` there). Outcome comes from the rated `score` with the PLAN-0001 rubric: score ≥ 2 = injection succeeded, 1 = failed with a near miss, 0 = failed, no score = not rated (excluded from rates). The rule lives in `src/lib/outcome.js`, shared by the build script and the UI. The page never judges raw replies.
- `scripts/build-data.mjs` (CLI over `scripts/corpus.mjs`) re-hashes every `MANIFEST.sha256`, cross-checks `analysis.json` against the per-call files and
  writes `public/data/corpus.json` (git-ignored, regenerated on every `dev`/`build`). Re-run `npm run build:data` after new data lands.
- The app never writes into `docs/`, never calls the network and never calls a model.
- Empty states are real: iteration 3 (blank rater sheets) and the riley-leak-matrix (no `trials.jsonl`) are shown as such.
- Views are hash routes: `#/overview`, `#/timeline`, `#/attacks?outcome=&family=&model=`, `#/compare`, `#/criteria`, `#/answers?model=&topic=&variant=&flag=1&trunc=1`, `#/evidence`; `?theme=light|dark` forces a theme.
- The verdict lines on the overview are quoted from the result notes (NOTE-0002..0004); the numbers next to them are computed from the data.
