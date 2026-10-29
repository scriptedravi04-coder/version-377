import React, { useState } from "react";
import { ChevronLeft, Share2, Heart, CheckCircle2, Award, Star, Eye, Send, Pencil } from "lucide-react";

// v363 (Ravi's design 1f "Public profile — photo-led, live stats"): on phones the creator's face is the cover
// and fades into the page colour (sampled from the photo — see adaptiveTheme.js), then chips, name, one CTA and one
// glass panel with the four numbers. Numbers are never invented: "—" when we don't have them.

/** 10376 → "10.4K", 1250000 → "12.5L" style short counts (Indian). null → "—". Pure. */
export function shortCount(v) {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, "")}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1).replace(/\.0$/, "")}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}
const fullCount = (v) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) || n <= 0 ? "—" : Math.round(n).toLocaleString("en-IN");
};

/** The four numbers of the stats panel + whether they're live from Instagram. Pure. */
export function profileNumbers(c = {}) {
  const st = c.instagram_stats && typeof c.instagram_stats === "object" ? c.instagram_stats : {};
  const pick = (...xs) => xs.find((x) => x !== null && x !== undefined && x !== "" && Number(x) > 0);
  const er = [st.engagement_rate, c.engagement_rate].find((x) => x !== null && x !== undefined && x !== "" && Number.isFinite(Number(x)) && Number(x) > 0);
  return {
    followers: pick(c.ig_followers, c.followers_instagram, c.follower_count, st.followers),
    views: pick(c.avg_views_30d, st.avg_views, st.reach_28d),
    likes: pick(c.avg_likes_30d, st.avg_likes),
    er: er === undefined ? null : Number(er),
    live: Boolean(c.instagram_synced_at) && !st.error,
  };
}

