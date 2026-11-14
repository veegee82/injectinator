#!/usr/bin/env python3
"""Sequential, config-driven experiment runner with per-run persistence and evaluation.

Usage:
    python3 runner.py run  experiments.json [--out results] [--only ID ...] [--dry-run]
    python3 runner.py eval results/<run_id>

Design:
  * Prompts, models and parameters are separate sections in the config, so every
    trial records exactly (prompt_id, model, temperature, seed, max_tokens).
  * Experiments run one after another; a failing experiment is recorded with
    status "error" and the sequence continues.
  * Secrets are read from environment variables named in the config (key_env),
    never from the config file, and are never written to any output.
  * Standard library only.
"""
import argparse
import csv
import hashlib
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def load_dotenv_simple(path=".env"):
    """Read KEY=VALUE lines from .env into os.environ (existing variables win). Never prints values."""
    f = Path(path)
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# ---------------------------------------------------------------- backends
def _post(url, body, headers, timeout):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def call_echo(messages, p, backend):
    return {"text": "echo: " + messages[-1]["content"], "usage": {}}


def call_ollama(messages, p, backend):
    base = backend.get("base_url", "http://localhost:11434").rstrip("/")
    options = {"temperature": p["temperature"], "num_predict": p["max_tokens"]}
    if p.get("seed") is not None:
        options["seed"] = p["seed"]
    data = _post(f"{base}/api/chat", {"model": p["model"], "messages": messages,
                                      "stream": False, "options": options}, {}, p["timeout"])
    return {"text": data["message"]["content"], "finish_reason": data.get("done_reason"),
            "usage": {"prompt": data.get("prompt_eval_count"), "completion": data.get("eval_count")}}


def call_openai_compatible(messages, p, backend):
    key = os.environ.get(backend["key_env"], "")
    if not key:
        raise RuntimeError(f"environment variable {backend['key_env']} is not set")
    body = {"model": p["model"], "messages": messages,
            "temperature": p["temperature"], "max_tokens": p["max_tokens"]}
    if p.get("seed") is not None:
        body["seed"] = p["seed"]
    data = _post(backend["base_url"].rstrip("/") + "/chat/completions", body,
                 {"Authorization": f"Bearer {key}"}, p["timeout"])
    u = data.get("usage") or {}
    return {"text": data["choices"][0]["message"]["content"],
            "finish_reason": data["choices"][0].get("finish_reason"),
            "usage": {"prompt": u.get("prompt_tokens"), "completion": u.get("completion_tokens")}}


CALLERS = {"echo": call_echo, "ollama": call_ollama, "openai_compatible": call_openai_compatible}


# ---------------------------------------------------------------- run
def load_config(path):
    raw = Path(path).read_bytes()
    cfg = json.loads(raw)
    for k in ("backends", "prompts", "experiments"):
        if k not in cfg:
            raise SystemExit(f"config misses section '{k}'")
    return cfg, hashlib.sha256(raw).hexdigest()


def build_messages(prompt):
    msgs = []
    if prompt.get("system"):
        msgs.append({"role": "system", "content": prompt["system"]})
    for turn in prompt["turns"]:
        msgs.append({"role": "user", "content": turn})
    return msgs


