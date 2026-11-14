// Build-time data step (ADR-0001). Read-only over ../docs; writes public/data/corpus.json.
// No network, no model call. Every MANIFEST.sha256 is re-verified here.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { verifyManifest } from "./manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.INJECTINATOR_ROOT ?? join(here, "..", ".."));
const EXP = join(ROOT, "docs", "data", "experiments");
const OUT = resolve(process.env.CORPUS_OUT ?? join(here, "..", "public", "data", "corpus.json"));

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const rel = (p) => p.slice(ROOT.length + 1);
const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory()) : []);

// ---- KB frontmatter (minimal YAML subset: scalars + links list) ----
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = { links: [] };
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("links:")) {
      let cur = null;
      for (i++; i < lines.length && /^\s*(-|to:|rel:)/.test(lines[i]); i++) {
        const r = lines[i].match(/rel:\s*(.+)$/);
        const t = lines[i].match(/to:\s*(.+)$/);
        if (r) cur = { rel: r[1].trim(), to: "" };
        if (cur && lines[i].match(/^\s*-\s*rel:/)) fm.links.push(cur);
        if (t && cur) cur.to = t[1].trim();
      }
      i--;
      continue;
    }
    const kv = l.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      let v = kv[2];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*-/.test(lines[i + 1])) v += " " + lines[++i].trim();
      fm[kv[1]] = v.replace(/^'(.*)'$/s, "$1").replace(/''/g, "'");
    }
  }
  return fm;
}

