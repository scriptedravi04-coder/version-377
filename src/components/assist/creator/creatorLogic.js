// Session 54 (Ravi: "jaise brand panel ke liye chatbot banaya hai, waisa hi creator panel ke liye bhi … pura system"):
// Eva for CREATORS — the pure brain. No React, no server call, no storage: it reads a sentence, works out what
// the creator wants, and does the maths (campaign match, profile score, fair rate, earnings, deadlines…).
// Everything works with the AI off. The data comes from tools.js (the same lists the creator's screens load).
import { NICHES, nichesIn, cityIn, parseCount, numOf } from "../brand/brandLogic";
import { inr } from "../../feedback/assistKnowledge";

const lower = (t) => String(t || "").toLowerCase();
export const DAY = 864e5;
// v328: creator-facing counts in Indian style — 1.5 lakh → "1.5L", 1.2 crore → "1.2Cr"; thousands stay "15K".
export const shortNum = (n) => {
  const v = Number(n) || 0;
  const one = (x) => x.toFixed(x >= 10 ? 0 : 1).replace(/\.0$/, "");
  if (v >= 1e7) return `${one(v / 1e7)}Cr`;
  if (v >= 1e5) return `${one(v / 1e5)}L`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
};
// v328: IST (Asia/Kolkata, +5:30) helpers for month buckets.
const IST = 5.5 * 3600e3;
export const istMonth = (d) => { const t = d instanceof Date ? d.getTime() : Date.parse(d || ""); return Number.isFinite(t) ? new Date(t + IST).toISOString().slice(0, 7) : ""; };

// ── the creator's own profile ───────────────────────────────────────────────────────────────────────
export const followersOfMe = (p) => parseCount(p?.followers_instagram || p?.follower_count || p?.ig_followers || 0) + parseCount(p?.followers_youtube || p?.yt_subscribers || 0);
export const reachOfMe = (p) => parseCount(p?.avg_views_30d || p?.instagram_avg_reach || p?.avg_reach || p?.rate_card?.avg_reach || p?.rate_card?.instagram_avg_reach || 0);
export const nichesOfMe = (p) => {
  const raw = [p?.category, p?.primary_niche, p?.niche, ...(Array.isArray(p?.sub_categories) ? p.sub_categories : []), ...(Array.isArray(p?.categories) ? p.categories : [])]
    .concat(Array.isArray(p?.content_niches) ? p.content_niches : String(p?.content_niches || "").split(","))
    .filter(Boolean).map((x) => lower(x).trim()).filter(Boolean);
  return [...new Set(raw)];
};
/** The app's niche groups (Fashion, Food…) this creator belongs to. */
export const nicheGroupsOfMe = (p) => [...new Set(nichesOfMe(p).flatMap((n) => nichesIn(n)).concat(nichesIn(nichesOfMe(p).join(" "))))];
const photoOfMe = (p) => p?.picture || p?.photo || p?.avatar_url || p?.profile_picture || "";
const portfolioOf = (p) => (Array.isArray(p?.portfolio) ? p.portfolio : []).filter(Boolean);
export const myRates = (p) => ({
  reel: Number(p?.rate_reel || p?.reel_rate || p?.rate_card?.reel || p?.rate_card?.reels || 0) || 0,
  story: Number(p?.rate_story || p?.story_rate || p?.rate_card?.story || p?.rate_card?.stories || 0) || 0,
  yt: Number(p?.rate_yt_video || p?.rate_card?.yt_video || p?.rate_card?.youtube_integration || 0) || 0,
});

// ── does a campaign / brief fit this creator? (same keyword rule as the Apply check in CampaignDetail) ──
const words = (s) => String(s || "").toLowerCase().replace(/[&,/]/g, " ").split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 2 && !["and", "the", "for", "with"].includes(w));
export function categoryMatches(campaignCategories, creatorNiches) {
  const camp = (campaignCategories || []).map((c) => lower(c).trim()).filter(Boolean);
  if (!camp.length) return true;
  if (!creatorNiches.length) return false;
  const ck = creatorNiches.flatMap(words), kk = camp.flatMap(words);
  if (kk.some((a) => ck.some((b) => b.includes(a) || a.includes(b)))) return true;
  return camp.some((a) => creatorNiches.some((b) => b.includes(a) || a.includes(b)));
}
const campCategories = (c) => (Array.isArray(c?.categories) ? c.categories : c?.category ? [c.category] : []);
const budgetOf = (c) => Number(c?.budget_max || c?.budget || c?.budget_min || 0) || 0;
const deadlineOf = (c) => Date.parse(c?.deadline || c?.apply_by || c?.end_date || "") || 0;

