import { useEffect, useState } from "react";
import { POLL_MS, type LiveState } from "./lib/corpus";

const ago = (t: number | null, now: number) => (t === null ? "–" : `${Math.max(0, Math.round((now - t) / 1000))} s ago`);

/** Shows that the page keeps itself current, when it last looked, and lets the user pause. Status is text, not colour alone. */
export function LivePill({ live, onPause, onRefresh, active }: { live: LiveState; onPause: (p: boolean) => void; onRefresh: () => void; active: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const label = live.status === "live" ? "Live" : live.status === "paused" ? "Paused" : "Offline";
  return (
    <div className={`live live-${live.status}`} data-testid="live-pill">
      <div className="live-row">
        <span className="live-dot" aria-hidden />
        <b>{label}</b>
        <span className="live-sub">{live.status === "offline" ? `retrying (${live.failures}×)` : `checked ${ago(live.lastChecked, now)}`}</span>
      </div>
      <div className="live-sub">{live.status === "offline" ? "showing the last data received" : `refreshes every ${Math.round(POLL_MS / 1000)} s${active ? ` · ${active} run${active === 1 ? "" : "s"} in progress` : ""}`}</div>
      <div className="live-actions">
        <button className="chip" onClick={() => onPause(live.status !== "paused")}>{live.status === "paused" ? "Resume" : "Pause"}</button>
        <button className="chip" onClick={onRefresh}>Check now</button>
      </div>
    </div>
  );
}

/** Announces a data change without moving the user's view. Auto-hides; screen readers get it via role=status. */
export function Toast({ live, onDismiss }: { live: LiveState; onDismiss: () => void }) {
  const c = live.change;
  useEffect(() => { if (!c) return; const t = window.setTimeout(onDismiss, 9000); return () => window.clearTimeout(t); }, [c, onDismiss]);
  if (!c) return null;
  return (
    <div className="toast" role="status" aria-live="polite" data-testid="toast">
      <div><div className="eyebrow">New data</div><b>{c.text}</b></div>
      <button className="close" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
