import { useCallback, useEffect, useRef, useState } from "react";
import type { Corpus } from "./types";

export type Change = { at: number; answers: number; runs: number; trials: number; successes: number; text: string };
export type LiveState = { status: "live" | "paused" | "offline"; lastChecked: number | null; lastUpdated: number | null; change: Change | null; failures: number };
export type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; corpus: Corpus; live: LiveState; setPaused: (p: boolean) => void; dismiss: () => void; refreshNow: () => void };

/** Poll interval. Overridable at build/dev time (VITE_POLL_MS) so the e2e test does not wait seconds. */
export const POLL_MS = Number(import.meta.env.VITE_POLL_MS) || 4000;
const MAX_BACKOFF_MS = 30000;

export function describeChange(prev: Corpus, next: Corpus): Change {
  const answers = next.answers.length - prev.answers.length;
  const runs = next.runs.length - prev.runs.length;
  const trials = next.trials.length - prev.trials.length;
  const successes = next.trial_summary.success - prev.trial_summary.success;
  const parts: string[] = [];
  if (answers) parts.push(`${answers > 0 ? "+" : ""}${answers} answer${Math.abs(answers) === 1 ? "" : "s"}`);
  if (trials) parts.push(`${trials > 0 ? "+" : ""}${trials} trial${Math.abs(trials) === 1 ? "" : "s"}${successes > 0 ? ` (${successes} succeeded)` : ""}`);
  if (runs) parts.push(`${runs > 0 ? "+" : ""}${runs} run${Math.abs(runs) === 1 ? "" : "s"}`);
  return { at: Date.now(), answers, runs, trials, successes, text: parts.join(" · ") || "data changed" };
}

async function fetchCorpus(): Promise<Corpus> {
  const r = await fetch("./data/corpus.json", { cache: "no-cache" }); // the browser revalidates with the ETag: unchanged = 304
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Loads the corpus and keeps it current by polling. Keeps the last good data when a poll fails; never blanks the page. */
export function useCorpus(): Load {
  const [first, setFirst] = useState<{ state: "loading" } | { state: "error"; message: string }>({ state: "loading" });
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [live, setLive] = useState<LiveState>({ status: "live", lastChecked: null, lastUpdated: null, change: null, failures: 0 });
  const paused = useRef(false);
  const current = useRef<Corpus | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const failures = useRef(0);

  const poll = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!paused.current && !document.hidden) {
      try {
        const next = await fetchCorpus();
        failures.current = 0;
        const prev = current.current;
        if (!prev || prev.meta.fingerprint !== next.meta.fingerprint) {
          current.current = next;
          document.documentElement.dataset.corpusFp = next.meta.fingerprint; // observable by tests and by curious humans
          setCorpus(next);
          setLive((l) => ({ ...l, status: "live", failures: 0, lastChecked: Date.now(), lastUpdated: Date.now(), change: prev ? describeChange(prev, next) : null }));
        } else setLive((l) => ({ ...l, status: "live", failures: 0, lastChecked: Date.now() }));
      } catch (e) {
        failures.current++;
        if (!current.current) setFirst({ state: "error", message: String((e as Error).message ?? e) });
        setLive((l) => ({ ...l, status: "offline", failures: failures.current }));
      }
    }
    const delay = failures.current ? Math.min(POLL_MS * 2 ** failures.current, MAX_BACKOFF_MS) : POLL_MS;
    timer.current = window.setTimeout(poll, delay);
  }, []);

  useEffect(() => {
    poll();
    const vis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.clearTimeout(timer.current); document.removeEventListener("visibilitychange", vis); };
  }, [poll]);

  const setPaused = useCallback((p: boolean) => { paused.current = p; setLive((l) => ({ ...l, status: p ? "paused" : "live" })); if (!p) poll(); }, [poll]);
  const dismiss = useCallback(() => setLive((l) => ({ ...l, change: null })), []);
  if (!corpus) return first;
  return { state: "ready", corpus, live, setPaused, dismiss, refreshNow: poll };
}
