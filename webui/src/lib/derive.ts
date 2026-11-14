import type { Answer, Corpus, Evidence, Run } from "./types";

export const isFabricated = (a: Answer) => a.spans.some((s) => s.kind === "phone" || s.kind === "url" || s.kind === "email");
export const MODELS = ["deepseek-v4-pro", "gptoss-120b", "qwen3-235b", "qwen3-30b"] as const;
export const MODEL_LABEL: Record<string, string> = {
  "deepseek-v4-pro": "DeepSeek-V4-Pro", "gptoss-120b": "gpt-oss-120b", "qwen3-235b": "Qwen3-235B", "qwen3-30b": "Qwen3-30B",
};
export const TOPIC_LABEL: Record<string, string> = {
  german_faq: "German FAQ", visiting_hours: "Visiting hours", discharge_letter: "Discharge letter", privacy_why: "Privacy: why",
};
export const modelLabelFull = (full: string) => {
  const hit = Object.entries({ "DeepSeek-V4": "deepseek-v4-pro", "gpt-oss": "gptoss-120b", "Qwen3-235B": "qwen3-235b", "Qwen3-30B": "qwen3-30b" }).find(([k]) => full.includes(k));
  return hit ? MODEL_LABEL[hit[1]] : full;
};

export const runsOf = (c: Corpus, exp: string): Run[] => c.runs.filter((r) => r.experiment === exp);

export function evidenceFor(c: Corpus, title: string, exps: string[], extra: Partial<Evidence> & { files?: Evidence["files"] } = {}): Evidence {
  const runs = exps.flatMap((e) => runsOf(c, e));
  return { title, files: extra.files ?? runs.map((r) => ({ path: r.path + "/" })), runs, entities: extra.entities ?? [], value: extra.value, note: extra.note, answersLink: extra.answersLink };
}

/** Baseline determinism: two runs, identical config; how many (model, topic) cells gave different text. */
export function baselineDeterminism(c: Corpus) {
  const base = c.answers.filter((a) => a.experiment === "nebius_faq_baseline");
  const byCell = new Map<string, Answer[]>();
  for (const a of base) byCell.set(a.model_short + "|" + a.topic, [...(byCell.get(a.model_short + "|" + a.topic) ?? []), a]);
  let pairs = 0, differing = 0;
  for (const list of byCell.values()) if (list.length === 2) { pairs++; if (list[0].response !== list[1].response) differing++; }
  return { pairs, differing };
}

/** Iteration 2 by model x variant, recomputed from the per-call answers (optionally one topic). */
export function fabricationCell(c: Corpus, model: string, variant: "A" | "B", topic?: string) {
  const xs = c.answers.filter((a) => a.experiment === "nebius_faq_iter2" && a.model_short === model && a.variant === variant && (!topic || a.topic === topic));
  return { n: xs.length, k: xs.filter(isFabricated).length };
}
export function pooled(c: Corpus, variant: "A" | "B") {
  return MODELS.reduce((s, m) => { const x = fabricationCell(c, m, variant); return { n: s.n + x.n, k: s.k + x.k }; }, { n: 0, k: 0 });
}
