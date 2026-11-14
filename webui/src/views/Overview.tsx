import { useApp, PageHead, EvidenceChip, Verdict } from "../ui";
import { baselineDeterminism, evidenceFor, pooled, isFabricated } from "../lib/derive";
import { floorCeiling, weighted, wilson, pct } from "../lib/stats.js";
import { href } from "../lib/router";

export default function Overview() {
  const { corpus: c } = useApp();
  const verified = c.runs.filter((r) => r.manifest.status === "verified").length;
  const models = new Set(c.answers.map((a) => a.model_short)).size;
  const A = pooled(c, "A"), B = pooled(c, "B");
  const reduction = A.k ? 1 - B.k / B.n / (A.k / A.n) : 0;
  const det = baselineDeterminism(c);
  const baseFab = c.answers.filter((a) => a.experiment === "nebius_faq_baseline" && isFabricated(a)).length;
  const baseN = c.answers.filter((a) => a.experiment === "nebius_faq_baseline").length;
  const cells = c.iter4?.cells ?? [];
  const keys = ["refusal_rate", "hedge_rate", "any_invented_specific_rate", "on_topic_rate", "language_match_rate"] as const;
  const ceilings = keys.filter((k) => floorCeiling(cells.map((x) => x[k])) !== null);
  const total4 = cells.reduce((s, x) => s + x.n, 0);
  const inv = Math.round(weighted(cells, "any_invented_specific_rate") * total4);
  const [aLo, aHi] = wilson(A.k, A.n), [bLo, bHi] = wilson(B.k, B.n);

  return (
    <>
      <PageHead eyebrow="Overview" title="What the experiments say, and how far to trust it"
        lead="Every figure shows its sample size, the verdict against what was preregistered, and a link to the evidence behind it. Small samples are drawn as wide intervals, not hidden." />
      <div className="stats">
        <div className="stat"><b>{c.answers.length}</b><span>model answers on disk</span></div>
        <div className="stat"><b>{models}</b><span>models compared</span></div>
        <div className="stat"><b>{verified}/{c.runs.length}</b><span>run folders hash-verified</span></div>
        <div className="stat"><b style={{ color: c.warnings.length ? "var(--viz-bad)" : undefined }}>{c.warnings.length}</b><span>cross-check warnings</span></div>
      </div>
      <div className="grid cols-2">
        <article className="card finding">
          <div className="eyebrow">Iteration 2 · instruction vs invented contact details</div>
          <h3>A “never invent” instruction did not work across the pool</h3>
          <div className="big">{A.k}/{A.n} <span style={{ color: "var(--muted)" }}>→</span> {B.k}/{B.n}<small>answers with an invented phone, URL or e-mail, without → with the instruction</small></div>
          <div className="caveat">Relative reduction {pct(reduction, 1)}; the preregistered target was at least 50 %. Intervals overlap ({pct(aLo)}–{pct(aHi)} vs {pct(bLo)}–{pct(bHi)}). The effect is one model: gpt-oss-120b went 3/10 → 0/10 while Qwen3-30B stayed at 5/10. 5 repetitions per cell, one wording, one seed.</div>
          <Verdict tone="bad">Preregistered criterion not met (as recorded in NOTE-0003)</Verdict>
          <div className="chips">
            <EvidenceChip label="PLAN-0002 → NOTE-0003" ev={evidenceFor(c, "Iteration 2: fabrication A vs B", ["nebius_faq_iter2"], { entities: ["PLAN-0002", "NOTE-0003"], value: `${A.k}/${A.n} → ${B.k}/${B.n}`, note: "Share of answers with a phone-, URL- or e-mail-shaped string the system prompt never supplied.", answersLink: href("answers", { flag: "1" }) })} />
            <a className="chip" href={href("compare")}>open comparison</a>
          </div>
        </article>

        <article className="card finding">
          <div className="eyebrow">Baseline · determinism</div>
          <h3>Temperature 0 with a fixed seed still gave different text</h3>
          <div className="big">{det.differing}/{det.pairs}<small>identical-config cells whose two runs produced different answers</small></div>
          <div className="caveat">Also: {baseFab} of {baseN} baseline answers contain an invented contact detail under the iteration-2 detector (phone, URL, e-mail), all in German FAQ cells. NOTE-0002 reported 2 because its detector had no e-mail pattern. One call per cell and run; no preregistration existed, so everything here is exploratory.</div>
          <Verdict tone="warn">Exploratory, not preregistered</Verdict>
          <div className="chips">
            <EvidenceChip label="NOTE-0002" ev={evidenceFor(c, "Baseline: two identical runs", ["nebius_faq_baseline"], { entities: ["NOTE-0002"], value: `${det.differing}/${det.pairs} cells differ`, note: "Compared by exact response text between run 1 and run 2." })} />
          </div>
        </article>

        <article className="card finding">
          <div className="eyebrow">Iteration 4 · rule-based criteria on {total4} answers</div>
          <h3>Two criteria discriminate; two show a ceiling and say nothing</h3>
          <div className="big">{inv}/{total4}<small>answers with an invented specific ({pct(weighted(cells, "any_invented_specific_rate"), 1)}) · hedging in {pct(weighted(cells, "hedge_rate"), 1)}</small></div>
          <div className="caveat">{ceilings.length ? `${ceilings.join(", ").replace(/_rate/g, "")} sit at exactly 0 or 1 in every cell` : "No criterion is at a floor or ceiling in every cell"} — floor/ceiling effects are reported as “no discrimination”, not as success. A criterion measures what its rule checks, nothing more.</div>
          <Verdict tone="warn">Descriptive; corpus is benign, not adversarial</Verdict>
          <div className="chips">
            <EvidenceChip label="PLAN-0004 → NOTE-0004" ev={evidenceFor(c, "Iteration 4: rule-based criteria", ["nebius_faq_iter4"], { entities: ["PLAN-0004", "NOTE-0004"], value: `${inv}/${total4} invented specifics` })} />
            <a className="chip" href={href("criteria")}>open heatmap</a>
          </div>
        </article>

        <article className="card finding">
          <div className="eyebrow">Iteration 3 · detector precision/recall</div>
          <h3>Blocked: no human labels exist yet</h3>
          <div className="big">{c.iter3 ? `${c.iter3.rater1.labelled}/${c.iter3.items}` : "–"}<small>items labelled by rater 1 · {c.iter3?.rater2.labelled ?? 0}/{c.iter3?.items ?? 0} by rater 2</small></div>
          <div className="caveat">The label sheets are blank. Precision and recall of the detector are therefore unknown; iteration 4 substitutes rule-based criteria and does not answer this question.</div>
          <Verdict tone="open">Waiting for two independent raters</Verdict>
          <div className="chips"><EvidenceChip label="PLAN-0003" ev={evidenceFor(c, "Iteration 3: rater sheets", ["nebius_faq_iter3"], { entities: ["PLAN-0003"], files: [{ path: "docs/data/experiments/nebius_faq_iter3/labels_rater1.csv" }, { path: "docs/data/experiments/nebius_faq_iter3/labels_rater2.csv" }] })} /></div>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow">Riley leak matrix</div>
        <h3>The main experiment has produced no trials yet</h3>
        <p style={{ color: "var(--muted)", margin: "6px 0 0" }}>{c.riley.has_trials ? "trials.jsonl exists." : <>No <code>trials.jsonl</code> in <code>docs/data/experiments/riley-leak-matrix</code>; only the schema, the attack list and the analysis script are present. Nothing is shown rather than anything invented. When trials appear, a lineage view (parent → child, change note, learning) is the next planned view.</>}</p>
      </article>
    </>
  );
}
