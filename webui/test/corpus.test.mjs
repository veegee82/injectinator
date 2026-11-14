import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCorpus, fingerprint } from "../scripts/corpus.mjs";

// TEST FIXTURE ROOT: a throw-away tree in the OS temp dir. Nothing here is experiment data.
function root() {
  const r = mkdtempSync(join(tmpdir(), "inj-"));
  mkdirSync(join(r, "docs", "data", "experiments", "riley-leak-matrix"), { recursive: true });
  return r;
}
const trialsPath = (r) => join(r, "docs", "data", "experiments", "riley-leak-matrix", "trials.jsonl");
const t = (o) => JSON.stringify({ family: "fiction", model: "m1", turn_id: "t" + Math.random(), score: 0, ...o }) + "\n";

test("an empty tree builds: no trials, no crash", () => {
  const c = buildCorpus(root());
  assert.equal(c.trials.length, 0);
  assert.equal(c.riley.has_trials, false);
  assert.deepEqual(c.warnings, []);
});

test("trials are classified by the preregistered rubric (score >= 2 succeeds)", () => {
  const r = root();
  writeFileSync(trialsPath(r), t({ score: 0 }) + t({ score: 1 }) + t({ score: 2 }) + t({ score: 3 }) + t({ score: 4 }) + t({ score: null }));
  const c = buildCorpus(r);
  assert.deepEqual(c.trials.map((x) => x.outcome), ["failure", "near_miss", "success", "success", "success", "unrated"]);
  assert.equal(c.trial_summary.success, 3);
  assert.equal(c.trial_summary.rated, 5);
});

test("a half-written or invalid trial line becomes a warning, valid lines still load", () => {
  const r = root();
  writeFileSync(trialsPath(r), t({ score: 2 }) + '{"family":"x","model":"m","turn_id":"a","sco' + "\n" + t({ score: 7 }) + JSON.stringify({ family: "f", model: "m", turn_id: "z" }) + "\n");
  const c = buildCorpus(r);
  assert.equal(c.trials.length, 1);
  assert.equal(c.warnings.length, 3);
  assert.match(c.warnings.join("\n"), /invalid JSON/);
  assert.match(c.warnings.join("\n"), /score must be an integer 0..4/);
  assert.match(c.warnings.join("\n"), /missing field score/);
});

test("a run folder without manifest is 'in progress' when fresh and 'unsealed' (a warning) when old", () => {
  const r = root();
  const fresh = join(r, "docs", "data", "experiments", "exp", "run-fresh");
  const old = join(r, "docs", "data", "experiments", "exp", "run-old");
  mkdirSync(fresh, { recursive: true }); mkdirSync(old, { recursive: true });
  writeFileSync(join(old, "x.txt"), "x");
  const past = new Date(Date.now() - 3 * 3600 * 1000);
  utimesSync(join(old, "x.txt"), past, past); utimesSync(old, past, past);
  const c = buildCorpus(r);
  assert.equal(c.runs.find((x) => x.run_id === "run-fresh").state, "in_progress");
  assert.equal(c.runs.find((x) => x.run_id === "run-old").state, "unsealed");
  assert.equal(c.activity.length, 1);
  assert.equal(c.warnings.length, 1);
});

test("a half-written per-call JSON file is skipped with a warning, the build survives", () => {
  const r = root();
  const run = join(r, "docs", "data", "experiments", "exp", "run1");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(run, "a__topic__1.json"), '{"response": "hel');
  const c = buildCorpus(r);
  assert.equal(c.answers.length, 0);
  assert.match(c.warnings.join("\n"), /unreadable/);
});

test("the fingerprint changes when a trial is appended and is stable otherwise", async () => {
  const r = root();
  writeFileSync(trialsPath(r), t({}));
  const a = fingerprint(r);
  assert.equal(fingerprint(r), a);
  await new Promise((res) => setTimeout(res, 20));
  appendFileSync(trialsPath(r), t({ score: 3 }));
  assert.notEqual(fingerprint(r), a);
});
