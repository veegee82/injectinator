import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyManifest } from "../scripts/manifest.mjs";

function fixture() {
  const d = mkdtempSync(join(tmpdir(), "mf-"));
  writeFileSync(join(d, "a.json"), '{"x":1}');
  writeFileSync(join(d, "b.json"), '{"y":2}');
  const h = (f) => createHash("sha256").update(Buffer.from(f === "a.json" ? '{"x":1}' : '{"y":2}')).digest("hex");
  writeFileSync(join(d, "MANIFEST.sha256"), `${h("a.json")}  a.json\n${h("b.json")}  b.json\n`);
  return d;
}

test("an intact folder verifies", () => {
  const r = verifyManifest(fixture());
  assert.equal(r.status, "verified");
  assert.equal(r.checked, 2);
});

test("a tampered file turns the run into a mismatch and names the file", () => {
  const d = fixture();
  appendFileSync(join(d, "b.json"), " ");
  const r = verifyManifest(d);
  assert.equal(r.status, "mismatch");
  assert.deepEqual(r.mismatches.map((m) => m.file), ["b.json"]);
});

test("a folder without MANIFEST.sha256 is reported missing, not verified", () => {
  const d = mkdtempSync(join(tmpdir(), "mf-"));
  assert.equal(verifyManifest(d).status, "missing");
});

test("an unlisted extra file is counted", () => {
  const d = fixture();
  writeFileSync(join(d, "extra.json"), "{}");
  assert.equal(verifyManifest(d).unlisted, 1);
});
