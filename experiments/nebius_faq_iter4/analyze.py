#!/usr/bin/env python3
"""Iteration 4: apply calibrated rule-based criteria (criteria.py) to the full existing
corpus (iterations 1+2), no new model calls. Usage: python3 analyze.py <out_dir>
Writes analysis.json/.csv into <out_dir>. Never copies raw answer text into the summary;
response text stays only in the already-existing per-call JSON files it reads from."""
import csv
import glob
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

from criteria import CRITERIA, topic_base

ROOT = Path(__file__).resolve().parents[2] / "docs" / "data" / "experiments"
SOURCE_GLOBS = [
    "nebius_faq_baseline/*/*__*__1.json",
    "nebius_faq_iter2/*/*__*__*.json",
]


def load_corpus():
    files = []
    for g in SOURCE_GLOBS:
        files += sorted(ROOT.glob(g))
    trials = []
    for f in files:
        t = json.load(open(f, encoding="utf-8"))
        if t.get("status") != "ok":
            continue
        pid = t["prompt_id"] if "__" in t["prompt_id"] else t["prompt_id"] + "__A"
        t["prompt_id"] = pid
        t["_source"] = str(f.relative_to(ROOT))
        trials.append(t)
    return trials


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    trials = load_corpus()
    cells = defaultdict(list)
    for t in trials:
        cells[(t["model"], topic_base(t["prompt_id"]))].append(t)

    rows = []
    for (model, topic), ts in sorted(cells.items()):
        scored = {name: [fn(t)["label"] for t in ts] for name, fn in CRITERIA.items()}
        row = {"model": model, "topic": topic, "n": len(ts)}
        row["refusal_rate"] = round(sum(l == 0 for l in scored["refusal_vs_answer"]) / len(ts), 3)
        row["hedge_rate"] = round(sum(l == 1 for l in scored["refusal_vs_answer"]) / len(ts), 3)
        row["direct_answer_rate"] = round(sum(l == 2 for l in scored["refusal_vs_answer"]) / len(ts), 3)
        row["any_invented_specific_rate"] = round(sum(l > 0 for l in scored["invented_specifics"]) / len(ts), 3)
        row["on_topic_rate"] = round(statistics.mean(scored["on_topic"]), 3)
        row["language_match_rate"] = round(statistics.mean(scored["language_match"]), 3)
        rows.append(row)

    totals = {}
    for key in ("refusal_rate", "hedge_rate", "direct_answer_rate", "any_invented_specific_rate",
                "on_topic_rate", "language_match_rate"):
        weighted = sum(r[key] * r["n"] for r in rows) / sum(r["n"] for r in rows)
        totals[key] = round(weighted, 3)
    totals["n_total"] = sum(r["n"] for r in rows)
    totals["n_cells"] = len(rows)

    json.dump({"cells": rows, "totals": totals,
               "criteria_module_note": "see criteria.py for exact patterns and scales"},
              open(out / "analysis.json", "w"), indent=2)
    with open(out / "analysis.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    for r in rows:
        print(r)
    print("\nTOTALS:", totals)
    return 0


if __name__ == "__main__":
    sys.exit(main())
