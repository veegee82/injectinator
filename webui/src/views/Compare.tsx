import { useState } from "react";
import { useApp, PageHead, EvidenceChip } from "../ui";
import { MODELS, MODEL_LABEL, TOPIC_LABEL, evidenceFor, fabricationCell, pooled } from "../lib/derive";
import { wilson, pct } from "../lib/stats.js";
import { href } from "../lib/router";

const W = 420, PAD = 10, ROWH = 46;
const X = (p: number) => PAD + p * (W - 2 * PAD);

function Dumbbell({ rows }: { rows: { key: string; label: string; a: { k: number; n: number }; b: { k: number; n: number }; link: string }[] }) {
  const { corpus: c, open } = useApp();
  return (
    <div>
      {rows.map((r) => (
        <div className="chart-row" key={r.key}>
          <div className="name">{r.label}</div>
          <svg viewBox={`0 0 ${W} ${ROWH}`} width="100%" height={ROWH} role="img" aria-label={`${r.label}: without instruction ${r.a.k} of ${r.a.n}, with instruction ${r.b.k} of ${r.b.n}`}>
            {[0, .25, .5, .75, 1].map((t) => <line key={t} x1={X(t)} x2={X(t)} y1={4} y2={ROWH - 4} stroke="var(--line)" />)}
            {([["a", r.a, 15, "var(--viz-a)"], ["b", r.b, 32, "var(--viz-b)"]] as const).map(([id, v, y, col]) => {
              const [lo, hi] = wilson(v.k, v.n);
              return <g key={id}>
                <line x1={X(lo)} x2={X(hi)} y1={y} y2={y} stroke={col} strokeWidth="3" strokeLinecap="round" opacity=".35" />
                <circle cx={X(v.n ? v.k / v.n : 0)} cy={y} r="6.5" fill={col} stroke="var(--surface)" strokeWidth="2" />
              </g>;
            })}
          </svg>
          <div className="nums">
            <span style={{ color: "var(--viz-a)" }}>A</span> {r.a.k}/{r.a.n} <span style={{ color: "var(--viz-b)" }}>B</span> {r.b.k}/{r.b.n}<br />
            <button className="chip" style={{ padding: "1px 8px", fontSize: 11.5 }} onClick={() => open(evidenceFor(c, `${r.label}: fabrication A vs B`, ["nebius_faq_iter2"], { entities: ["PLAN-0002", "NOTE-0003"], value: `A ${r.a.k}/${r.a.n} · B ${r.b.k}/${r.b.n}`, note: "Share of answers containing a phone-, URL- or e-mail-shaped string. Bars show Wilson 95 % intervals.", answersLink: r.link }))}>evidence ↗</button>
          </div>
        </div>
      ))}
      <div className="chart-row" style={{ borderTop: 0, padding: 0 }} aria-hidden>
        <div />
        <svg viewBox={`0 0 ${W} 20`} width="100%" height="20" className="axis">
          {[0, .25, .5, .75, 1].map((t) => <text key={t} x={X(t)} y="13" textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>{t * 100}%</text>)}
        </svg>
        <div />
      </div>
    </div>
  );
}
export default function Compare() {
  const { corpus: c } = useApp();
  const [topic, setTopic] = useState<string>("");
  const rows: { key: string; label: string; a: { k: number; n: number }; b: { k: number; n: number }; link: string }[] = MODELS.map((m) => ({ key: m, label: MODEL_LABEL[m], a: fabricationCell(c, m, "A", topic || undefined), b: fabricationCell(c, m, "B", topic || undefined), link: href("answers", { model: m, flag: "1" }) }));
  const pa = topic ? rows.reduce((s, r) => ({ k: s.k + r.a.k, n: s.n + r.a.n }), { k: 0, n: 0 }) : pooled(c, "A");
  const pb = topic ? rows.reduce((s, r) => ({ k: s.k + r.b.k, n: s.n + r.b.n }), { k: 0, n: 0 }) : pooled(c, "B");
  rows.push({ key: "pool", label: "All models pooled", a: pa, b: pb, link: href("answers", { flag: "1" }) });
  const cells = c.iter2?.cells ?? [];
  const get = (m: string, v: string) => cells.find((x) => x.model === m && x.variant === v);
  const maxLat = Math.max(...cells.map((x) => x.latency_max_s), 1);

  return (
    <>
      <PageHead eyebrow="Iteration 2" title="Did the “never invent” instruction help?"
        lead="Share of answers that contain an invented phone number, URL or e-mail address, per model, without (A) and with (B) an explicit instruction. Whiskers are 95 % Wilson intervals — with 5 to 10 answers per cell they are wide, and that is the honest picture." />
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Topic filter">
          {[["", "Both topics"], ["german_faq", "German FAQ"], ["visiting_hours", "Visiting hours"]].map(([v, l]) => <button key={v} aria-pressed={topic === v} onClick={() => setTopic(v)}>{l}</button>)}
        </div>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>Every invented detail occurred in the German FAQ prompt; “Visiting hours” produced none.</span>
      </div>
      <section className="card">
        <div className="legend"><span><i style={{ background: "var(--viz-a)" }} />A · baseline system prompt</span><span><i style={{ background: "var(--viz-b)" }} />B · plus “never invent phone numbers, URLs, e-mail addresses or names”</span></div>
        <Dumbbell rows={rows} />
        <p className="caveat" style={{ marginTop: 12 }}>Pooled: A {pct(pa.n ? pa.k / pa.n : 0, 1)} → B {pct(pb.n ? pb.k / pb.n : 0, 1)}. Differences are hypotheses, not findings: one seed, one wording, two prompts. Two of the four models were already at 0 without the instruction (floor effect).</p>
      </section>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h3>Answers cut off at the token cap</h3>
          <p className="caveat">Secondary metric, <code>finish_reason = length</code>. Own scale (0–10).</p>
          {MODELS.map((m) => (
            <div key={m} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center", margin: "10px 0" }}>
              <span className="name">{MODEL_LABEL[m]}</span>
              <svg viewBox="0 0 260 30" width="100%" height="30" role="img" aria-label={`${MODEL_LABEL[m]} truncated A ${get(m, "A")?.truncated} of ${get(m, "A")?.n}, B ${get(m, "B")?.truncated} of ${get(m, "B")?.n}`}>
                {(["A", "B"] as const).map((v, i) => { const x = get(m, v); const w = x ? (x.truncated / x.n) * 200 : 0; return <g key={v}>
                  <rect x="0" y={i * 15} width="200" height="11" rx="3" fill="var(--surface-2)" />
                  <rect x="0" y={i * 15} width={Math.max(w, x?.truncated ? 2 : 0)} height="11" rx="3" fill={v === "A" ? "var(--viz-a)" : "var(--viz-b)"} />
                  <text x="208" y={i * 15 + 10} className="mono" fill="var(--muted)" fontSize="11">{x?.truncated}/{x?.n}</text></g>; })}
              </svg>
            </div>
          ))}
        </section>
        <section className="card">
          <h3>Median latency per call</h3>
          <p className="caveat">Dot = median, line = min–max, in seconds. Own scale (0–{Math.ceil(maxLat)} s). Single seed; the baseline showed up to 12× run-to-run spread for one call.</p>
          {MODELS.map((m) => (
            <div key={m} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center", margin: "10px 0" }}>
              <span className="name">{MODEL_LABEL[m]}</span>
              <svg viewBox="0 0 260 30" width="100%" height="30" role="img" aria-label={`${MODEL_LABEL[m]} median latency A ${get(m, "A")?.latency_median_s}s, B ${get(m, "B")?.latency_median_s}s`}>
                {(["A", "B"] as const).map((v, i) => { const x = get(m, v); if (!x) return null; const s = (t: number) => (t / maxLat) * 200; const col = v === "A" ? "var(--viz-a)" : "var(--viz-b)"; return <g key={v}>
                  <line x1={s(x.latency_min_s)} x2={s(x.latency_max_s)} y1={i * 15 + 6} y2={i * 15 + 6} stroke={col} strokeWidth="3" opacity=".35" strokeLinecap="round" />
                  <circle cx={s(x.latency_median_s)} cy={i * 15 + 6} r="5" fill={col} />
                  <text x="208" y={i * 15 + 10} className="mono" fill="var(--muted)" fontSize="11">{x.latency_median_s.toFixed(1)} s</text></g>; })}
              </svg>
            </div>
          ))}
        </section>
      </div>
      <div className="chips" style={{ marginTop: 16 }}><EvidenceChip label="PLAN-0002 · NOTE-0003 · run folder" ev={evidenceFor(c, "Iteration 2 evidence", ["nebius_faq_iter2"], { entities: ["PLAN-0002", "NOTE-0003"], note: "Fabrication counts are recomputed from the per-call files and cross-checked against analysis.json; latency and truncation are read from analysis.json." })} /></div>
      <p className="caveat" style={{ marginTop: 10 }}>Topic labels: {Object.values(TOPIC_LABEL).join(", ")}.</p>
    </>
  );
}
