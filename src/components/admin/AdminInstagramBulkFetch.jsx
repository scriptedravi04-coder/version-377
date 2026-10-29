import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import SocialLogo from "../common/SocialLogo"; // v364: real platform logos

// v354 (Ravi: "admin panel se ek button — sab creators + unclaimed + waitlist ka Instagram fetch ho jaaye; photo sirf
// unka jinki uploaded nahi hai").
// v363 (Ravi: "waitlist mai fetch hi nahi kar raha"): the server can't keep a job running between requests on our
// hosting, so this screen now drives the run — it asks POST /admin/creators/instagram-bulk/step for the next few again
// and again until nothing is left. Pending waitlist goes first. Keep this page open while it runs.

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

export default function AdminInstagramBulkFetch({ compact = false, onProgress }) {
  const [cfg, setCfg] = useState(null);
  const [force, setForce] = useState(false);
  const [run, setRun] = useState(null); // { running, total, fresh, remaining, done, failed, photos, errors, waiting_until }
  const stopRef = useRef(false);

  useEffect(() => {
    let alive = true;
    api.get("admin/creators/instagram-bulk", { bypassCache: true }).then(({ data }) => { if (alive) setCfg(data); }).catch(() => { if (alive) setCfg({ configured: false }); });
    return () => { alive = false; stopRef.current = true; };
  }, []);

  const start = async () => {
    stopRef.current = false;
    const since = Date.now();
    const skip = [];
    const st = { running: true, total: 0, fresh: 0, remaining: null, done: 0, failed: 0, photos: 0, errors: [], waiting_until: null };
    setRun({ ...st });
    let rounds = 0;
    try {
      while (!stopRef.current && rounds < 2000) {
        rounds += 1;
        let data;
        try { ({ data } = await api.post("admin/creators/instagram-bulk/step", { mode: force ? "old" : "new", since, skip }, { timeout: 60000 })); } // v373: new only, unless "refresh old" is ticked
        catch (e) {
          if (e?.response?.status === 503 || e?.response?.status === 403) { toast.error(e?.response?.data?.error || "Couldn't start."); break; }
          st.errors = [...st.errors, "Network hiccup — retrying…"].slice(-6); setRun({ ...st }); await sleep(4000); continue;
        }
        st.total = data.total; st.fresh = data.fresh; st.remaining = data.remaining;
        st.done += data.done?.length || 0; st.photos += data.photos || 0;
        for (const f of data.failed || []) { skip.push(f.key); st.failed += 1; st.errors = [...st.errors, `@${f.who}: ${f.error}`].slice(-8); }
        st.waiting_until = data.waiting_until || null; st.reserved = Boolean(data.reserved);
        setRun({ ...st });
        if (rounds % 8 === 0) onProgress?.();
        if (!data.remaining) break;
        if (data.waiting_until) { await sleep(Math.min(Math.max(Date.parse(data.waiting_until) - Date.now(), 15000), 5 * 60 * 1000)); continue; }
        await sleep(400);
      }
    } finally {
      st.running = false; st.waiting_until = null; setRun({ ...st });
      onProgress?.();
      if (!stopRef.current) toast.success(`Instagram fetch done · ${st.done} updated${st.failed ? ` · ${st.failed} failed` : ""}`);
    }
  };

  if (!cfg) return null;
  const total = run?.total || 0;
  const handled = total ? total - (run?.remaining ?? total) : 0;
  const pct = total ? Math.round((handled / total) * 100) : 0;
  const waiting = run?.running && run?.waiting_until ? new Date(run.waiting_until).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null;

  return (
    <div className={`rounded-2xl border border-pink-200 bg-gradient-to-br from-[#FFF5FA] to-white ${compact ? "p-3" : "p-4"} space-y-3`} data-testid="admin-ig-bulk">
      <div className="flex items-start gap-3">
        <SocialLogo platform="instagram" size={36} variant="tile" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-900">Fetch Instagram for everyone</div>
          <div className="text-[12px] text-slate-500 font-medium leading-snug">
            Fetches only usernames never fetched before (pending waitlist first) — real followers, views, engagement, and the Instagram photo only where none was uploaded. Already-fetched ones are refreshed by themselves every 7 days. Part of each hour is always kept for people signing up. Keep this page open while it runs.
          </div>
        </div>
      </div>
      {!cfg.configured && <div className="text-[12px] font-semibold text-amber-700">Switched off — add IG_GRAPH_TOKEN and IG_BUSINESS_ID in AI Studio secrets first.</div>}
      {run && (
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="text-[12px] text-slate-600 font-semibold">
            {run.running ? `Working… ${handled} / ${total || "…"}` : `Done · ${handled} / ${total}`} · {run.done} updated · {run.photos} photos · {run.fresh} already fetched · {run.failed} failed
          </div>
          {waiting && <div className="text-[12px] text-amber-700 font-semibold">{run.reserved ? "This hour's share for bulk fetch is used (the rest is kept for sign-ups)" : "Meta's hourly limit reached"} — continues by itself at about {waiting} (keep this page open).</div>}
          {run.errors?.length > 0 && (
            <details className="text-[11px] text-slate-500"><summary className="cursor-pointer font-semibold">Why some failed</summary>
              <ul className="mt-1 space-y-0.5">{run.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {run?.running ? (
          <button type="button" onClick={() => { stopRef.current = true; }} className="h-10 px-4 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-bold inline-flex items-center gap-1.5">
            <RefreshCw size={14} className="animate-spin" /> Stop
          </button>
        ) : (
          <button type="button" onClick={start} disabled={!cfg.configured}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
            <RefreshCw size={14} /> Fetch now
          </button>
        )}
        <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 font-semibold cursor-pointer">
          <input type="checkbox" checked={force} disabled={run?.running} onChange={(e) => setForce(e.target.checked)} className="w-4 h-4" /> Also refresh ones fetched 7+ days ago
        </label>
      </div>
    </div>
  );
}
