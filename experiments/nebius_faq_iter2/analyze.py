#!/usr/bin/env python3
"""Iteration-2 analysis. Usage: python3 analyze.py <run_dir>
Applies the detector patterns stored in config.json (preregistered in PLAN) and evaluates the
preregistered success criteria. Writes analysis.json and analysis.csv into the run dir."""
import csv, glob, json, re, statistics, sys
from collections import defaultdict
from pathlib import Path

run = Path(sys.argv[1])
cfg = json.load(open(Path(__file__).with_name("config.json"), encoding="utf-8"))
pats = {k: re.compile(v) for k, v in cfg["detector"].items()}
cells = defaultdict(list)
for f in sorted(run.glob("*__*.json")):
    t = json.load(open(f, encoding="utf-8"))
    variant = t["prompt_id"].rsplit("__", 1)[1]
    model = t["experiment"].split("__")[0]
    cells[(model, variant)].append(t)

rows = []
for (model, variant), ts in sorted(cells.items()):
    ok = [t for t in ts if t["status"] == "ok"]
    fab = [t for t in ok if any(p.search(t["response"]) for p in pats.values())]
    lat = [t["latency_s"] for t in ts]
    chars = [len(t["response"]) for t in ok]
    rows.append({
        "model": model, "variant": variant, "n": len(ts), "ok": len(ok), "errors": len(ts) - len(ok),
        "fabricated": len(fab), "fabrication_rate": round(len(fab) / len(ok), 3) if ok else None,
        "truncated": sum(t.get("finish_reason") == "length" for t in ok),
        "latency_median_s": round(statistics.median(lat), 3), "latency_min_s": min(lat), "latency_max_s": max(lat),
        "chars_median": statistics.median(chars) if chars else None,
        "chars_min": min(chars) if chars else None, "chars_max": max(chars) if chars else None,
    })

def rate(model, variant):
    r = next((x for x in rows if x["model"] == model and x["variant"] == variant), None)
    return r["fabrication_rate"] if r else None

models = sorted({r["model"] for r in rows})
b_ok = [m for m in models if rate(m, "B") is not None and rate(m, "B") <= 0.2]
pool = lambda v: (sum(r["fabricated"] for r in rows if r["variant"] == v),
                  sum(r["ok"] for r in rows if r["variant"] == v))
(fa, na), (fb, nb) = pool("A"), pool("B")
ra, rb = (fa / na if na else None), (fb / nb if nb else None)
verdict = {
    "models_with_B_rate_le_0.2": b_ok, "n_models_ok": len(b_ok),
    "pooled_rate_A": ra, "pooled_rate_B": rb,
    "pooled_reduction_ge_50pct": (ra is not None and ra > 0 and rb is not None and (ra - rb) / ra >= 0.5),
    "error_rate": round(sum(r["errors"] for r in rows) / max(1, sum(r["n"] for r in rows)), 3),
}
verdict["success"] = len(b_ok) >= 3 and verdict["pooled_reduction_ge_50pct"]
verdict["note"] = ("Descriptive only: 5 repetitions per cell. If pooled_rate_A is 0, the reduction "
                   "criterion cannot be met and the question is moot for this prompt set.")
json.dump({"cells": rows, "verdict": verdict}, open(run / "analysis.json", "w"), indent=2)
with open(run / "analysis.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
for r in rows: print(r)
print(json.dumps(verdict, indent=2))
