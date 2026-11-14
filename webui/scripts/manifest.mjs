import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function verifyManifest(dir) {
  const mf = join(dir, "MANIFEST.sha256");
  if (!existsSync(mf)) return { status: "missing", checked: 0, mismatches: [], unlisted: 0 };
  const listed = new Set();
  const mismatches = [];
  let checked = 0;
  for (const line of readFileSync(mf, "utf8").split("\n")) {
    const m = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (!m) continue;
    listed.add(m[2]);
    const f = join(dir, m[2]);
    checked++;
    if (!existsSync(f)) mismatches.push({ file: m[2], reason: "file missing" });
    else if (sha256(readFileSync(f)) !== m[1]) mismatches.push({ file: m[2], reason: "sha256 differs" });
  }
  const unlisted = readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile() && n !== "MANIFEST.sha256" && !listed.has(n)).length;
  return { status: mismatches.length ? "mismatch" : "verified", checked, mismatches, unlisted };
}
