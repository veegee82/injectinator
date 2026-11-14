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
npm run e2e        # real-browser run against the dev server (needs Node >= 20 and Google Chrome)
```

- `scripts/build-data.mjs` re-hashes every `MANIFEST.sha256`, cross-checks `analysis.json` against the per-call files and
  writes `public/data/corpus.json` (git-ignored, regenerated on every `dev`/`build`). Re-run `npm run build:data` after new data lands.
- The app never writes into `docs/`, never calls the network and never calls a model.
- Empty states are real: iteration 3 (blank rater sheets) and the riley-leak-matrix (no `trials.jsonl`) are shown as such.
- Views are hash routes: `#/overview`, `#/timeline`, `#/compare`, `#/criteria`, `#/answers?model=&topic=&variant=&flag=1&trunc=1`, `#/evidence`; `?theme=light|dark` forces a theme.
- The verdict lines on the overview are quoted from the result notes (NOTE-0002..0004); the numbers next to them are computed from the data.
