import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Corpus, Evidence } from "./lib/types";

export const Ctx = createContext<{ corpus: Corpus; open: (e: Evidence) => void }>(null as never);
export const useApp = () => useContext(Ctx);

export function PageHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return <header className="page-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{lead}</p></header>;
}

export function EvidenceChip({ label, ev }: { label: string; ev: Evidence }) {
  const { open } = useApp();
  return <button className="chip" onClick={() => open(ev)} aria-label={`Open evidence: ${label}`}>{label} ↗</button>;
}

type Tone = "ok" | "bad" | "warn" | "open";
const SHAPE: Record<Tone, ReactNode> = {
  ok: <circle cx="7" cy="7" r="5" fill="currentColor" />,
  bad: <path d="M7 1.5 13 12.5H1z" fill="currentColor" />,
  warn: <rect x="2.5" y="2.5" width="9" height="9" transform="rotate(45 7 7)" fill="currentColor" />,
  open: <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />,
};
/** Verdict pill: shape AND text carry the meaning, colour only reinforces it. */
export function Verdict({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`verdict v-${tone}`}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>{SHAPE[tone]}</svg>{children}</span>;
}

export function Drawer({ ev, onClose }: { ev: Evidence; onClose: () => void }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  const { corpus } = useApp();
  const ents = corpus.entities.filter((e) => ev.entities.includes(e.id));
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Evidence">
        <header><div><div className="eyebrow">Evidence</div><h2>{ev.title}</h2></div><button className="close" onClick={onClose}>Close (Esc)</button></header>
        {ev.value && <div className="card" style={{ boxShadow: "none" }}><b style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>{ev.value}</b></div>}
        {ev.note && <p style={{ margin: 0 }}>{ev.note}</p>}
        <section><h3>Source files</h3>
          <dl className="kv" style={{ marginTop: 8 }}>{ev.files.map((f) => <div key={f.path} style={{ display: "contents" }}><dt>path</dt><dd className="mono">{f.path}{f.sha256 && <><br /><span style={{ color: "var(--muted)" }}>sha256 {f.sha256.slice(0, 16)}…</span></>}</dd></div>)}</dl>
        </section>
        {ev.runs.length > 0 && <section><h3>Integrity (re-verified at build time)</h3>
          {ev.runs.map((r) => <p key={r.path} style={{ margin: "8px 0" }}><span className={`badge ${r.manifest.status === "verified" ? "ok" : "bad"}`}>{r.manifest.status}</span>{" "}<span className="mono">{r.run_id}</span> · {r.manifest.checked} files hashed{r.manifest.mismatches.length > 0 && <> · differs: {r.manifest.mismatches.map((m) => m.file).join(", ")}</>}</p>)}
        </section>}
        {ents.length > 0 && <section><h3>Knowledge base</h3>
          {ents.map((e) => <p key={e.id} style={{ margin: "8px 0" }}><b className="mono">{e.id}</b> <span className="badge">{e.status}</span><br />{e.title}<br /><span className="mono" style={{ color: "var(--muted)" }}>{e.path}</span></p>)}
        </section>}
        {ev.answersLink && <a href={ev.answersLink} onClick={onClose}>Read the underlying answers →</a>}
      </aside>
    </>
  );
}
