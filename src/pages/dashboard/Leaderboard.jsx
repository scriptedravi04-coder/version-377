import React, { useEffect, useState } from "react";
import PersonPhoto from "../../components/common/PersonPhoto";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Trophy, MapPin, TrendingUp } from "lucide-react";

import UniversalTagSearch from "../../components/shared/UniversalTagSearch";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState("");
  // v330: loading / failed states — the list said "No creators" while loading and when the request failed.
  const [state, setState] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0); // v332: "Try again" button instead of "please refresh"

  useEffect(() => {
    // v332: category names with "&" or spaces broke the query; encode the value (same path).
    const p = category ? `?category=${encodeURIComponent(category)}&limit=25` : "?limit=25";
    setState("loading");
    setRows([]); // v332: the old category's list stayed on screen while the new one loaded / after it failed
    api.get(`/leaderboard${p}`).then(({data})=>{ setRows(Array.isArray(data) ? data : []); setState("ok"); }).catch(()=>setState("error"));
  }, [category, reloadKey]);
  // v332: long engagement numbers like 3.4567891% → 3.5%
  const pct = (v) => { const n = Number(v); return Number.isFinite(n) ? `${Math.round(n * 10) / 10}%` : "—"; };

  return (
    <div className="w-full max-w-none px-4 sm:px-6 md:px-12 py-8 sm:py-12" data-testid="leaderboard-page">
      <div className="flex items-center gap-3">
        <Trophy className="text-[var(--violet)]" size={36}/>
        <h1 className="font-display text-3xl sm:text-5xl tracking-tight">Performance Leaderboard</h1>
      </div>
      <p className="text-[var(--text-secondary)] mt-2">Top creators ranked by verified engagement, content quality & ROI delivered.</p>

      <div className="mt-6 flex gap-2 flex-wrap items-center">
        <button onClick={()=>setCategory("")} className={`px-4 py-1.5 min-h-[40px] text-sm rounded-full border ${category==="" ? "bg-foreground/10 text-[var(--text-primary)] border-foreground/20" : "border-[var(--border-default)]"}`} data-testid="cat-all">All</button>
        <div className="w-full sm:w-[300px] relative z-10">{/* v330: was a fixed 300px, wider than a 320px phone's content */}
          <UniversalTagSearch
            selectedTags={category ? [category] : []}
            onChange={tags => setCategory(tags[tags.length - 1] || "")}
            type="category"
            placeholder="Search categories..."
          />
        </div>
      </div>

      <div className="mt-8 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden" data-testid="leaderboard-table">
        <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 border-b border-[var(--border-default)] label-mini bg-[var(--bg-card)]/5 text-[var(--text-secondary)]">
          <div className="col-span-1">Rank</div>
          <div className="col-span-5">Creator</div>
          <div className="col-span-2">City</div>
          <div className="col-span-2">Engagement</div>
          <div className="col-span-2 text-right">Score (Estimate)</div>
        </div>
        {rows?.map((r, i) => (
          <Link to={`/creator/${r.user_id}`} key={r.user_id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2 px-5 py-4 border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-card)]/40 items-start md:items-center transition-colors" data-testid={`rank-${i+1}`}>
            <div className="flex items-center justify-between w-full md:w-auto md:col-span-1">
              <div className="font-display text-2xl font-black flex items-center gap-1.5 text-[var(--text-primary)]">
                <span className="md:hidden text-[var(--text-tertiary)] text-xs font-mono uppercase">Rank</span> #{i+1}
              </div>
              <div className="md:hidden text-right">
                <span className="text-[10px] text-[var(--text-tertiary)] block">Score</span>
                <span className="inline-flex items-center gap-1 font-display text-lg text-[var(--violet)]">
                  <TrendingUp size={12}/> {r.performance_score ?? "—"}
                </span>
              </div>
            </div>
            
            <div className="col-span-5 flex items-center gap-3 w-full">
              <PersonPhoto src={r.photo || r.picture} name={r.name} className="w-10 h-10 rounded-full object-cover shrink-0" textClassName="text-xs"/>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[var(--text-primary)] text-base md:text-sm truncate">{r.name || "Creator"}</div>
                {/* v332: indigo-300 on a white card was unreadable on phones */}
                <div className="text-xs text-[var(--text-secondary)] font-medium mt-0.5 truncate">{Array.isArray(r.category) ? r.category.join(", ") : r.category}</div>
              </div>
            </div>

            <div className="flex md:grid md:grid-cols-6 md:col-span-6 w-full items-center justify-between text-xs md:text-sm gap-2 mt-1 md:mt-0 pt-2.5 md:pt-0 border-t border-foreground/5 md:border-0">
              <div className="md:col-span-2 text-[var(--text-secondary)] flex items-center gap-1"><MapPin size={12}/> {r.city || "—"}</div>
              <div className="md:col-span-2 font-mono text-[var(--text-secondary)] md:text-[var(--text-primary)]"><span className="md:hidden text-[var(--text-tertiary)] font-sans mr-1">Engagement:</span>{r.engagement_rate != null ? pct(r.engagement_rate) : "—"}</div>
              
              <div className="hidden md:block md:col-span-2 text-right">
                <span className="inline-flex items-center gap-1 font-display text-2xl text-emerald-400">
                  <TrendingUp size={14}/> {r.performance_score ?? "—"}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="px-5 py-12 text-center text-[var(--text-tertiary)]">
            {state === "loading" ? (
              <div className="space-y-3 text-left" aria-busy="true" aria-label="Loading the leaderboard">{/* v333: rows, not "Loading…" */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-4 bg-slate-100 rounded animate-pulse" />
                    <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                    <div className="flex-1 space-y-1.5"><div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" /><div className="h-2.5 w-1/3 bg-slate-100 rounded animate-pulse" /></div>
                  </div>
                ))}
              </div>
            ) : state === "error" ? (
              <>
                Couldn't load the leaderboard.
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="mt-3 mx-auto block h-10 px-5 rounded-full border border-[var(--border-default)] text-sm font-semibold text-[var(--text-primary)]">Try again</button>
              </>
            ) : category ? "No creators in this category yet" : "No creators yet"}
          </div>
        )}
      </div>
    </div>
  );
}
