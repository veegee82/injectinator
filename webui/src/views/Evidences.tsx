import { useApp, PageHead, Verdict } from "../ui";

export default function Evidences() {
  const { corpus: c } = useApp();
  const bad = c.runs.filter((r) => r.manifest.status !== "verified");
  return (
    <>
      <PageHead eyebrow="Evidence" title="Can I trust the data?"
        lead="Every run folder has a MANIFEST.sha256. It is re-hashed each time the UI data is built, and the committed analysis files are cross-checked against the per-call answers they summarise." />
      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Integrity</h3>
        <p style={{ margin: "8px 0" }}>{bad.length === 0 ? <Verdict tone="ok">All {c.runs.length} run folders match their manifests</Verdict> : <Verdict tone="bad">{bad.length} run folder(s) do not verify</Verdict>}{" "}
          {c.warnings.length === 0 ? <Verdict tone="ok">analysis.json agrees with the per-call files (n and fabricated counts)</Verdict> : <Verdict tone="bad">{c.warnings.length} cross-check warning(s)</Verdict>}</p>
        {c.warnings.length > 0 && <ul>{c.warnings.map((w) => <li key={w} className="mono">{w}</li>)}</ul>}
        <p className="caveat">A matching manifest proves the files are unchanged since the manifest was written, not that the experiment was run correctly. Whether a folder is committed to git is a separate question and is not shown here.</p>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Run folders</h3>
        <table><thead><tr><th>Experiment</th><th>Run</th><th>Manifest</th><th>Files hashed</th><th>Answers</th><th>Config sha256</th></tr></thead><tbody>
          {c.runs.map((r) => <tr key={r.path}><td className="mono">{r.experiment}</td><td className="mono">{r.run_id}</td>
            <td><span className={`badge ${r.manifest.status === "verified" ? "ok" : "bad"}`}>{r.manifest.status}</span>{r.manifest.unlisted > 0 && <span className="tag" style={{ marginLeft: 6 }}>{r.manifest.unlisted} unlisted</span>}</td>
            <td>{r.manifest.checked}</td><td>{r.n_answers || "–"}</td><td className="mono">{r.config_sha256 ? r.config_sha256.slice(0, 12) + "…" : "–"}</td></tr>)}
        </tbody></table>
      </section>
      <section className="card">
        <h3>Knowledge base entities that frame the data</h3>
        <table><thead><tr><th>Id</th><th>Type</th><th>Status</th><th>Title</th><th>Links</th></tr></thead><tbody>
          {c.entities.map((e) => <tr key={e.id}><td className="mono"><b>{e.id}</b></td><td>{e.type}</td><td><span className="badge">{e.status}</span></td><td>{e.title}</td><td className="mono" style={{ fontSize: 12 }}>{e.links.map((l) => `${l.rel} → ${l.to.replace(/^repo:/, "")}`).join("\n").split("\n").map((x, i) => <div key={i}>{x}</div>)}</td></tr>)}
        </tbody></table>
        <p className="caveat">Plans are preregistrations. PLAN-0002/0003/0004 carry status “proposed” in the knowledge base; acceptance is a human decision.</p>
      </section>
    </>
  );
}
