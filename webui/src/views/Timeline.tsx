import { useApp, PageHead, EvidenceChip, Verdict } from "../ui";
import { evidenceFor } from "../lib/derive";

const STEPS = [
  { n: 1, slug: "nebius_faq_baseline", title: "Baseline", plan: null, note: "NOTE-0002", state: "done",
    asked: "Do four Nebius models answer plain hospital FAQ questions sensibly with a no-patient-data system prompt?",
    learned: "Replies differ between identical runs at temperature 0; one model invents a phone number and URL; four answers were cut off at max_tokens." },
  { n: 2, slug: "nebius_faq_iter2", title: "Iteration 2 — instruction A/B", plan: "PLAN-0002", note: "NOTE-0003", state: "done",
    asked: "Does an explicit “never invent contact details” instruction reduce invented details?",
    learned: "Model-dependent: it removed e-mail inventions in gpt-oss-120b and did nothing for Qwen3-30B. Preregistered success criterion not met." },
  { n: 3, slug: "nebius_faq_iter3", title: "Iteration 3 — detector vs human labels", plan: "PLAN-0003", note: null, state: "blocked",
    asked: "How precise and complete is the regex detector, measured against two independent raters?",
    learned: "Not answered: both label sheets are blank. Iteration 4 was written as a substitute." },
  { n: 4, slug: "nebius_faq_iter4", title: "Iteration 4 — rule-based criteria", plan: "PLAN-0004", note: "NOTE-0004", state: "done",
    asked: "Without gold labels: how often do answers refuse, hedge, invent specifics, stay on topic and match the language?",
    learned: "Hedging is model-specific; on-topic and language-match are at a ceiling on this benign corpus and cannot be validated by it." },
];

export default function Timeline() {
  const { corpus: c } = useApp();
  const status = (id: string | null) => c.entities.find((e) => e.id === id)?.status;
  return (
    <>
      <PageHead eyebrow="Timeline" title="How each iteration changed the question"
        lead="Each step is a preregistered plan, the data it produced, and the note that judged it. The learnings below summarise the notes; the notes themselves are the record." />
      <div className="timeline">
        {STEPS.map((s, i) => {
          const runs = c.runs.filter((r) => r.experiment === s.slug);
          return (
            <div className="tl-item" key={s.n}>
              <div className="tl-rail"><div className={`tl-dot ${s.state === "blocked" ? "blocked" : ""}`}>{s.n}</div>{i < STEPS.length - 1 && <div className="tl-line" />}</div>
              <div className="tl-body">
                <article className="card">
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <h3>{s.title}</h3>
                    {s.state === "blocked" ? <Verdict tone="open">blocked</Verdict> : <Verdict tone="ok">executed</Verdict>}
                    {s.plan && <span className="tag">plan {s.plan} · {status(s.plan)}</span>}
                    {s.note && <span className="tag">result {s.note}</span>}
                  </div>
                  <dl className="kv" style={{ marginTop: 12 }}>
                    <dt>Question</dt><dd style={{ wordBreak: "normal" }}>{s.asked}</dd>
                    <dt>Learned</dt><dd style={{ wordBreak: "normal" }}>{s.learned}</dd>
                    <dt>Data</dt><dd>{runs.length ? runs.map((r) => `${r.run_id} (${r.n_answers || r.files} ${r.n_answers ? "answers" : "files"}, ${r.manifest.status})`).join(" · ") : "no run folder — sheets only"}</dd>
                  </dl>
                  <div className="chips" style={{ marginTop: 12 }}>
                    <EvidenceChip label="evidence" ev={evidenceFor(c, s.title, [s.slug], { entities: [s.plan, s.note].filter(Boolean) as string[] })} />
                  </div>
                </article>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