/** Campaigns + UGC briefs ranked for this creator: { kind, id, title, brand, budget, deadline, score, why[] } */
export function rankOpportunities({ campaigns = [], briefs = [] } = {}, profile = {}, { applied = [], now = Date.now() } = {}) {
  const mine = nichesOfMe(profile);
  const groups = nicheGroupsOfMe(profile);
  const city = lower(profile?.city);
  const fol = followersOfMe(profile);
  const appliedIds = new Set(applied.map((a) => String(a.campaign_id || a.id)));
  const out = [];
  for (const c of campaigns || []) {
    const id = String(c.campaign_id || c.id || "");
    if (!id) continue;
    const st = lower(c.status || c.stage);
    if (st && !["live", "approved"].includes(st)) continue;
    if (c.applications_paused || c.closed_at) continue; // v328: paused / closed campaigns don't take applications (backend/campaignManage applyBlockReason)
    const dl = deadlineOf(c);
    if (dl && dl + DAY < now) continue;
    const cats = campCategories(c);
    if (!categoryMatches(cats, mine)) continue;
    let score = 40; const why = [];
    if (cats.length && mine.length) { score += 25; why.push(cats.slice(0, 2).join(", ")); }
    const loc = lower(`${c.location_type || ""} ${Array.isArray(c.specific_locations) ? c.specific_locations.join(" ") : ""} ${c.city || ""}`);
    if (city && loc.includes(city)) { score += 10; why.push(profile.city); }
    if (c.follower_min && fol && fol < Number(c.follower_min)) { score -= 25; why.push(`needs ${shortNum(c.follower_min)}+ followers`); }
    else if (c.follower_max && fol && fol > Number(c.follower_max)) { score -= 10; }
    const b = budgetOf(c);
    if (b) { score += Math.min(15, Math.round(Math.log10(b + 1) * 3)); why.push(`up to ${inr(b)}`); }
    if (dl) { const d = Math.ceil((dl - now) / DAY); if (d <= 3) why.push(d <= 0 ? "closes today" : `closes in ${d} day${d > 1 ? "s" : ""}`); }
    out.push({ kind: "campaign", id, title: c.title || "Campaign", brand: c.brand_name || "Brand", budget: b, budget_min: Number(c.budget_min) || 0, deadline: dl || null, score: Math.max(5, Math.min(99, score)), why, categories: cats, applied: appliedIds.has(id) || Boolean(c.has_applied), raw: c });
  }
  for (const b of briefs || []) {
    const id = String(b.id || "");
    if (!id || (b.status && String(b.status).toUpperCase() !== "OPEN")) continue;
    const text = `${b.title || ""} ${b.product_name || ""} ${b.product_description || ""} ${b.category || ""}`;
    const g = nichesIn(text);
    let score = 45; const why = [];
    if (g.length && groups.length && g.some((x) => groups.includes(x))) { score += 25; why.push(g[0]); }
    const money = Number(b.budget) || 0;
    if (money) { score += Math.min(15, Math.round(Math.log10(money + 1) * 3)); why.push(`${inr(money)} per video`); }
    const left = Math.max(0, Number(b.max_creators || 1) - Number(b.claimed_count || 0));
    if (left <= 0) continue;
    why.push(`${left} slot${left > 1 ? "s" : ""} left`);
    out.push({ kind: "ugc", id, title: b.title || b.product_name || "UGC video", brand: b.brand_name || "Brand", budget: money, deadline: null, score: Math.max(5, Math.min(99, score)), why, categories: g, applied: false, raw: b });
  }
  return out.sort((a, b) => (Number(a.applied) - Number(b.applied)) || (b.score - a.score) || (b.budget - a.budget));
}

// ── fair rate (same benchmark as the onboarding rate card: reel ≈ 30% of reach, story 12%, YouTube 60%) ──
const TIER_BASE = { Bronze: 500, Silver: 1500, Gold: 5000, Platinum: 15000 };
export function fairRates(profile = {}, market = null) {
  const reach = reachOfMe(profile) || Math.round(followersOfMe(profile) * 0.25);
  const tier = String(profile?.tier || "bronze").replace(/^./, (m) => m.toUpperCase());
  const base = TIER_BASE[tier] || 500;
  const round = (n) => Math.max(100, Math.round(n / 100) * 100);
  const reel = round(Math.max(base, reach * 0.3));
  const r = {
    reach,
    reel: { low: round(reel * 0.8), high: round(reel * 1.25) },
    story: { low: round(Math.max(base * 0.4, reach * 0.12) * 0.8), high: round(Math.max(base * 0.4, reach * 0.12) * 1.25) },
    yt: { low: round(Math.max(base * 2, reach * 0.6) * 0.8), high: round(Math.max(base * 2, reach * 0.6) * 1.25) },
    market: market && market.median_budget ? market.median_budget : 0,
  };
  return r;
}
export function rateAdvice(profile = {}, market = null) {
  const fr = fairRates(profile, market);
  const mine = myRates(profile);
  const notes = [];
  if (!fr.reach) notes.push("Add your average reach in your profile — the rate is guessed from followers until then.");
  if (mine.reel) {
    if (mine.reel > fr.reel.high * 1.3) notes.push(`Your reel rate ${inr(mine.reel)} is well above ${inr(fr.reel.high)} — brands may skip or negotiate.`);
    else if (mine.reel < fr.reel.low * 0.6) notes.push(`Your reel rate ${inr(mine.reel)} is low for your reach — you can ask ${inr(fr.reel.low)}+.`);
    else notes.push(`Your reel rate ${inr(mine.reel)} is in the right range.`);
  } else notes.push("You haven't set a reel rate yet — add it so brands can invite you directly.");
  if (fr.market) notes.push(`Live campaigns in your niche pay up to about ${inr(fr.market)} per creator.`);
  return { ...fr, mine, notes };
}

