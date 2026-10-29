import React from "react";
import { ArrowRight, Eye, Clock } from "lucide-react";
import { campaignStatsFor, campaignAvatarsFor } from "../../../utils/campaignStatsForViewer";
import { getCreatorRequirementsString } from "../../../utils/campaignRequirementLine";

// Session 58 (Ravi: "home pe jo campaign aa raha hai, adhi adhuri details … kitne views, kitne applied,
// payout kya hai — campaign page jaisa dikhao", reference: a brand-card with face, posted time, the brief,
// per-influencer payout and the deliverable). Same numbers and rules as the Campaigns list card
// (CampaignsListMobile): views / applied from campaignStatsFor, the auto requirement line, budget range.

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
export function budgetLine(c) {
  const lo = Number(c?.budget_min || 0), hi = Number(c?.budget_max || 0);
  if (lo && hi && hi !== lo) return `${inr(lo)}–${inr(hi)}`;
  return lo || hi ? inr(lo || hi) : "Open budget";
}
export function deliverableLine(c) {
  const d = Array.isArray(c?.deliverables) ? c.deliverables.filter(Boolean).map((x) => (typeof x === "string" ? x : x?.label || x?.type || "")).filter(Boolean) : [];
  return d.length ? d.slice(0, 2).join(" + ") : "As per brief";
}
export function postedAgo(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (Number.isNaN(t)) return "";
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 60) return m <= 1 ? "Just now" : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }); // v330: IST
}
function closesIn(deadline) {
  const t = Date.parse(deadline || "");
  if (Number.isNaN(t)) return "";
  const days = Math.ceil((t - Date.now()) / 86400000);
  if (days < 0) return "";
  if (days === 0) return "Closes today";
  return days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
}

// v333 (Ravi: "Eva ke andar campaign ka UI generic rakh — dashboard jaisa, bas color green"): the same card is used
// inside Ybex Eva with tone="green", a custom pay line (UGC budget per video) and an action button underneath.
const TONES = {
  purple: { tint: "#F5F0FF", ink: "#7C3AED", ring: "#E6E6EE" },
  green: { tint: "#ECFDF3", ink: "#15803D", ring: "#DCEFE2" },
};
export default function HomeCampaignCard({ c, user, onOpen, tone = "purple", payLabel = "Per creator", payText = null, tag = null, footer = null, selected = false, style: extraStyle = null }) {
  const T = TONES[tone] || TONES.purple;
  const [logoBroken, setLogoBroken] = React.useState(false); // v330: fall back to the letter when the logo fails
  const brandName = c.brand_name || c.company || c.brand || "Brand";
  const logo = c.brand_logo || c.brand_photo || "";
  const stats = campaignStatsFor(c, user);
  const avatars = campaignAvatarsFor(c, stats.applied || 2, user);
  const req = c.description
    ? String(c.description).replace(/\s+/g, " ").trim()
    : getCreatorRequirementsString({
      isUgc: false, categories: c.categories || (c.category ? [c.category] : []), platforms: c.platforms || [],
      follower_min: c.follower_min, follower_max: c.follower_max, gender: c.gender || "Both",
      languages: c.languages || [], location: c.location_type || c.city || "",
    });
  const closes = closesIn(c.deadline);
  const ago = postedAgo(c.created_at);

  return (
    <Root footer={footer} onOpen={onOpen} selected={selected} T={T}
      style={{ width: "min(300px, 82vw)", scrollSnapAlign: "start", fontFamily: "'DM Sans', sans-serif", ...(extraStyle || {}) }}>
      <div className="flex items-center gap-2.5">
        {logo && !logoBroken && !String(logo).includes("dicebear") ? (
          <img src={logo} alt="" onError={() => setLogoBroken(true)} className="w-11 h-11 rounded-full object-cover bg-white border border-[#ECECF0] shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0" style={{ background: T.tint, color: T.ink }}>
            {String(brandName).trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-[#0A0A0A] truncate">{brandName}</div>
          <div className="text-[11.5px] text-[#6B7280] truncate">{tag ? `${tag} · ` : ""}{ago || (tag === "UGC" ? "New brief" : "New campaign")}{closes ? ` · ${closes}` : ""}</div>
        </div>
        {c.matchScore != null ? (
          <span className="shrink-0 px-2 py-1 rounded-full text-[10.5px] font-bold" style={{ background: T.tint, color: T.ink }}>{c.matchScore}% match</span>
        ) : (
          <span className="shrink-0 w-8 h-8 rounded-full border border-[#E6E6EE] flex items-center justify-center" style={{ color: T.ink }}><ArrowRight size={15} /></span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[#F2F2F5]">
        <div className="text-[14px] font-bold text-[#0A0A0A] leading-snug line-clamp-1">{c.title || c.campaign_name || "Campaign"}</div>
        {req ? <p className="mt-1 text-[12.5px] leading-[1.5] text-[#374151] line-clamp-2 min-h-[37px]">{req}</p> : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[#F9F9FB] px-2.5 py-2 min-w-0">
          <div className="text-[9.5px] font-bold tracking-wider text-[#8E8E93] uppercase">{payLabel}</div>
          <div className="text-[13.5px] font-bold truncate" style={{ color: tone === "green" ? T.ink : "#0A0A0A" }}>{payText || budgetLine(c)}</div>
        </div>
        <div className="rounded-xl bg-[#F9F9FB] px-2.5 py-2 min-w-0">
          <div className="text-[9.5px] font-bold tracking-wider text-[#8E8E93] uppercase">Deliverable</div>
          <div className="text-[12.5px] font-semibold text-[#0A0A0A] truncate">{deliverableLine(c)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11.5px] text-[#6B7280]">
        {stats.views != null ? (
          <span className="inline-flex items-center gap-1 font-semibold"><Eye size={12} /> {Number(stats.views).toLocaleString("en-IN")} views</span>
        ) : closes ? (
          <span className="inline-flex items-center gap-1 font-semibold"><Clock size={12} /> {closes}</span>
        ) : <span />}
        <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: T.ink }}>
          {Array.isArray(avatars) && avatars.length > 0 && (
            <span className="flex -space-x-1.5">
              {avatars.slice(0, 3).map((a, i) => <img key={i} src={a} alt="" onError={(e) => { e.currentTarget.style.display = "none"; } /* v330: hide a broken face */} className="w-4 h-4 rounded-full border border-white bg-gray-100 object-cover" />)}
            </span>
          )}
          {stats.applied ? `${stats.applied}+ applied` : "Be the first to apply"}
        </span>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Root>
  );
}

// With an action button inside (Eva), the card can't itself be a <button> — the top part opens the campaign.
function Root({ footer, onOpen, selected, T, style, children }) {
  const cls = "text-left bg-white rounded-[20px] border p-3.5 flex flex-col shrink-0 transition-transform";
  const ring = selected ? { borderColor: T.ink, boxShadow: `0 0 0 3px ${T.tint}` } : { borderColor: T.ring };
  if (!footer) {
    return <button type="button" onClick={onOpen} data-testid="home-campaign-card" className={`${cls} active:scale-[.99]`} style={{ ...style, ...ring }}>{children}</button>;
  }
  return (
    <div data-testid="home-campaign-card" className={cls} style={{ ...style, ...ring }}
      role="button" tabIndex={0} onClick={(e) => { if (e.target.closest("button,a")) return; onOpen?.(); }}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onOpen?.(); } }}>
      {children}
    </div>
  );
}
