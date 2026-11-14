// Pure helpers, kept in plain JS so `node --test` can import them without a TS toolchain.

/** Wilson score interval for k successes out of n (z = 1.96 -> 95 %). Returns [lo, hi] in 0..1. */
export function wilson(k, n, z = 1.96) {
  if (n <= 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** A criterion shows a floor/ceiling effect when every cell has the same value of exactly 0 or exactly 1. */
export function floorCeiling(values) {
  if (!values.length) return null;
  const first = values[0];
  if (!values.every((v) => v === first)) return null;
  if (first === 1) return "ceiling";
  if (first === 0) return "floor";
  return null;
}

/** Weighted mean of per-cell rates, weights = cell size n. */
export function weighted(cells, key) {
  const total = cells.reduce((s, c) => s + c.n, 0);
  return total ? cells.reduce((s, c) => s + c[key] * c.n, 0) / total : 0;
}

export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const pct = (x, d = 0) => `${(x * 100).toFixed(d)} %`;