export default function PhotoLedHeaderMobile({
  c, theme, photoUrl, onBack, onShare,
  chips = { kyc: false, tier: null, reviewsLabel: "", profileViews: 0, match: null },
  cta = null, // { label, onClick, icon: "send" | "edit" }
  secondary = null, // { label, onClick, active } — round button next to the CTA
  ownerNote = null,
}) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const hasPhoto = Boolean(photoUrl) && !photoBroken && theme;
  const t = hasPhoto ? theme : { mode: "light", bg: "#F2F2F7", text: "#0A0A0A", sub: "rgba(10,10,10,.6)", glass: "#FFFFFF", glassBorder: "#E5E7EB", ctaBg: "#7C3AED", ctaText: "#FFFFFF", chipBg: "rgba(10,10,10,.06)" };
  const nums = profileNumbers(c);
  const handle = String(c.instagram_handle || "").replace(/^@/, "").trim()
    || (/^https?:/i.test(String(c.instagram || "")) ? "" : String(c.instagram || "").replace(/^@/, "").trim());
  const subLine = [handle ? `@${handle}` : "", c.category || c.primary_niche || "", c.city || ""].filter(Boolean).join(" · ");
  const roundBtn = t.mode === "dark" ? "bg-black/35 text-white border border-white/15" : "bg-white/85 text-slate-800 border border-black/5";

  return (
    <div data-testid="public-profile-photo-led" data-theme={t.mode} style={{ background: t.bg, color: t.text }}>
      {/* Cover: the face, fading into the page colour */}
      <div className="relative w-full" style={{ height: hasPhoto ? "min(62vh, 520px)" : 210 }}>
        {hasPhoto ? (
          <img src={photoUrl} alt={c.name || "Creator"} referrerPolicy="no-referrer" onError={() => setPhotoBroken(true)}
            className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 25%" }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white/90 text-6xl font-black">{String(c.name || "C").trim().charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0" style={{ height: hasPhoto ? "66%" : "40%", background: `linear-gradient(to bottom, transparent 0%, ${t.bg}${hasPhoto ? "B3" : ""} 55%, ${t.bg} 88%)` }} />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
          <button type="button" onClick={onBack} aria-label="Back" className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center ${roundBtn}`}><ChevronLeft size={20} /></button>
          <button type="button" onClick={onShare} aria-label="Share profile" className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center ${roundBtn}`}><Share2 size={16} /></button>
        </div>
      </div>

      <div className="relative px-5" style={{ marginTop: hasPhoto ? -118 : -36 }}>
        {/* chips */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {chips.kyc && (
            <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold backdrop-blur-md ${t.mode === "dark" ? "bg-black/40 text-emerald-300 border border-emerald-300/30" : "bg-white/80 text-emerald-700 border border-emerald-600/20"}`}><CheckCircle2 size={12} /> KYC verified</span>
          )}
          {chips.tier && (
            <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-black uppercase backdrop-blur-md ${t.mode === "dark" ? "bg-black/40 text-amber-300 border border-amber-300/30" : "bg-white/80 text-amber-700 border border-amber-600/20"}`}><Award size={12} /> {chips.tier}</span>
          )}
          {chips.match && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-black bg-violet-500/15 text-violet-400 border border-violet-500/25">{chips.match}% match</span>
          )}
        </div>
        <h1 className="mt-2 text-center text-[30px] leading-[1.08] font-black tracking-[-0.02em] break-words">{c.name || "Creator"}</h1>
        {subLine && <p className="mt-1 text-center text-[13px] font-semibold" style={{ color: t.sub }}>{subLine}</p>}
        <div className="mt-1.5 flex items-center justify-center gap-3 text-[11.5px] font-semibold" style={{ color: t.sub }}>
          <span className="inline-flex items-center gap-1"><Eye size={12} /> {Number(chips.profileViews || 0).toLocaleString("en-IN")} profile views</span>
          {chips.reviewsLabel && <span className="inline-flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" /> {chips.reviewsLabel}</span>}
        </div>

        {/* CTA row */}
        {(cta || secondary) && (
          <div className="mt-4 flex items-center gap-2.5">
            {cta && (
              <button type="button" onClick={cta.onClick} data-testid="public-profile-cta"
                className="flex-1 h-[52px] rounded-full text-[15px] font-bold inline-flex items-center justify-center gap-2 shadow-sm active:scale-[.99] transition"
                style={{ background: t.ctaBg, color: t.ctaText }}>
                {cta.icon === "edit" ? <Pencil size={15} /> : <Send size={15} />} {cta.label}
              </button>
            )}
            {secondary && (
              <button type="button" onClick={secondary.onClick} aria-label={secondary.label} aria-pressed={Boolean(secondary.active)}
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0 backdrop-blur-md"
                style={{ background: secondary.active ? "#F43F5E" : t.glass, border: `1px solid ${secondary.active ? "#F43F5E" : t.glassBorder}`, color: secondary.active ? "#fff" : t.text }}>
                <Heart size={19} className={secondary.active ? "fill-white" : ""} />
              </button>
            )}
          </div>
        )}

        {/* one glass panel with the numbers */}
        <div className="mt-4 rounded-[20px] backdrop-blur-xl px-2 pt-3 pb-2.5" style={{ background: t.glass, border: `1px solid ${t.glassBorder}` }} data-testid="public-profile-stats">
          <div className="grid grid-cols-4">
            {[["Followers", shortCount(nums.followers)], ["Avg views", shortCount(nums.views)], ["Avg likes", fullCount(nums.likes)], ["Engagement", nums.er != null ? `${Number(nums.er).toFixed(1).replace(/\.0$/, "")}%` : "—"]].map(([label, value], i) => (
              <div key={label} className="text-center px-1" style={{ borderLeft: i ? `1px solid ${t.glassBorder}` : "none" }}>
                <div className={`text-[17px] font-black tracking-[-0.01em] ${label === "Engagement" && value !== "—" ? (t.mode === "dark" ? "text-violet-300" : "text-[#7C3AED]") : ""}`}>{value}</div>
                <div className="text-[10.5px] font-semibold mt-0.5" style={{ color: t.sub }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold" style={{ color: t.sub }}>
            {nums.live ? (<><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live from Instagram · verified by Ybex</>) : <>Numbers entered by the creator</>}
          </div>
        </div>
        {ownerNote}
      </div>
    </div>
  );
}
