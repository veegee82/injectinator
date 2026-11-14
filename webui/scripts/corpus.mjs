// Corpus builder (ADR-0001). Read-only over <root>/docs. Pure function of the files on disk, safe to call repeatedly:
// a file that is half-written or unreadable becomes a warning, never an exception, because experiments are
// written while the UI is watching them.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { verifyManifest } from "./manifest.mjs";
import { parseTrialLine, summarize } from "../src/lib/outcome.js";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const LIVE_WINDOW_MS = 10 * 60 * 1000; // a run folder touched within this window counts as "in progress"
const DEFAULT_DETECTOR = { phone: "(\\+49|\\b0)\\d{2,4}[ /-]?\\d{5,9}\\b", url: "https?://|www\\.", email: "[\\w.+-]+@[\\w-]+\\.\\w+" };
const KB_DIRS = [["ideas", "idea"], ["concepts", "concept"], ["decisions", "decision"], ["implementation-plans", "plan"], ["notes", "note"], ["reviews", "review"]];

const safeStat = (p) => { try { return statSync(p); } catch { return null; } };
const listDir = (p) => { try { return readdirSync(p); } catch { return []; } };
const dirs = (p) => listDir(p).filter((n) => safeStat(join(p, n))?.isDirectory());

/** Cheap change detector: path|mtime|size of every file the corpus depends on. A stat walk, no reads, a few ms. */
export function fingerprint(root) {
  const lines = [];
  const walk = (dir, depth) => {
    for (const n of listDir(dir)) {
      const p = join(dir, n), st = safeStat(p);
      if (!st) continue;
      if (st.isDirectory()) { lines.push(`d|${p}|${Math.floor(st.mtimeMs)}`); if (depth < 4) walk(p, depth + 1); }
      else lines.push(`f|${p}|${Math.floor(st.mtimeMs)}|${st.size}`);
    }
  };
  walk(join(root, "docs", "data", "experiments"), 0);
  for (const [d] of KB_DIRS) walk(join(root, "docs", d), 3);
  return createHash("sha1").update(lines.sort().join("\n")).digest("hex").slice(0, 16);
}

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

