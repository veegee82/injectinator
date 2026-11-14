import { useState } from "react";
import { useApp, PageHead, EvidenceChip } from "../ui";
import { MODELS, MODEL_LABEL, TOPIC_LABEL, evidenceFor, modelLabelFull } from "../lib/derive";
import { floorCeiling, weighted, pct } from "../lib/stats.js";
import { href } from "../lib/router";
import type { Iter4Cell } from "../lib/types";

const CRIT: { key: keyof Iter4Cell; label: string; what: string }[] = [
  { key: "any_invented_specific_rate", label: "Invented specifics", what: "phone, URL, e-mail or department/name pattern that the prompt never supplied" },
  { key: "hedge_rate", label: "Hedged", what: "answer contains hedging phrases (“may vary”, “generally”)" },
  { key: "direct_answer_rate", label: "Answered directly", what: "neither refused nor hedged" },
  { key: "refusal_rate", label: "Refused", what: "answer refuses to give the information" },
  { key: "on_topic_rate", label: "On topic", what: "at least one fixed topic keyword appears (lexical overlap only)" },
  { key: "language_match_rate", label: "Language match", what: "German vs English marker count matches the expected language" },
];
const TOPICS = ["german_faq", "visiting_hours", "discharge_letter", "privacy_why"];
const short = (full: string) => MODELS.find((m) => modelLabelFull(full) === MODEL_LABEL[m])!;

export default function Criteria() {
  const { corpus: c, open } = useApp();
  const [k, setK] = useState<keyof Iter4Cell>("any_invented_specific_rate");
  const cells = c.iter4?.cells ?? [];
  if (!cells.length) return <><PageHead eyebrow="Iteration 4" title="Criteria" lead="" /><div className="empty"><h3>No iteration 4 analysis found</h3>Expected <code>analysis.json</code> under <code>docs/data/experiments/nebius_faq_iter4</code>.</div></>;
  const cur = CRIT.find((x) => x.key === k)!;
  const fc = floorCeiling(cells.map((x) => x[k] as number));
  const by = (m: string, t: string) => cells.find((x) => short(x.model) === m && x.topic === t);
  return (
    <>
      <PageHead eyebrow="Iteration 4" title="Which rule-based checks actually discriminate?"
        lead="Each criterion is a deterministic function of the answer text. Cells show the rate and the sample; a criterion that is exactly 0 or exactly 1 everywhere cannot tell models apart on this corpus." />
      <div className="toolbar"><div className="seg" role="group" aria-label="Criterion">{CRIT.map((x) => <button key={x.key} aria-pressed={k === x.key} onClick={() => setK(x.key)}>{x.label}</button>)}</div></div>
      {fc && <div className="banner" role="note"><b>{fc === "ceiling" ? "Ceiling effect" : "Floor effect"}.</b><span>Every cell is {fc === "ceiling" ? "100 %" : "0 %"}. This criterion showed no discrimination on this corpus; it is reported as such, not as a success. Validating it needs deliberately off-topic or wrong-language outputs.</span></div>}
      <section className="card">
        <p className="caveat" style={{ marginTop: 0 }}><b>{cur.label}:</b> {cur.what}.</p>
        <div className="heat" style={{ gridTemplateColumns: "150px repeat(4, minmax(0, 1fr))", marginTop: 14 }}>
          <div />{TOPICS.map((t) => <div className="heat-head" key={t}>{TOPIC_LABEL[t]}</div>)}
          {MODELS.map((m) => (
            <div style={{ display: "contents" }} key={m}>
              <div className="heat-row">{MODEL_LABEL[m]}</div>
              {TOPICS.map((t) => {
                const x = by(m, t); if (!x) return <div className="heat-cell" key={t} style={{ ["--t" as string]: 0 }}>–</div>;
                const v = x[k] as number;
                return <button key={t} className={`heat-cell ${v > 0.55 ? "dark" : ""}`} style={{ ["--t" as string]: v }}
                  aria-label={`${MODEL_LABEL[m]}, ${TOPIC_LABEL[t]}: ${pct(v, 1)} of ${x.n} answers`}
                  onClick={() => open(evidenceFor(c, `${cur.label}: ${MODEL_LABEL[m]} · ${TOPIC_LABEL[t]}`, ["nebius_faq_iter4"], { entities: ["PLAN-0004", "NOTE-0004"], value: `${Math.round(v * x.n)}/${x.n} (${pct(v, 1)})`, note: cur.what, answersLink: href("answers", { model: m, topic: t }) }))}>
                  <b>{pct(v)}</b><small>{Math.round(v * x.n)}/{x.n}</small></button>;
              })}
            </div>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 14 }}><span>Colour intensity follows the rate (empty = 0 %, full = 100 %); the number is always printed. Cell size n is small: 2 answers for two of the four topics.</span></div>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Corpus-wide (weighted by cell size, n = {cells.reduce((s, x) => s + x.n, 0)})</h3>
        <table><thead><tr><th>Criterion</th><th>Rate</th><th>Reading</th></tr></thead><tbody>
          {CRIT.map((x) => { const f = floorCeiling(cells.map((y) => y[x.key] as number)); return <tr key={x.key}><td>{x.label}</td><td className="mono">{pct(weighted(cells, x.key), 1)}</td><td>{f ? <span className="tag warn">{f} in every cell — no discrimination</span> : <span className="tag">varies between cells</span>}</td></tr>; })}
        </tbody></table>
      </section>
      <div className="chips" style={{ marginTop: 16 }}><EvidenceChip label="PLAN-0004 · NOTE-0004" ev={evidenceFor(c, "Iteration 4 evidence", ["nebius_faq_iter4"], { entities: ["PLAN-0004", "NOTE-0004"], note: "Rates are read from the committed analysis.json; cell sizes were cross-checked against the per-call files." })} /></div>
    </>
  );
}