// ── Session 58 (Eva handoff, part 3): the apply card's limits and the one rate rule ────────────────────
// A fair reel quote is about ₹0.30 per average view. The apply card says so in its ⚠️ line; Eva's chat
// replies only give the amount ("around ₹X per reel"), never the formula.
export const PITCH_MIN = 20, PITCH_MAX = 500, QUOTE_MIN = 100, QUOTE_MAX = 5000000;
const PER_VIEW = 0.3;
/** Around what a creator with this reach should quote for one reel (₹, rounded to 100). 0 = no reach known. */
export function fairQuote(reach) {
  const r = Number(reach) || 0;
  return r > 0 ? Math.max(QUOTE_MIN, Math.round((r * PER_VIEW) / 100) * 100) : 0;
}
/** Checks a quote against the limits and the reach rule → { ok, level: empty|error|warn|good|info, fair, message } */
export function quoteCheck(reach, quote) {
  const q = Math.round(Number(String(quote ?? "").replace(/[^\d.]/g, "")) || 0);
  const fair = fairQuote(reach);
  if (!q) return { ok: false, level: "empty", fair, message: "" };
  if (q < QUOTE_MIN) return { ok: false, level: "error", fair, message: `Minimum quote is ${inr(QUOTE_MIN)}.` };
  if (q > QUOTE_MAX) return { ok: false, level: "error", fair, message: `Maximum quote is ${inr(QUOTE_MAX)}.` };
  if (!fair) return { ok: true, level: "info", fair, message: "Add your average reach in your profile and I'll check if this rate fits." };
  // v328: ✅ up to +10% of the fair rate, same as CreatorSettings validateRate (rate <= suggested * 1.10)
  if (q > fair * 1.1) return { ok: true, level: "warn", fair, message: `⚠️ Heads up! For your reach, a competitive rate would be around ${inr(fair)} (₹0.30/view). Your quoted charges are higher — you can still submit, brands may negotiate.` };
  return { ok: true, level: "good", fair, message: "✅ Your charges look justified for your reach." };
}
// v329: characters as a person counts them — an emoji / Hindi letter with its matra is 1, not 2 (".length" let
// 10 emoji pass the 20-character minimum). Intl.Segmenter where the browser has it, else code points.
const SEG = (() => { try { return typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null; } catch { return null; } })();
const graphemes = (s) => (SEG ? Array.from(SEG.segment(String(s ?? "")), (x) => x.segment) : Array.from(String(s ?? "")));
export const charCount = (s) => graphemes(s).length;
/** v329: cut text to at most `max` characters without splitting an emoji / letter in half. */
export const cutChars = (s, max) => { const g = graphemes(s); return g.length > max ? g.slice(0, max).join("") : String(s ?? ""); };
/** v329: the quote box — digits only, no leading zeros, cut at a decimal point ("4,500.50" → "4500"), max 8 digits. */
export const cleanQuoteInput = (v) => String(v ?? "").split(".")[0].replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").replace(/^0$/, "").slice(0, 8);
/** The pitch counter under the textarea: "n/500 · min 20" (amber while too short). */
export function pitchCheck(pitch) {
  const n = charCount(String(pitch || "").trim()); // v329: emoji / Hindi count as 1
  return { n, ok: n >= PITCH_MIN && n <= PITCH_MAX, short: n < PITCH_MIN, label: `${n}/${PITCH_MAX} · min ${PITCH_MIN}` };
}
/** GET creators/invitations → the invites still waiting for this creator (same filter as the home card). */
export function pendingInvites(resp) {
  const list = Array.isArray(resp?.pending) ? resp.pending
    : (Array.isArray(resp?.invitations) ? resp.invitations : Array.isArray(resp) ? resp : []).filter((i) => i && i.status === "pending_creator_acceptance");
  return list.filter((i) => i && i.id);
}

