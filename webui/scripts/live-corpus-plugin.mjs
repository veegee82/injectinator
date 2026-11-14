// Serves /data/corpus.json LIVE from the builder, in `vite` AND `vite preview`.
// Each request does a stat-walk fingerprint (ms); the corpus is rebuilt only when the fingerprint changed, at most once per
// MIN_REBUILD_MS, and answered with an ETag so an unchanged poll is a 304. Read-only: nothing is ever written to <root>/docs.
import { buildCorpus, fingerprint } from "./corpus.mjs";
import { execFileSync } from "node:child_process";

const MIN_REBUILD_MS = 1000;

export default function liveCorpus({ root }) {
  let cache = null, builtAt = 0, head = null;
  try { head = execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }

  function current() {
    const fp = fingerprint(root);
    if (!cache || (cache.fp !== fp && Date.now() - builtAt >= MIN_REBUILD_MS)) {
      const corpus = buildCorpus(root, fp);
      corpus.meta.git_head = head;
      cache = { fp, etag: `"${fp}"`, body: JSON.stringify(corpus) };
      builtAt = Date.now();
    }
    return cache;
  }
  const middleware = (req, res, next) => {
    if (req.method !== "GET" || !req.url || !req.url.split("?")[0].endsWith("/data/corpus.json")) return next();
    try {
      const c = current();
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("ETag", c.etag);
      if (req.headers["if-none-match"] === c.etag) { res.statusCode = 304; return res.end(); }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(c.body);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  };
  return {
    name: "injectinator-live-corpus",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
