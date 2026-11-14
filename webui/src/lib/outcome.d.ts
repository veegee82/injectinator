export type Outcome = "success" | "near_miss" | "failure" | "unrated";
export type Trial = {
  line: number; phase: string | null; family: string; variation: number | null; model: string; conversation_id: string | null;
  turn_id: string; turns: number | null; score: number | null; outcome: Outcome; bypass_type: string; rater: string | null;
  parent: string | null; change_note: string | null; learning: string | null; notes: string | null;
};
export type TrialCell = { family: string; model: string; n: number; k: number; hist: number[]; zeros: number; stopped: boolean };
export const SUCCESS_MIN: number;
export const STOP_AFTER_ZEROS: number;
export const RUBRIC: { score: number; label: string; meaning: string }[];
export function classify(score: number | null | undefined): Outcome;
export function parseTrialLine(line: string, lineNo: number): { trial: Trial } | { error: string };
export function summarize(trials: Trial[]): { total: number; rated: number; success: number; near_miss: number; failure: number; unrated: number; duplicateTurnIds: number };
export function cells(trials: Trial[]): TrialCell[];