def run(args):
    cfg, cfg_hash = load_config(args.config)
    defaults = {"temperature": 0.0, "seed": 0, "max_tokens": 512, "timeout": 120, "repeat": 1}
    defaults.update(cfg.get("defaults", {}))
    base_id = time.strftime("%Y%m%d-%H%M%S")
    run_id, n = base_id, 1
    while (Path(args.out) / run_id).exists():  # two runs within one second
        n += 1
        run_id = f"{base_id}-{n}"
    out = Path(args.out) / run_id
    out.mkdir(parents=True)
    log = (out / "run.log").open("a", encoding="utf-8")

    def say(msg):
        line = f"{time.strftime('%H:%M:%S')} {msg}"
        print(line)
        log.write(line + "\n")
        log.flush()

    (out / "manifest.json").write_text(json.dumps(
        {"run_id": run_id, "config_file": str(args.config), "config_sha256": cfg_hash,
         "defaults": defaults}, indent=2), encoding="utf-8")
    exps = [e for e in cfg["experiments"] if not args.only or e["id"] in args.only]
    say(f"run {run_id}: {len(exps)} experiment(s), config sha256 {cfg_hash[:12]}")
    counts = {"ok": 0, "error": 0}
    for e in exps:
        p = {**defaults, **{k: v for k, v in e.items() if k not in ("id", "backend", "prompt")}}
        for rep in range(1, int(p["repeat"]) + 1):
            trial = {"experiment": e["id"], "rep": rep, "backend": e["backend"],
                     "prompt_id": e["prompt"], "model": p["model"], "temperature": p["temperature"],
                     "seed": p["seed"], "max_tokens": p["max_tokens"]}
            t0 = time.time()
            try:
                prompt = cfg["prompts"][e["prompt"]]
                messages = build_messages(prompt)
                trial["messages"] = messages
                if args.dry_run:
                    trial.update(status="dry_run")
                else:
                    backend = cfg["backends"][e["backend"]]
                    res = CALLERS[backend["type"]](messages, p, backend)
                    trial.update(status="ok", response=res["text"], usage=res["usage"],
                                 finish_reason=res.get("finish_reason"))
                counts["ok" if trial["status"] != "error" else "error"] += 1
            except Exception as ex:  # isolate every experiment
                trial.update(status="error", error=f"{type(ex).__name__}: {str(ex)[:300]}")
                counts["error"] += 1
            trial["latency_s"] = round(time.time() - t0, 3)
            (out / f"{e['id']}__{rep}.json").write_text(
                json.dumps(trial, indent=2, ensure_ascii=False), encoding="utf-8")
            say(f"{e['id']} rep {rep}: {trial['status']} ({trial['latency_s']}s)"
                + (f" - {trial['error']}" if trial["status"] == "error" else ""))
    say(f"finished: {counts['ok']} ok, {counts['error']} error")
    print(f"results: {out}\nevaluate with: python3 {sys.argv[0]} eval {out}")
    return 0


# ---------------------------------------------------------------- eval
def evaluate(args):
    d = Path(args.run_dir)
    manifest = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
    cfg, _ = load_config(manifest["config_file"]) if Path(manifest["config_file"]).exists() else ({"prompts": {}}, "")
    trials = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(d.glob("*__*.json"))]
    rows = []
    for exp in sorted({t["experiment"] for t in trials}):
        ts = [t for t in trials if t["experiment"] == exp]
        ok = [t for t in ts if t["status"] == "ok"]
        pattern = cfg["prompts"].get(ts[0]["prompt_id"], {}).get("expect_regex")
        hit = (sum(bool(re.search(pattern, t["response"], re.S)) for t in ok) / len(ok)
               if pattern and ok else "")
        rows.append({
            "experiment": exp, "model": ts[0]["model"], "prompt_id": ts[0]["prompt_id"],
            "trials": len(ts), "ok": len(ok), "errors": len(ts) - len(ok),
            "mean_latency_s": round(statistics.mean(t["latency_s"] for t in ts), 3),
            "median_latency_s": round(statistics.median(t["latency_s"] for t in ts), 3),
            "truncated": sum(t.get("finish_reason") == "length" for t in ok),
            "mean_response_chars": round(statistics.mean(len(t["response"]) for t in ok), 1) if ok else "",
            "expect_regex_match_rate": round(hit, 3) if hit != "" else "",
        })
    # Never overwrite a sealed run's summary: a MANIFEST.sha256 pins it.
    target = d / ("summary.reeval.csv" if (d / "MANIFEST.sha256").exists() else "summary.csv")
    with target.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(" | ".join(f"{k}={v}" for k, v in r.items()))
    print(f"summary: {target}")
    return 0


def main():
    load_dotenv_simple()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("config")
    r.add_argument("--out", default="results")
    r.add_argument("--only", nargs="*")
    r.add_argument("--dry-run", action="store_true")
    r.set_defaults(fn=run)
    e = sub.add_parser("eval")
    e.add_argument("run_dir")
    e.set_defaults(fn=evaluate)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == "__main__":
    main()