function readEntities(ROOT) {
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


export function buildCorpus(root, fp = fingerprint(root)) {
  const EXP = join(root, "docs", "data", "experiments");
  const rel = (p) => p.slice(root.length + 1);
  const warnings = [], activity = [];
  const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { if (existsSync(p)) warnings.push(`${rel(p)}: unreadable (${e.code ?? "invalid JSON"}) - may still be being written`); return null; } };

  const cfg = readJson(join(root, "experiments", "nebius_faq_iter2", "config.json"));
  const detector = cfg?.detector ?? DEFAULT_DETECTOR;
  const DET = Object.fromEntries(Object.entries(detector).map(([k, v]) => [k, new RegExp(v, "g")]));
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
    return out.sort((x, y) => x.start - y.start);
  }

  function readRun(experiment, runId) {
    const dir = join(EXP, experiment, runId);
    const names = listDir(dir);
    const answers = [];
    for (const f of names.filter((n) => n.endsWith(".json") && !["manifest.json", "analysis.json"].includes(n))) {
      const path = join(dir, f);
      const j = readJson(path);
      if (!j || (!("response" in j) && !("status" in j))) continue;
      const m = String(j.prompt_id).match(/^(.*?)(?:__([AB]))?$/);
      const msgs = j.messages ?? [];
      const text = String(j.response ?? "");
      answers.push({
        id: `${experiment}/${runId}/${f.replace(/\.json$/, "")}`,
        experiment, run_id: runId, file: rel(path), file_sha256: sha256(readFileSync(path)),
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
    const manifestJson = readJson(join(dir, "manifest.json"));
    return { dir, names, answers, manifestJson };
  }

  const runs = [], answers = [];
  const now = Date.now();
  for (const exp of dirs(EXP)) {
    for (const run of dirs(join(EXP, exp))) {
      const dir = join(EXP, exp, run);
      const r = readRun(exp, run);
      answers.push(...r.answers);
      const manifest = verifyManifest(dir);
      const newest = Math.max(safeStat(dir)?.mtimeMs ?? 0, ...r.names.map((n) => safeStat(join(dir, n))?.mtimeMs ?? 0));
      const live = manifest.status === "missing" && now - newest < LIVE_WINDOW_MS;
      const state = manifest.status === "verified" ? "sealed" : manifest.status === "mismatch" ? "mismatch" : live ? "in_progress" : "unsealed";
      runs.push({ experiment: exp, run_id: run, path: rel(dir), files: r.names.length, manifest, n_answers: r.answers.length, config_sha256: r.manifestJson?.config_sha256 ?? null, config_file: r.manifestJson?.config_file ?? null, state, last_write: new Date(newest).toISOString() });
      if (state === "in_progress") activity.push(`${rel(dir)}: in progress (${r.answers.length} answers so far, no manifest yet)`);
      else if (state !== "sealed") warnings.push(`${rel(dir)}: manifest ${manifest.status}${manifest.mismatches.length ? " (" + manifest.mismatches.map((m) => m.file).join(", ") + ")" : ""}`);
    }
  }

  // ---- committed analysis artifacts (read, not recomputed) ----
  const latest = (exp) => { const d = dirs(join(EXP, exp)).filter((r) => existsSync(join(EXP, exp, r, "analysis.json"))).sort().pop(); return d ? readJson(join(EXP, exp, d, "analysis.json")) : null; };
  const iter2 = latest("nebius_faq_iter2"), iter4 = latest("nebius_faq_iter4");

  // ---- cross-checks: surface disagreement, never resolve it silently ----
  if (iter2) for (const c of iter2.cells ?? []) {
    const mine = answers.filter((a) => a.experiment === "nebius_faq_iter2" && a.model_short === c.model && a.variant === c.variant);
    const fab = mine.filter((a) => a.spans.some((s) => ["phone", "url", "email"].includes(s.kind))).length;
    if (mine.length !== c.n) warnings.push(`iter2 ${c.model}/${c.variant}: analysis.json n=${c.n}, per-call files=${mine.length}`);
    if (fab !== c.fabricated) warnings.push(`iter2 ${c.model}/${c.variant}: analysis.json fabricated=${c.fabricated}, recomputed from answers=${fab}`);
  }
  if (iter4) for (const c of iter4.cells ?? []) {
    const mine = answers.filter((a) => a.model === c.model && a.topic === c.topic && ["nebius_faq_baseline", "nebius_faq_iter2"].includes(a.experiment));
    if (mine.length !== c.n) warnings.push(`iter4 ${c.model}/${c.topic}: analysis.json n=${c.n}, per-call files=${mine.length}`);
  }

  // ---- iteration 3 (labels) ----
  const csvRows = (p) => (existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").length - 1 : 0);
  function labelledRows(p) {
    if (!existsSync(p)) return { rows: 0, labelled: 0 };
    const text = readFileSync(p, "utf8");
    return { rows: (text.match(/^[A-Z]\d{2},/gm) ?? []).length || text.trim().split("\n").length - 1, labelled: (text.match(/,(yes|no),/gi) ?? []).length };
  }
  const i3 = join(EXP, "nebius_faq_iter3");
  const iter3 = existsSync(i3) ? { items: csvRows(join(i3, "key.csv")), rater1: labelledRows(join(i3, "labels_rater1.csv")), rater2: labelledRows(join(i3, "labels_rater2.csv")) } : null;

  // ---- riley leak matrix: trials.jsonl, classified by the preregistered rubric (src/lib/outcome.js) ----
  const riley = join(EXP, "riley-leak-matrix");
  const trials = [];
  const tf = join(riley, "trials.jsonl");
  if (existsSync(tf)) {
    let text = "";
    try { text = readFileSync(tf, "utf8"); } catch { warnings.push(`${rel(tf)}: unreadable`); }
    text.split("\n").forEach((line, i) => {
      if (!line.trim()) return;
      const r = parseTrialLine(line, i + 1);
      if ("error" in r) warnings.push(r.error); else trials.push(r.trial);
    });
  }
  const trialSummary = summarize(trials);
  if (trialSummary.duplicateTurnIds) warnings.push(`trials.jsonl: ${trialSummary.duplicateTurnIds} duplicate turn_id(s)`);
  const rileyState = { has_trials: trials.length > 0, files: listDir(riley), manifest: existsSync(riley) ? verifyManifest(riley) : null, path: rel(riley) };

  return {
    meta: { generated_at: new Date().toISOString(), git_head: null, source_root: "docs/data/experiments", detector, fingerprint: fp },
    runs, answers, iter2, iter4, iter3, riley: rileyState, trials, trial_summary: trialSummary,
    entities: readEntities(root), warnings, activity,
  };
}