// ── profile score: what's missing, each with the screen that fixes it ─────────────────────────────────
export function profileScore(profile = {}, { kyc = "", hasPayout = false, money = true } = {}) {
  const items = [
    { key: "photo", label: "Profile photo", done: Boolean(photoOfMe(profile)), weight: 12, section: "profile" },
    // v363: a short bio used to stay "pending" with no reason shown — now the item says how short it is.
    (() => { const n = String(profile?.bio || "").trim().length; return { key: "bio", label: n > 0 && n < 40 ? `Bio is too short (${n}/40 characters) — add a line or two` : "Bio (2–3 lines about you, 40+ characters)", done: n >= 40, weight: 12, section: "profile" }; })(),
    { key: "niche", label: "Niche / category", done: nichesOfMe(profile).length > 0, weight: 12, section: "profile" },
    { key: "city", label: "City", done: Boolean(String(profile?.city || "").trim()), weight: 6, section: "profile" },
    { key: "insta", label: "Instagram handle + followers", done: Boolean(profile?.instagram_handle || profile?.instagram) && followersOfMe(profile) > 0, weight: 14, section: "platforms" },
    { key: "reach", label: "Average reach", done: reachOfMe(profile) > 0, weight: 10, section: "platforms" },
    { key: "rates", label: "Rate card (reel / story)", done: myRates(profile).reel > 0, weight: 10, section: "rates" },
    { key: "portfolio", label: "2+ portfolio pieces", done: portfolioOf(profile).length >= 2, weight: 10, section: "portfolio" },
    { key: "kyc", label: "KYC verified (needed to get paid)", done: /approved|verified/i.test(String(kyc || "")), weight: 9, section: "kyc" },
    { key: "payout", label: "Bank / UPI for payouts", done: Boolean(hasPayout), weight: 5, section: "kyc" },
  ].filter((i) => money || (i.key !== "kyc" && i.key !== "payout")); // v328: "Earnings & payouts" switched off → no KYC / payout items
  const total = items.reduce((a, i) => a + i.weight, 0);
  const got = items.filter((i) => i.done).reduce((a, i) => a + i.weight, 0);
  return { score: Math.round((got / total) * 100), items, missing: items.filter((i) => !i.done) };
}

// ── money ─────────────────────────────────────────────────────────────────────────────────────────────
// v328: paid = money reached the bank (PAID / COMPLETED, or a UTR / payout reference) — same rule as
// backend/creatorPayoutRequests.ts isPaidToBank. RELEASED = brand approved, payout comes next (not paid yet).
const isPaidOut = (t) => ["PAID", "COMPLETED"].includes(String(t?.payout_status || "").toUpperCase()) || Boolean(String(t?.payout_reference || t?.utr_number || "").trim());
const isApprovedNext = (t) => !isPaidOut(t) && String(t?.payout_status || "").toUpperCase() === "RELEASED";
export function earningsSummary(txns = [], now = new Date()) {
  const ym = istMonth; // v328: month bucket in IST
  const thisMonth = ym(now);
  const rows = (txns || []).filter((t) => !/refund|fail|cancel/i.test(String(t?.status || "")));
  const net = (t) => Number(t?.creator_net_amount || t?.net_amount || t?.amount || 0) || 0;
  const paid = rows.filter(isPaidOut);
  const approved = rows.filter(isApprovedNext); // v328: "Approved · payout next" bucket
  const pending = rows.filter((t) => !isPaidOut(t) && !isApprovedNext(t));
  const month = paid.filter((t) => ym(t.payout_completed_at || t.updated_at || t.created_at) === thisMonth);
  return {
    total: paid.reduce((a, t) => a + net(t), 0),
    month: month.reduce((a, t) => a + net(t), 0),
    approved: approved.reduce((a, t) => a + net(t), 0),
    approvedCount: approved.length,
    pending: pending.reduce((a, t) => a + net(t), 0),
    pendingCount: pending.length,
    paidCount: paid.length, // v329: jobs whose money reached the bank (the card says "paid" only for these)
    deals: paid.length + approved.length, // v328: only paid / approved jobs (unapproved escrow rows aren't "paid jobs")
    // v328: no nextPayout — the backend never sends expected_payout_date.
  };
}

