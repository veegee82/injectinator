export type Span = { kind: "phone" | "url" | "email"; start: number; end: number };
export type Answer = {
  id: string; experiment: string; run_id: string; file: string; file_sha256: string;
  model: string; model_short: string; topic: string; variant: "A" | "B" | "baseline"; rep: number;
  status: string; finish_reason: string | null; usage: { prompt: number; completion: number } | null;
  latency_s: number | null; temperature: number; seed: number;
  system_prompt: string; user_prompt: string; response: string; spans: Span[];
  truncated: boolean; truncated_inferred: boolean;
};
export type Manifest = { status: "verified" | "mismatch" | "missing"; checked: number; mismatches: { file: string; reason: string }[]; unlisted: number };
export type Run = { experiment: string; run_id: string; path: string; files: number; manifest: Manifest; n_answers: number; config_sha256: string | null; config_file: string | null };
export type Iter2Cell = { model: string; variant: "A" | "B"; n: number; ok: number; errors: number; fabricated: number; fabrication_rate: number; truncated: number; latency_median_s: number; latency_min_s: number; latency_max_s: number };
export type Iter4Cell = { model: string; topic: string; n: number; refusal_rate: number; hedge_rate: number; direct_answer_rate: number; any_invented_specific_rate: number; on_topic_rate: number; language_match_rate: number };
export type Entity = { id: string; type: string; title: string; status: string; path: string; links: { rel: string; to: string }[] };
export type Corpus = {
  meta: { generated_at: string; git_head: string | null; source_root: string; detector: Record<string, string> };
  runs: Run[]; answers: Answer[];
  iter2: { cells: Iter2Cell[] } | null; iter4: { cells: Iter4Cell[]; totals?: unknown } | null;
  iter3: { items: number; rater1: { rows: number; labelled: number }; rater2: { rows: number; labelled: number } } | null;
  riley: { has_trials: boolean; files: string[] };
  entities: Entity[]; warnings: string[];
};
export type Evidence = {
  title: string; value?: string; note?: string;
  files: { path: string; sha256?: string }[]; runs: Run[]; entities: string[];
  answersLink?: string;
};
