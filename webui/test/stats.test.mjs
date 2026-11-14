import test from "node:test";
import assert from "node:assert/strict";
import { wilson, floorCeiling, weighted, median } from "../src/lib/stats.js";

const close = (a, b, e = 0.005) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test("wilson 0/10 has a non-zero upper bound (a rate of 0 is not certainty)", () => {
  const [lo, hi] = wilson(0, 10);
  assert.equal(lo, 0);
  close(hi, 0.2775);
});
test("wilson 5/10 is symmetric around 0.5", () => {
  const [lo, hi] = wilson(5, 10);
  close(lo, 0.2366); close(hi, 0.7634);
});
test("wilson with n=0 is the whole range, not NaN", () => {
  assert.deepEqual(wilson(0, 0), [0, 1]);
});
test("floorCeiling flags uniform 1 and uniform 0 only", () => {
  assert.equal(floorCeiling([1, 1, 1]), "ceiling");
  assert.equal(floorCeiling([0, 0]), "floor");
  assert.equal(floorCeiling([0, 1]), null);
  assert.equal(floorCeiling([0.5, 0.5]), null);
  assert.equal(floorCeiling([]), null);
});
test("weighted weights by cell size", () => {
  close(weighted([{ n: 2, r: 1 }, { n: 12, r: 0 }], "r"), 2 / 14, 1e-9);
});
test("median", () => { assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5); assert.equal(median([]), null); });
