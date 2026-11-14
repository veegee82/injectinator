import { useEffect, useState } from "react";
import type { Corpus } from "./types";

export type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; corpus: Corpus };

export function useCorpus(): Load {
  const [s, setS] = useState<Load>({ state: "loading" });
  useEffect(() => {
    fetch("./data/corpus.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((corpus: Corpus) => setS({ state: "ready", corpus }))
      .catch((e) => setS({ state: "error", message: String(e.message ?? e) }));
  }, []);
  return s;
}
