import { useCallback, useEffect, useState } from "react";
import { useCorpus } from "./lib/corpus";
import { useRoute, href } from "./lib/router";
import type { Evidence } from "./lib/types";
import { Ctx, Drawer } from "./ui";
import Overview from "./views/Overview";
import Compare from "./views/Compare";
import Criteria from "./views/Criteria";
import Answers from "./views/Answers";
import Evidences from "./views/Evidences";
import Timeline from "./views/Timeline";

const VIEWS = [
  { id: "overview", label: "Overview", ask: "What do we know?" },
  { id: "timeline", label: "Timeline", ask: "How did we get here?" },
  { id: "compare", label: "Compare", ask: "Did the instruction work?" },
  { id: "criteria", label: "Criteria", ask: "Which checks discriminate?" },
  { id: "answers", label: "Answers", ask: "What did the model say?" },
  { id: "evidence", label: "Evidence", ask: "Can I trust the data?" },
];

export default function App() {
  const load = useCorpus();
  const route = useRoute();
  const [ev, setEv] = useState<Evidence | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") as "light" | "dark") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("theme", theme); }, [theme]);
  useEffect(() => { const t = route.params.get("theme"); if (t === "light" || t === "dark") setTheme(t); }, [route.params]);
  const open = useCallback((e: Evidence) => setEv(e), []);

  if (load.state === "loading") return <div className="state">Loading corpus…</div>;
  if (load.state === "error") return (
    <div className="state"><h2>Corpus not found</h2><p>The UI reads <code>public/data/corpus.json</code>, which is generated from <code>docs/data/experiments</code>.</p>
      <p>Run <code>npm run build:data</code> in <code>webui/</code> and reload. ({load.message})</p></div>
  );
  const { corpus } = load;
  const View = { overview: Overview, timeline: Timeline, compare: Compare, criteria: Criteria, answers: Answers, evidence: Evidences }[route.view] ?? Overview;
  return (
    <Ctx.Provider value={{ corpus, open }}>
      <div className="shell">
        <aside className="rail">
          <div className="brand"><div className="brand-mark">i</div><div><b>injectinator</b><small>experiment results</small></div></div>
          <nav className="nav" aria-label="Views">
            {VIEWS.map((v) => <a key={v.id} href={href(v.id)} aria-current={route.view === v.id ? "page" : undefined}><b>{v.label}</b><span>{v.ask}</span></a>)}
          </nav>
          <div className="rail-foot">
            <button className="theme-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Theme: {theme} — switch</button>
            <span>Read-only view of <code>{corpus.meta.source_root}</code><br />data built {corpus.meta.generated_at.slice(0, 16).replace("T", " ")} UTC{corpus.meta.git_head && <> · git {corpus.meta.git_head}</>}</span>
          </div>
        </aside>
        <main className="main"><View route={route} /></main>
      </div>
      {ev && <Drawer ev={ev} onClose={() => setEv(null)} />}
    </Ctx.Provider>
  );
}
