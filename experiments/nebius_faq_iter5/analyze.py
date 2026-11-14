#!/usr/bin/env python3
"""Iteration 5 analysis: applies criteria.py to THIS run's own corpus only (not iter 1/2).
Usage: python3 analyze.py <run_dir>"""
import csv, glob, json, statistics, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "nebius_faq_iter4"))
from criteria import CRITERIA, topic_base

run = Path(sys.argv[1])
trials = []
for f in sorted(run.glob("*__*.json")):
    t = json.load(open(f, encoding="utf-8"))
    if t.get("status") == "ok":
        trials.append(t)

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

json.dump({"cells": rows, "n_total": len(trials)}, open(run / "analysis.json", "w"), indent=2)
with open(run / "analysis.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
for r in rows: print(r)
print("n_total:", len(trials))
