import { useState } from "react";
import { useApp, PageHead } from "../ui";
import { MODELS, MODEL_LABEL, TOPIC_LABEL, isFabricated } from "../lib/derive";
import { href, type Route } from "../lib/router";
import type { Answer } from "../lib/types";

function Highlighted({ a }: { a: Answer }) {
  const out: React.ReactNode[] = []; let at = 0;
  const spans = a.spans.filter((s, i, xs) => !xs.slice(0, i).some((p) => s.start < p.end && s.end > p.start));
  for (const s of spans) { out.push(a.response.slice(at, s.start)); out.push(<mark key={s.start} title={`looks like a ${s.kind}`}>{a.response.slice(s.start, s.end)}</mark>); at = s.end; }
  out.push(a.response.slice(at));
  return <div className="resp">{out}</div>;
}

export default function Answers({ route }: { route: Route }) {
  const { corpus: c } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const p = route.params;
  const f = { model: p.get("model") ?? "", topic: p.get("topic") ?? "", variant: p.get("variant") ?? "", flag: p.get("flag") === "1", trunc: p.get("trunc") === "1" };
  const set = (k: string, v: string) => { const n = Object.fromEntries(p.entries()); if (v) n[k] = v; else delete n[k]; location.hash = href("answers", n); };
  const list = c.answers.filter((a) => (!f.model || a.model_short === f.model) && (!f.topic || a.topic === f.topic) && (!f.variant || a.variant === f.variant) && (!f.flag || isFabricated(a)) && (!f.trunc || a.truncated));
  const topics = [...new Set(c.answers.map((a) => a.topic))];
  return (
    <>
      <PageHead eyebrow="Answers" title="What the model actually said" lead="The raw replies behind every aggregate. Strings that look like a phone number, URL or e-mail address are marked; the marking is a display aid using the experiment’s detector patterns, not a judgement." />
      <div className="toolbar">
        <label>Model <select value={f.model} onChange={(e) => set("model", e.target.value)}><option value="">all</option>{MODELS.map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}</select></label>
        <label>Topic <select value={f.topic} onChange={(e) => set("topic", e.target.value)}><option value="">all</option>{topics.map((t) => <option key={t} value={t}>{TOPIC_LABEL[t] ?? t}</option>)}</select></label>
        <label>Variant <select value={f.variant} onChange={(e) => set("variant", e.target.value)}><option value="">all</option><option value="baseline">baseline</option><option value="A">A</option><option value="B">B</option></select></label>
        <label><input type="checkbox" checked={f.flag} onChange={(e) => set("flag", e.target.checked ? "1" : "")} /> only invented details</label>
        <label><input type="checkbox" checked={f.trunc} onChange={(e) => set("trunc", e.target.checked ? "1" : "")} /> only cut off</label>
        <b style={{ marginLeft: "auto" }}>{list.length} of {c.answers.length}</b>
      </div>
      {list.length === 0 && <div className="empty"><h3>No answer matches these filters</h3><a href={href("answers")}>Clear filters</a></div>}
      {list.map((a) => (
        <div className="answer" key={a.id}>
          <button aria-expanded={openId === a.id} onClick={() => setOpenId(openId === a.id ? null : a.id)}>
            <b>{MODEL_LABEL[a.model_short]}</b><span>{TOPIC_LABEL[a.topic] ?? a.topic}</span><span className="tag">{a.variant}{a.variant !== "baseline" ? ` #${a.rep}` : ` run ${a.run_id.slice(-4)}`}</span>
            <span className="snip">{a.response.replace(/\s+/g, " ")}</span>
            <span>{isFabricated(a) && <span className="tag warn">invented</span>} {a.truncated && <span className="tag">cut off{a.truncated_inferred ? "*" : ""}</span>}</span>
          </button>
          {openId === a.id && (
            <div className="detail">
              <div><div className="eyebrow">Prompt</div><div className="resp" style={{ fontSize: 13.5 }}><b>system</b> {a.system_prompt}{"\n"}<b>user</b> {a.user_prompt}</div></div>
              <div><div className="eyebrow">Answer</div><Highlighted a={a} /></div>
              <dl className="kv">
                <dt>model</dt><dd>{a.model}</dd><dt>decoding</dt><dd>temperature {a.temperature}, seed {a.seed}, finish_reason {a.finish_reason ?? "not recorded (baseline)"}{a.truncated_inferred && a.truncated ? " — cut-off inferred from the token cap" : ""}</dd>
                <dt>tokens</dt><dd>{a.usage ? `${a.usage.prompt} in / ${a.usage.completion} out` : "–"} · {a.latency_s}s</dd>
                <dt>source</dt><dd className="mono">{a.file}<br />sha256 {a.file_sha256}</dd>
              </dl>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