// ── what's due (UGC orders + accepted campaign work) ──────────────────────────────────────────────────
export function dueItems({ orders = [], applications = [] } = {}, now = Date.now()) {
  const items = [];
  for (const o of orders || []) {
    const stage = String(o.stage || o.status || "").toUpperCase();
    const title = o.brief?.title || o.title || "UGC video";
    const due = Date.parse(o.sla_deadline || o.internal_deadline || o.deadline || "") || 0;
    const left = due ? Math.ceil((due - now) / 36e5) : null;
    const when = left == null ? "" : left <= 0 ? " — overdue" : left < 24 ? ` — ${left}h left` : ` — ${Math.ceil(left / 24)} days left`;
    if (["IN_PROGRESS", "CLAIMED", "ACCEPTED", "ACTIVE"].includes(stage)) items.push({ key: `o-${o.id}`, text: `Upload your video for "${title}"${when}`, link: "/creator/ugc", cta: "Open", urgent: left != null && left < 24 });
    else if (["REVISION_REQ", "REVISION_REQUESTED"].includes(stage)) items.push({ key: `o-${o.id}`, text: `Brand asked for changes on "${title}"${when}`, link: "/creator/ugc", cta: "Fix", urgent: true });
    else if (["CONTENT_APPROVED", "COMPLETED_APPROVAL", "AWAITING_LIVE_LINK", "REVISION_REQUESTED_LINKS"].includes(stage) && (o.requires_live_link || o.is_collaboration)) items.push({ key: `o-${o.id}`, text: `Post "${title}" and add the live link`, link: "/creator/ugc", cta: "Add link", urgent: true });
  }
  for (const a of applications || []) {
    const st = String(a.status || "").toUpperCase();
    if (/COMPLETED|CANCEL/i.test(String(a.deal?.status || ""))) continue; // v328: finished / cancelled deals aren't to-do
    if (a.thread_id && ["ACCEPTED", "SHORTLISTED", "ACTIVE"].includes(st)) items.push({ key: `a-${a.campaign_id || a.id}`, text: `"${a.campaign_title || a.title || "Campaign"}" accepted you — reply in chat`, link: `/chat/${a.thread_id}`, cta: "Chat" });
  }
  return items.sort((x, y) => Number(Boolean(y.urgent)) - Number(Boolean(x.urgent))).slice(0, 8);
}

// ── market insight from live campaigns + briefs (server aggregates; this turns it into lines) ───────────
export function insightLines(ins = {}, profile = {}) {
  const lines = [];
  const groups = nicheGroupsOfMe(profile);
  const top = (ins.top_niches || []).slice(0, 3);
  if (top.length) lines.push(`Most wanted right now: ${top.map((t) => `${t.niche} (${t.count})`).join(", ")}.`);
  const mine = (ins.niches || []).find((n) => groups.includes(n.niche));
  if (mine) lines.push(`${mine.niche}: ${mine.count} live — brands pay up to ~${inr(mine.median_budget || 0)} per creator.`);
  if (ins.ugc && ins.ugc.count) lines.push(`UGC videos: ${ins.ugc.count} open briefs, ~${inr(ins.ugc.median_budget || 0)} per video${ins.ugc.top_format ? `, mostly ${ins.ugc.top_format}` : ""}.`);
  if ((ins.formats || []).length) lines.push(`Asked most: ${ins.formats.slice(0, 3).join(", ")}.`);
  if (!lines.length) lines.push("Not enough live campaigns yet to see a pattern — I'll tell you as brands post more.");
  return lines;
}