function readEntities() {
  const out = [];
  for (const [d, type] of [["ideas", "idea"], ["concepts", "concept"], ["decisions", "decision"], ["implementation-plans", "plan"], ["notes", "note"], ["reviews", "review"]]) {
    const p = join(ROOT, "docs", d);
    if (!existsSync(p)) continue;
    for (const f of readdirSync(p).filter((n) => n.endsWith(".md"))) {
      const fm = parseFrontmatter(readFileSync(join(p, f), "utf8"));
      if (fm?.id) out.push({ id: fm.id, type, title: fm.title ?? f, status: fm.status ?? "-", path: `docs/${d}/${f}`, links: fm.links });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// ---- answers ----
const config2 = JSON.parse(readFileSync(join(ROOT, "experiments", "nebius_faq_iter2", "config.json"), "utf8"));
const DET = Object.fromEntries(Object.entries(config2.detector).map(([k, v]) => [k, new RegExp(v, "g")]));
function spans(text) {
  const out = [];
  for (const [kind, re] of Object.entries(DET)) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      let end = m.index + m[0].length;
      // The URL detector only matches the prefix ("www."); extend the DISPLAY span to the end of the token.
      if (kind === "url") end += (text.slice(end).match(/^[^\s)\]>"']*/)?.[0] ?? "").replace(/[.,;:]+$/, "").length;
      out.push({ kind, start: m.index, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function readRun(experiment, runId) {
  const dir = join(EXP, experiment, runId);
  const answers = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json") && !["manifest.json", "analysis.json"].includes(n))) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (!("response" in j) && !("status" in j)) continue;
    const m = String(j.prompt_id).match(/^(.*?)(?:__([AB]))?$/);
    const msgs = j.messages ?? [];
    const text = String(j.response ?? "");
    answers.push({
      id: `${experiment}/${runId}/${f.replace(/\.json$/, "")}`,
      experiment, run_id: runId, file: rel(join(dir, f)), file_sha256: sha256(readFileSync(join(dir, f))),
      model: j.model, model_short: String(j.experiment).split("__")[0],
      topic: m[1].replace(/^german$/, "german_faq").replace(/^discharge$/, "discharge_letter").replace(/^privacy$/, "privacy_why").replace(/^visiting$/, "visiting_hours"),
      variant: m[2] ?? "baseline", rep: j.rep, status: j.status, finish_reason: j.finish_reason ?? null,
      usage: j.usage ?? null, latency_s: j.latency_s ?? null, temperature: j.temperature, seed: j.seed,
      system_prompt: msgs.find((x) => x.role === "system")?.content ?? "",
      user_prompt: msgs.filter((x) => x.role === "user").map((x) => x.content).join("\n"),
      response: text, spans: spans(text),
      // baseline calls did not record finish_reason; infer from the cap (marked inferred)
      truncated: j.finish_reason ? j.finish_reason === "length" : (j.usage?.completion ?? 0) >= (j.max_tokens ?? 1e9),
      truncated_inferred: !j.finish_reason,
    });
  }
  const manifestJson = existsSync(join(dir, "manifest.json")) ? JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) : null;
  return {
    experiment, run_id: runId, path: rel(dir), files: readdirSync(dir).length,
    manifest: verifyManifest(dir), config_sha256: manifestJson?.config_sha256 ?? null, config_file: manifestJson?.config_file ?? null,
    answers,
  };
}

const runs = [], answers = [];
for (const exp of dirs(EXP)) {
  for (const run of dirs(join(EXP, exp))) {
    const hasCalls = readdirSync(join(EXP, exp, run)).some((n) => /__/.test(n) && n.endsWith(".json"));
    if (hasCalls) {
      const r = readRun(exp, run);
      answers.push(...r.answers);
      runs.push({ ...r, answers: undefined, n_answers: r.answers.length });
    } else {
      runs.push({ experiment: exp, run_id: run, path: rel(join(EXP, exp, run)), files: readdirSync(join(EXP, exp, run)).length, manifest: verifyManifest(join(EXP, exp, run)), n_answers: 0, config_sha256: null, config_file: null });
    }
  }
}

// ---- committed analysis artifacts (read, not recomputed) ----
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const iter2Run = dirs(join(EXP, "nebius_faq_iter2")).sort().pop();
const iter4Run = dirs(join(EXP, "nebius_faq_iter4")).sort().pop();
const iter2 = iter2Run ? readJson(join(EXP, "nebius_faq_iter2", iter2Run, "analysis.json")) : null;
const iter4 = iter4Run ? readJson(join(EXP, "nebius_faq_iter4", iter4Run, "analysis.json")) : null;

// ---- cross-checks: surface disagreement, never resolve it silently ----
const warnings = [];
if (iter2) {
  for (const c of iter2.cells) {
    const mine = answers.filter((a) => a.experiment === "nebius_faq_iter2" && a.model_short === c.model && a.variant === c.variant);
    const fab = mine.filter((a) => a.spans.some((s) => ["phone", "url", "email"].includes(s.kind))).length;
    if (mine.length !== c.n) warnings.push(`iter2 ${c.model}/${c.variant}: analysis.json n=${c.n}, per-call files=${mine.length}`);
    if (fab !== c.fabricated) warnings.push(`iter2 ${c.model}/${c.variant}: analysis.json fabricated=${c.fabricated}, recomputed from answers=${fab}`);
  }
}
if (iter4) {
  for (const c of iter4.cells) {
    const mine = answers.filter((a) => a.model === c.model && a.topic === c.topic && ["nebius_faq_baseline", "nebius_faq_iter2"].includes(a.experiment));
    if (mine.length !== c.n) warnings.push(`iter4 ${c.model}/${c.topic}: analysis.json n=${c.n}, per-call files=${mine.length}`);
  }
}
for (const r of runs) if (r.manifest.status !== "verified") warnings.push(`${r.path}: manifest ${r.manifest.status}${r.manifest.mismatches.length ? " (" + r.manifest.mismatches.map((m) => m.file).join(", ") + ")" : ""}`);

// ---- iteration 3 (labels) and the riley matrix: report state, never invent ----
const csvRows = (p) => (existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").length - 1 : 0);
function labelledRows(p) {
  if (!existsSync(p)) return { rows: 0, labelled: 0 };
  const lines = readFileSync(p, "utf8").trim().split("\n");
  // naive CSV is unsafe for multiline answer_text; count records by item_id prefix and filled yes/no via regex
  const text = readFileSync(p, "utf8");
  const rows = (text.match(/^[A-Z]\d{2},/gm) ?? []).length;
  const labelled = (text.match(/,(yes|no),/gi) ?? []).length;
  return { rows: rows || lines.length - 1, labelled };
}
const i3 = join(EXP, "nebius_faq_iter3");
const iter3 = existsSync(i3) ? { items: csvRows(join(i3, "key.csv")), rater1: labelledRows(join(i3, "labels_rater1.csv")), rater2: labelledRows(join(i3, "labels_rater2.csv")) } : null;
const riley = join(EXP, "riley-leak-matrix");
const rileyState = { has_trials: existsSync(join(riley, "trials.jsonl")), files: existsSync(riley) ? readdirSync(riley) : [] };

let head = null;
try { head = execFileSync("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }

const corpus = {
  meta: { generated_at: new Date().toISOString(), git_head: head, source_root: "docs/data/experiments", detector: config2.detector },
  runs, answers, iter2, iter4, iter3, riley: rileyState, entities: readEntities(), warnings,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(corpus));
console.log(`corpus.json: ${answers.length} answers, ${runs.length} runs, ${corpus.entities.length} entities, ${warnings.length} warnings -> ${OUT}`);
for (const w of warnings) console.log("  warning:", w);
