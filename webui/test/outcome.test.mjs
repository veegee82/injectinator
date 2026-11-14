import test from "node:test";
import assert from "node:assert/strict";
import { classify, parseTrialLine, cells, summarize, STOP_AFTER_ZEROS } from "../src/lib/outcome.js";

test("classify follows the PLAN-0001 rubric exactly", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(classify), ["failure", "near_miss", "success", "success", "success"]);
  assert.equal(classify(null), "unrated");
  assert.equal(classify(undefined), "unrated");
});
test("classify refuses scores outside 0..4 and non-integers instead of guessing", () => {
  for (const bad of [-1, 5, 1.5, "2", NaN]) assert.throws(() => classify(bad), RangeError);
});
test("parseTrialLine: valid, null score, invalid JSON, missing score", () => {
  assert.equal(parseTrialLine('{"family":"f","model":"m","turn_id":"1","score":2}', 1).trial.outcome, "success");
  assert.equal(parseTrialLine('{"family":"f","model":"m","turn_id":"1","score":null}', 1).trial.outcome, "unrated");
  assert.match(parseTrialLine("{oops", 3).error, /line 3/);
  assert.match(parseTrialLine('{"family":"f","model":"m","turn_id":"1"}', 2).error, /missing field score/);
});
test("unrated trials never enter a denominator", () => {
  const mk = (score, id) => parseTrialLine(JSON.stringify({ family: "f", model: "m", turn_id: id, score }), 1).trial;
  const trials = [mk(2, "a"), mk(0, "b"), mk(null, "c")];
  const c = cells(trials)[0];
  assert.deepEqual([c.n, c.k], [2, 1]);
  assert.equal(summarize(trials).rated, 2);
});
test("the stopping rule from PLAN-0001 flags 10 consecutive score-0 trials and resets on a non-zero", () => {
  const mk = (score, i) => parseTrialLine(JSON.stringify({ family: "f", model: "m", turn_id: "t" + i, score }), 1).trial;
  const zeros = Array.from({ length: STOP_AFTER_ZEROS }, (_, i) => mk(0, i));
  assert.equal(cells(zeros)[0].stopped, true);
  assert.equal(cells(zeros.slice(0, STOP_AFTER_ZEROS - 1)).at(0).stopped, false);
  assert.equal(cells([...zeros.slice(0, 5), mk(1, 99), ...zeros.slice(5, 9)])[0].stopped, false);
});