// ── writing helpers that work without AI ─────────────────────────────────────────────────────────────
export function pitchFor(opp, profile = {}) {
  const name = String(profile?.name || "").trim().split(/\s+/)[0] || "I"; // v329: "  Ravi" had an empty first word
  const niche = nicheGroupsOfMe(profile)[0] || nichesOfMe(profile)[0] || "lifestyle";
  const fol = followersOfMe(profile), reach = reachOfMe(profile);
  const stats = [fol ? `${shortNum(fol)} followers` : "", reach ? `~${shortNum(reach)} average reach` : ""].filter(Boolean).join(" and ");
  return `Hi! ${name === "I" ? "I'm" : `I'm ${name},`} a ${lower(niche)} creator${profile?.city ? ` from ${profile.city}` : ""}${stats ? ` with ${stats}` : ""}. "${opp?.title || "Your campaign"}" fits my audience well — I'll make an honest, scroll-stopping reel that shows the product clearly and delivers on time.`;
}
export function suggestedAmount(opp, profile = {}) {
  const fr = fairRates(profile);
  // v328: no own reel rate → pre-fill the same fair quote quoteCheck uses (≈ ₹0.30 × avg views), so Eva's own
  // suggestion doesn't trigger her ⚠️. Still capped at the campaign budget below.
  const mine = myRates(profile).reel || fairQuote(fr.reach) || Math.round((fr.reel.low + fr.reel.high) / 2);
  const max = Number(opp?.budget) || 0, min = Number(opp?.budget_min) || 0;
  let amt = mine;
  if (max && amt > max) amt = max;
  if (min && amt < min) amt = min;
  return Math.max(100, Math.round(amt / 100) * 100);
}
// v328 (Ravi): UGC shows the brief budget only — labelled "Brief budget", not "You get"; no fee line.
export function explainBrief(b = {}) {
  const dos = Array.isArray(b.dos) ? b.dos : String(b.dos || "").split(/\n|•/).map((x) => x.trim()).filter(Boolean);
  const donts = Array.isArray(b.donts) ? b.donts : String(b.donts || "").split(/\n|•/).map((x) => x.trim()).filter(Boolean);
  const fmt = { collaboration_reel: "a reel posted on your Instagram (collab)", ugc_video_edited: "an edited video they'll use as an ad", ugc_video_raw: "raw clips (no editing) they will edit" }[b.deliverable_type] || "a short video";
  return {
    title: b.title || b.product_name || "Brief",
    lines: [
      `What: ${fmt}${b.video_duration ? `, ${b.video_duration}` : ""}.`,
      b.product_name ? `Product: ${b.product_name}${b.product_description ? ` — ${String(b.product_description).slice(0, 140)}` : ""}.` : "",
      b.detailed_requirements ? `They want: ${String(b.detailed_requirements).slice(0, 220)}` : "",
      b.budget ? `Brief budget: ${inr(b.budget)}${b.delivery_hours ? `, deliver within ${b.delivery_hours} hours` : ""}.` : "",
    ].filter(Boolean),
    dos, donts,
  };
}
export function draftChecklist(b = {}) {
  const items = [
    "Product is clearly visible in the first 3 seconds",
    "You say the product name at least once",
    `Length is right${b.video_duration ? ` (${b.video_duration})` : ""}`,
    "Good light, clear sound, no background noise",
    "Vertical 9:16, no other brand's logo in frame",
  ];
  if (b.deliverable_type === "collaboration_reel") items.push("Caption has #ad / paid partnership tag");
  for (const d of (Array.isArray(b.dos) ? b.dos : []).slice(0, 3)) items.push(`Do: ${d}`);
  for (const d of (Array.isArray(b.donts) ? b.donts : []).slice(0, 3)) items.push(`Don't: ${d}`);
  return items;
}
const IDEA_BANK = {
  Fashion: ["3 ways to style one outfit", "Budget vs premium look", "Get ready with me for a wedding", "Outfit for each day of the week", "Thrift haul + try-on"],
  Health: ["My honest morning routine", "1 habit that changed my sleep", "Myth vs fact in 30 seconds", "What I eat in a busy day", "Desk stretches in 60 seconds"],
  Food: ["₹100 meal challenge", "Street food rating in your city", "5-minute recipe with 3 ingredients", "Trying a viral food trend", "Tiffin ideas for the week"],
  Tech: ["Phone settings nobody uses", "Budget gadget under ₹999 tested", "My desk setup tour", "3 apps that save time", "Old vs new: is the upgrade worth it?"],
  Fitness: ["No-equipment 10-minute workout", "Form check: common mistakes", "What I eat after the gym", "30-day challenge day 1", "Beginner's first week plan"],
  Travel: ["₹5,000 weekend trip plan", "Hidden spots in your city", "Packing in one bag", "Things I wish I knew before going", "Train vs flight cost check"],
  Lifestyle: ["A day in my life", "Room makeover under ₹2,000", "Things I stopped buying", "My Sunday reset", "5 small habits that help"],
  Finance: ["How I split my salary", "One money mistake to avoid", "Explaining SIP in 30 seconds", "Saving challenge for a month", "Credit card myth vs fact"],
};
export function growthIdeas(profile = {}, week = 0) {
  const g = nicheGroupsOfMe(profile)[0] || "Lifestyle";
  const bank = IDEA_BANK[g] || IDEA_BANK.Lifestyle;
  const pick = [0, 1, 2].map((i) => bank[(week + i) % bank.length]);
  return {
    niche: g,
    ideas: pick,
    tips: [
      "Hook in the first 2 seconds — say the result first.",
      "Post at the same time 4–5 days a week; reels between 7–10 pm do best in India.",
      "Reply to every comment in the first hour — it pushes the reel to more people.",
    ],
  };
}

