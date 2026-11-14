// CLI wrapper: writes public/data/corpus.json (the dev/preview server serves a LIVE version of the same builder).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { buildCorpus } from "./corpus.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.INJECTINATOR_ROOT ?? join(here, "..", ".."));
const OUT = resolve(process.env.CORPUS_OUT ?? join(here, "..", "public", "data", "corpus.json"));
const corpus = buildCorpus(ROOT);
try { corpus.meta.git_head = execFileSync("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(corpus));
console.log(`corpus.json: ${corpus.answers.length} answers, ${corpus.runs.length} runs, ${corpus.trials.length} trials, ${corpus.entities.length} entities, ${corpus.warnings.length} warnings, ${corpus.activity.length} in progress -> ${OUT}`);
for (const w of corpus.warnings) console.log("  warning:", w);
for (const a of corpus.activity) console.log("  active:", a);
