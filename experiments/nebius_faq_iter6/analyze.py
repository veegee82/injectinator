#!/usr/bin/env python3
import csv, json, sys
from pathlib import Path
from collections import defaultdict
sys.path.insert(0, str(Path(__file__).parent))
from criterion import disclaimer_contradicts_content as score

run = Path(sys.argv[1])
cells = defaultdict(list)
for f in sorted(run.glob("*__*.json")):
    t = json.load(open(f, encoding="utf-8"))
    if t.get("status") == "ok":
        cells[(t["model"], t["prompt_id"])].append(score(t["response"])["label"])

rows = []
for (model, prompt), labels in sorted(cells.items()):
    n = len(labels)
    rows.append({"model": model, "prompt": prompt, "n": n,
                 "contradiction_rate": round(sum(l == 2 for l in labels) / n, 3),
                 "consistent_rate": round(sum(l == 1 for l in labels) / n, 3),
                 "neither_rate": round(sum(l == 0 for l in labels) / n, 3)})
json.dump({"cells": rows}, open(run / "analysis.json", "w"), indent=2)
with open(run / "analysis.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
for r in rows: print(r)
pooled = sum(r["contradiction_rate"] * r["n"] for r in rows) / sum(r["n"] for r in rows)
print("pooled contradiction_rate:", round(pooled, 3))