// ── what does the creator want? ──────────────────────────────────────────────────────────────────────
const RX = {
  handoff: /\b(campaign manager|manager se|insaan|human|real person|team se baat|baat karni|talk to (someone|team|a person))\b/,
  caps: /\b(what can you do|kya kar sakt[ie]|tum kya karti|help me|madad)\b/, // v328: bare "feature(s)" removed — feature ideas go to the team
  // v328: either order + plurals ("stop notifications", "notifications off", "disable alerts")
  alertsOff: /\b(alerts?|notifications?|batana)\b.*\b(band|off|stop|mat|disable)\b|\b(stop|turn off|switch off|disable|band karo|band kar do)\b.*\b(alerts?|notifications?)\b/,
  alertsOn: /\b(naya|naye|new)\b.*\b(campaigns?|briefs?|kaam|deals?|brands?)\b.*\b(aaye|aaye to|batana|bata dena|notify|alert)\b|\b(alert|notify) me\b|\bcampaign alert\b/,
  apply: /\b(apply|apply kar|apply karo|apply kardo|apply kar do|bhej do application)\b/,
  insights: /\b(brands? kya (maang|chahte|chahiye|demand)|demand|trend(ing)?|market|kya chal raha|kis cheez ki demand)\b/,
  rate: /\b(rate|rates|kitna charge|charge kar|kitne paise|price|pricing|fees?|kitna lu|kitna maang|should i charge|how much (should|can|do) i (charge|ask|quote)|what (should|do) i charge|my quote)\b/,
  invites: /\b(invit(e|es|ation|ations)|invited me|mujhe invite|kisne invite|brand (ne )?bulaya|offers?|brand ne bheja)\b/, // v328: "offers from brands" / "brand offers"
  bio: /\bbio\b/,
  portfolio: /\bportfolio\b/,
  // v333 (Ravi: "Can you create good profile for me" showed campaigns): words BEFORE "profile" count too.
  profile: /\b(profile)\b.*\b(score|improve|better|achh?i|complete|check|kaisi|strong)\b|\b(meri|my) profile\b|\brate (my|meri|mera) profile\b|\b(create|make|build|set ?up|improve|fix|complete|good|great|better|best|strong|achh?i|acchi|badhiya|banao|bana do|sudhar\w*)\b.*\bprofile\b|\bprofile\b.*\b(banao|bana do|bana de|banado)\b/,
  script: /\b(hooks?|scripts?|scrip|skript|captions?|hashtags?|likh do|likho|likh de)\b/, // v333: "scrip" typo
  checklist: /\b(checklist|draft check|submit karne se pehle|before (i )?submit|check my (video|draft))\b/,
  brief: /\b(brief|ye brand|brand kya chahta|samjha|samjhao|explain)\b/,
  // v328: "paise kab milenge", "when will I get my money / get paid" → payout check
  kyc: /\b(kyc|pan(?!\s*india)|upi|bank|payout (ruka|nahi|pending|kyun|kab)|pais[ae] (nahi|kab|kyun)|payment (nahi|kab|kyun|ruka)|get (my )?(money|paid|payment)|getting paid|be paid)\b/,
  // v329: "how much did I earn", "my pending payouts", "show my payments", "kitne paise mile" → earnings
  earnings: /\b(kamai|kamaya|earn|earned|earning|earnings|income|kitna mila|kitne paise mile|paise mile|payouts?|wallet|payments?)\b/,
  due: /\b(deadlines?|pending|kya baaki|baaki hai|kab tak|reminder|kya karna hai|to[- ]?do|due)\b/, // v328: "to do" with a space
  growth: /\b(grow|growth|followers? badh|reach badh|content ideas?|idea do|kya post|post kya|viral)\b/,
  refer: /\b(refer|referral|dost|friends?|invite (a )?friend|mera code)\b/,
  share: /\b(share card|story card|share karna|flex|achievement)\b/,
  ugc: /\bugc\b/,
  // v328: bare "work" removed ("how does it work?" isn't a campaign search); "work for me" is caught by "for me".
  campaigns: /\b(campaigns?|brands?|kaam|find work|new work|any work|deals?|collabs?|opportunit\w*|mere liye kya|for me|dhundo|dhundh|find)\b/,
};
/** → { intent } or null (null = the old helper answers: hi / thanks / bug / idea / budget). */
// v328: a question about Ybex's own fee / commission → the knowledge answer (null), not the creator's rate.
const PLATFORM_FEE = /\b(ybex('?s)?|platform|service|convenience)\b.*\b(fees?|commission|cut)\b|\b(platform|service|convenience) charges?\b|\b(fees?|commission)\b.*\b(ybex|platform)\b|\bkitna (kat|cut)/;
export function detectCreatorIntent(text) {
  const t = ` ${lower(text)} `;
  if (PLATFORM_FEE.test(t) && !RX.kyc.test(t)) return null; // v328
  if (/\brate (my|meri|mera) profile\b/.test(t)) return { intent: "profile" }; // v328: "rate my profile" isn't a rate question
  if (/\bkitne paise (mile|mila|aaye)\b/.test(t) && !RX.kyc.test(t)) return { intent: "earnings" }; // v329: "money I got", not "what to charge"
  // v329: "apply to boAt with my quote 5000" / "apply for 5k rate" is an application with a quote, not a rate question.
  const applyWithQuote = RX.apply.test(t) && !/\?|\b(how much|kitna|kitne|should i)\b/.test(t);
  for (const k of ["handoff", "alertsOff", "alertsOn", "insights", "checklist", "kyc", "rate", "bio", "portfolio", "profile", "script", "refer", "invites", "share", "growth", "earnings", "due", "caps"]) {
    if (k === "rate" && applyWithQuote) continue; // v329
    if (RX[k].test(t)) return { intent: k };
  }
  if (RX.brief.test(t) && /\b(brief|brand)\b/.test(t)) return { intent: "brief" };
  if (RX.apply.test(t)) return { intent: "apply" };
  // v345 (tester: "I need to know about UGC" got a list / a builder instead of an answer): "what is / tell me about /
  // kya hai / samjhao …" with no "find / dikhao / apply" → Eva explains (knowledge answer).
  const infoOnly = /\b(know about|knw about|what is|what's|whats|what are|what does|tell me about|explain|meaning|kya hai|kya hota|kya hote|kya hoti|matlab|samjha\w*|how does|how do(es)? .* work|how it works|kaise kaam)\b/.test(t)
    && !/\b(find|show|dikhao|dhundo|dhundh|list|apply|for me|mere liye|new|latest|available)\b/.test(t);
  if (infoOnly && (RX.ugc.test(t) || RX.campaigns.test(t))) return null;
  if (RX.ugc.test(t)) return { intent: "campaigns", ugcOnly: true };
  if (RX.campaigns.test(t)) return { intent: "campaigns" };
  return null;
}
// v328: money in an apply message ("₹5,000", "5k", "1.5 lakh", "rs 4500") — read it as the quote, and
// strip it before reading a count so "apply for 5k" isn't "apply to 5".
const AMOUNT_RX = /(?:₹|\brs\.?|\binr)\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|l)?\b|\b\d+(?:\.\d+)?\s*(?:k|lakh|lakhs|lac|l)\b|\b\d[\d,]*(?:\.\d+)?\s*(?:rs|rupees?|inr|\/-)(?=\s|$|[.,!?])|\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b|\b\d{3,}(?:\.\d+)?\b/gi;
const amountValue = (m) => {
  const x = lower(m).replace(/₹|\brs\.?|\binr|rupees?|\/-/g, "").replace(/,/g, "").trim();
  const n = parseFloat(x);
  if (!Number.isFinite(n)) return 0;
  const mul = /(lakhs?|lac|l)$/.test(x) ? 1e5 : /k$/.test(x) ? 1e3 : 1;
  return Math.round(n * mul);
};
const stripAmounts = (text) => String(text || "").replace(AMOUNT_RX, " ");
/** v328: "apply to Boat for ₹5,000" → 5000; no amount → 0. */
export function applyAmount(text) {
  const m = String(text || "").match(AMOUNT_RX) || [];
  // v329: a bare year ("the Diwali 2026 campaign") isn't a ₹2,026 quote; "₹2026" / "2026 rs" still is.
  const hit = m.find((x) => !/^\s*20[2-3]\d\s*$/.test(x));
  return hit ? amountValue(hit) : 0;
}
/** v328: the campaign the message names (brand or a title word), if any. */
const NAME_SKIP = new Set(["apply", "campaign", "campaigns", "karo", "kardo", "kar", "please", "top", "the", "for", "and", "with", "this", "that", "all", "sab", "saare", "sare", "mere", "liye", "pe", "par", "quote", "rate", "amount", "reel", "reels", "send", "application", "brand", "brands", "ugc", "video", "first", "best", "new", "one"]);
export function pickByName(list = [], text = "") {
  const toks = lower(stripAmounts(text)).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !NAME_SKIP.has(w));
  if (!toks.length) return null;
  const ws = (s) => lower(s).split(/[^a-z0-9]+/).filter(Boolean);
  return list.find((o) => ws(o.brand).some((w) => toks.includes(w))) || list.find((o) => ws(o.title).some((w) => w.length >= 3 && !NAME_SKIP.has(w) && toks.includes(w))) || null;
}
/** A bug report or a feature idea for the team (classify() result + the text). */
export const isReportText = (kind, text) => kind?.type === "feedback" && (kind.category === "bug" || (kind.category === "feature" && /\b(suggest|suggestion|feature|idea|please add|add (karo|kar do|kijiye)|should (have|add)|hona chahiye)\b/i.test(String(text || ""))));
/** v328: a bug, or an idea that isn't a question ("mera rate kitna hona chahiye" is a question) → goes to the team. */
export function reportClearsIntent(kind, text) {
  if (kind?.type === "feedback" && kind.category === "bug") return true;
  const asksQuestion = /\?|\b(kitna|kitni|kitne|kya|kaise|kab|kaun|how|what|when|which|why)\b/i.test(String(text || ""));
  return isReportText(kind, text) && !asksQuestion;
}
/** "top 3 pe apply karo" → 3; "sab pe" → 5 */
export function applyCount(text) {
  const m = lower(stripAmounts(text)).match(/\b(\d{1,2})\b/); // v328: amounts stripped first
  if (m) return Math.min(5, Math.max(1, Number(m[1])));
  return /\b(sab|all|saare|sare)\b/.test(lower(text)) ? 5 : 1;
}
export { NICHES, cityIn, numOf };
