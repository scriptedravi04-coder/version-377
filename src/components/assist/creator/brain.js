// Session 54: Eva for creators — decides what to do with one message and returns { reply, card?, state }, or
// null when it isn't a creator task (then the old helper answers: hi / thanks / bug / idea / budget).
// Order: a question we are in the middle of → rules → AI (only for real questions).
import { classify, detectLang } from "../../feedback/assistBrain";
import { inr } from "../../feedback/assistKnowledge";
import { CLEAR_CHAT, NEW_CHAT } from "../brand/brandLogic";
import {
  detectCreatorIntent, applyCount, profileScore, rateAdvice, earningsSummary, dueItems, insightLines, pitchFor,
  suggestedAmount, explainBrief, draftChecklist, growthIdeas, nicheGroupsOfMe, nichesOfMe, followersOfMe, reachOfMe,
  fairQuote, quoteCheck, myRates, fairRates, shortNum, applyAmount, pickByName, isReportText, reportClearsIntent, // v328: Indian-style shortNum; apply amount / name
} from "./creatorLogic";
import * as T from "./tools";
import { CREATOR_POPULAR, CREATOR_MORE } from "./capsChips";
import * as M from "../brand/memory";
import { readEvaSettings, blockedSwitch, blockedReply } from "../../feedback/evaSettings";

export const initialCreatorState = () => ({ awaiting: null, last: null, page: 0 });
const say = (lang, en, hi) => (lang === "hi" ? hi : en);
const WA_NUMBER = "918764004299";

export const CREATOR_CAPS = [
  "Find campaigns & UGC briefs that fit you, and apply in one tap",
  "Show brand invitations — accept or decline with a reason",
  "Tell you when new matching campaigns go live (phone notification)",
  "Show what brands want right now and what they pay",
  "Write hooks, scripts, captions, your bio and portfolio text",
  "Explain a brief and give you a checklist before you submit",
  "Check your profile score and your fair rate",
  "Your earnings, pending payouts and what's due",
  "KYC / payout help, refer a friend, a card to share your win",
];

/** First thing when a creator opens the chat: what's due + new matching work + profile nudge. */
export async function onOpen() {
  const out = [];
  try {
    // Session 58 (Eva handoff part 3): English by default; brand invitations come first.
    const dealsOn = !blockedSwitch("creator", "due", readEvaSettings()); // "Deals & offers" off → no invites / due items
    const [{ profile, kyc, hasPayout: hp, payoutUnknown, money }, work, invites] = await Promise.all([T.loadMe(), T.loadWork(), dealsOn ? T.loadInvites() : []]);
    const hasPayout = hp || Boolean(payoutUnknown); // v332: couldn't read → don't nag "add bank / UPI"
    if (invites.length) out.push({ reply: invites.length > 1 ? `${invites.length} brands invited you:` : `${invites[0].brand_name || "A brand"} invited you:`, card: { type: "invites", items: invites.slice(0, 5) } });
    const due = dealsOn ? dueItems({ orders: work.orders, applications: work.applications }) : [];
    if (due.length) out.push({ reply: due.length > 1 ? `${due.length} things are waiting for you:` : "1 thing is waiting for you:", card: { type: "due", items: due } });
    const { list } = await T.opportunities();
    const fresh = list.filter((o) => !o.applied && o.score >= 60).slice(0, 3);
    if (fresh.length) out.push({ reply: fresh.length > 1 ? `${fresh.length} new opportunities match you:` : "1 new opportunity matches you:", card: { type: "opps", items: fresh, total: fresh.length } });
    const ps = profileScore(profile, { kyc, hasPayout, money }); // v328: no KYC / payout items when "Earnings & payouts" is off
    if (ps.score < 70) out.push({ reply: `Your profile is ${ps.score}% complete — finish it and brands will invite you more.`, card: { type: "profile", score: ps } });
  } catch { /* nothing to show */ }
  return out;
}

/** One creator message → { reply, card?, state } | null */
export async function handleCreatorMessage(text, state = initialCreatorState(), { history = [], name = "", chatId = null } = {}) {
  // v328: Eva settings language — "en" follows how the user writes (Hinglish in → Hinglish out); Hinglish / Hindi → "hi".
  const setLang = readEvaSettings().lang;
  const lang = setLang === "hinglish" || setLang === "hi" ? "hi" : detectLang(text);
  const st = { ...state };
  const kind = classify(text);
  const isReport = isReportText(kind, text); // v328: moved to creatorLogic (same rule) so it can be tested

  // Session 58: "new chat" opens a fresh chat; the old one is kept (it used to be deleted).
  if (NEW_CHAT.test(text.trim())) return { reply: say(lang, "Fresh chat started. What do you need?", "Nayi chat shuru. Batao kya chahiye?"), newChat: true, state: initialCreatorState() };
  if (CLEAR_CHAT.test(text.trim())) {
    const ok = await M.clearHistory(chatId);
    return { reply: ok ? say(lang, "Done — this chat is cleared.", "Ho gaya — ye chat saaf kar di.") : say(lang, "Couldn't clear the chat right now.", "Abhi chat saaf nahi ho payi."), clearScreen: ok, state: initialCreatorState() };
  }

  // A brief / script request we asked a follow-up for.
  if (st.awaiting === "scriptProduct") {
    st.awaiting = null;
    return writeScript(text, st, lang, history);
  }
  if (st.awaiting === "briefText") {
    st.awaiting = null;
    const e = explainBrief({ detailed_requirements: text, title: "Your brief" });
    return { reply: say(lang, "Here's the brief in simple words, plus a checklist:", "Brief simple bhasha mein, aur checklist:"), card: { type: "brief", brief: e, checklist: draftChecklist({}) }, state: st };
  }

  // "aur dikhao" → the next page of opportunities
  if (st.last === "opps" && /^(aur|more|aur dikhao|aur bhi|show more|see more|next|aage)\b/i.test(text.trim())) {
    const { list } = await T.opportunities({ ugcOnly: Boolean(st.ugcOnly) }); // v328: keep the UGC-only filter
    const from = (st.page + 1) * 6;
    const items = list.slice(from, from + 6);
    if (!items.length) return { reply: say(lang, "That's everything live for you right now.", "Abhi ke liye itna hi live hai."), state: st };
    return { reply: say(lang, `${from + 1}–${from + items.length} of ${list.length}:`, `${list.length} mein se ${from + 1}–${from + items.length}:`), card: { type: "opps", items, total: list.length, shown: from + items.length }, state: { ...st, page: st.page + 1 } };
  }

  let hit = detectCreatorIntent(text);
  // A real bug report still goes to the team; "rate kitna hona chahiye" is a question, not a feature idea.
  // v328: a feature idea ("please add …") also goes to the team, not the caps card (see reportClearsIntent).
  if (hit && reportClearsIntent(kind, text)) hit = null;
  if (!hit && !isReport && kind.type !== "chat" && text.trim().length > 12) {
    const ai = await T.askAi("creator_understand", text, { history });
    if (ai?.intent && ai.intent !== "other") hit = { intent: ai.intent, ai };
    else if (ai?.reply) return { reply: String(ai.reply).slice(0, 600), state: st };
  }
  if (!hit) return null;
  // Session 58 (Eva settings): a switched-off permission means Eva doesn't read that data.
  const off = blockedSwitch("creator", hit.intent);
  if (off) return { reply: blockedReply("creator", off), card: { type: "evaSettings" }, state: st };
  // v329: any other answer ends the "Show more" paging — "more" after a rate question used to page old campaigns.
  if (hit.intent !== "campaigns") st.last = null;

  switch (hit.intent) {
    case "caps":
      // v333: one short line + popular chips + "Show more" (Eva design §8b), not the long ✓ box.
      return { reply: say(lang, "I find brand deals for you, write scripts and bios, check your rate and keep track of your money. Popular:", "Main aapke liye brand deals dhoondhti hoon, script aur bio likhti hoon, rate check karti hoon aur paison ka hisaab rakhti hoon. Popular:"), card: { type: "chips", send: "value", chips: CREATOR_POPULAR, more: CREATOR_MORE }, state: st };

    case "campaigns": {
      const { list } = await T.opportunities({ ugcOnly: Boolean(hit.ugcOnly) });
      const open = list.filter((o) => !o.applied);
      if (!list.length) return { reply: say(lang, "No live campaign matches your niche right now. Turn on alerts and I'll tell you the moment one goes live.", "Abhi aapke niche ka koi live campaign nahi hai. Alert on kar do — naya aate hi bata dungi."), card: { type: "alertToggle" }, state: st };
      return { reply: say(lang, `${open.length} open for you${list.length > open.length ? ` (+${list.length - open.length} already applied)` : ""}. Best match first:`, `Aapke liye ${open.length} khule hain${list.length > open.length ? ` (+${list.length - open.length} pe apply ho chuka)` : ""}. Sabse achha match pehle:`), card: { type: "opps", items: list.slice(0, 6), total: list.length, shown: Math.min(6, list.length) }, state: { ...st, last: "opps", page: 0, ugcOnly: Boolean(hit.ugcOnly) } }; // v328: remembered for "Show more"
    }

    case "apply": {
      const { list, profile } = await T.opportunities({ campaignsOnly: true });
      const n = applyCount(text);
      // v328: a named brand / title → that campaign; an amount in the message → the quote.
      const named = pickByName(list.filter((o) => !o.applied), text);
      // v329: "apply to boAt" when boAt is already applied → say so (it used to fill a different campaign).
      const namedDone = !named && pickByName(list.filter((o) => o.applied), text);
      if (namedDone) return { reply: say(lang, `You've already applied to "${namedDone.title}" by ${namedDone.brand}. It shows in your to-do once the brand accepts you.`, `"${namedDone.title}" (${namedDone.brand}) pe aap pehle hi apply kar chuke ho. Brand accept kare to to-do mein dikhega.`), state: st };
      const picks = named ? [named] : list.filter((o) => !o.applied).slice(0, n);
      const asked = applyAmount(text);
      if (!picks.length) return { reply: say(lang, "Nothing new to apply for right now — you've applied to everything that matches.", "Abhi apply karne ko kuch naya nahi hai — jo match karta tha sab pe apply ho chuka."), state: st };
      const reach = fairRates(profile).reach;
      const items = picks.map((o) => ({ ...o, pitch: pitchFor(o, profile), amount: asked || suggestedAmount(o, profile), reach }));
      return { reply: say(lang, `I filled ${items.length > 1 ? "these" : "this"} for you — check the pitch and quote, then tap Send application.`, "Maine bhar diya — pitch aur quote dekh lo, phir Send application dabao."), card: { type: "apply", items }, state: st };
    }

    case "alertsOn": {
      const { profile } = await T.loadMe();
      const ok = await T.setCampaignAlerts(true, profile);
      return { reply: ok ? say(lang, "Done — when a campaign or UGC brief that fits you goes live, you'll get a phone notification.", "Ho gaya — aapke match ka campaign ya UGC brief live hote hi phone pe notification aayega.") : say(lang, "Couldn't turn alerts on right now. Try again in a bit.", "Abhi alert on nahi ho paya, thodi der mein try karo."), state: st };
    }
    case "alertsOff": {
      const ok = await T.setCampaignAlerts(false);
      return { reply: ok ? say(lang, "Alerts are off.", "Alerts band kar diye.") : say(lang, "Couldn't change it right now.", "Abhi badal nahi paya."), state: st };
    }

    case "insights": {
      const [ins, { profile }] = await Promise.all([T.loadInsights(), T.loadMe()]);
      return { reply: say(lang, "What brands on Ybex are asking for right now:", "Ybex pe brands abhi ye maang rahe hain:"), card: { type: "insights", lines: insightLines(ins || {}, profile) }, state: st };
    }

    case "rate": {
      // Session 58: one amount ("around ₹X per reel") + the ✅ / ⚠️ check of the creator's own reel rate.
      // The reply never shows how the amount is worked out.
      const [{ profile }, ins] = await Promise.all([T.loadMe(), T.loadInsights()]);
      const mine = (ins?.niches || []).find((n) => nicheGroupsOfMe(profile).includes(n.niche));
      const r = rateAdvice(profile, mine || null);
      const fair = fairQuote(r.reach);
      const own = myRates(profile).reel;
      const check = own ? quoteCheck(r.reach, own) : null;
      const reply = fair
        ? say(lang, `For your ~${shortNum(r.reach)} average reach, a fair reel rate is around ${inr(fair)}.`, `Aapki ~${shortNum(r.reach)} average reach ke liye reel ka sahi rate lagbhag ${inr(fair)} hai.`)
        : say(lang, "Add your average reach in your profile and I'll tell you a fair rate.", "Profile mein average reach daalo, phir main sahi rate bataungi.");
      return { reply, card: { type: "rate", rate: r, fair, own, check: check ? { level: check.level, message: check.level === "warn" ? `⚠️ Your reel rate ${inr(own)} is above that — you can keep it, brands may negotiate.` : check.message } : null }, state: st };
    }

    case "invites": {
      const items = await T.loadInvites();
      if (!items.length) return { reply: say(lang, "No brand invitations waiting right now. Want me to find campaigns you can apply to?", "Abhi koi brand invitation nahi hai. Campaigns dhundu jin pe apply kar sako?"), card: { type: "chips", send: "value", chips: [{ label: "Find campaigns", value: "Show campaigns for me" }] }, state: st };
      return { reply: say(lang, items.length > 1 ? `${items.length} brands invited you:` : `${items[0].brand_name || "A brand"} invited you:`, items.length > 1 ? `${items.length} brands ne invite kiya hai:` : `${items[0].brand_name || "Ek brand"} ne invite kiya hai:`), card: { type: "invites", items: items.slice(0, 5) }, state: st };
    }

    case "profile": {
      const { profile, kyc, hasPayout: hp, payoutUnknown, money } = await T.loadMe(true);
      const hasPayout = hp || Boolean(payoutUnknown); // v332
      const ps = profileScore(profile, { kyc, hasPayout, money }); // v328
      return { reply: ps.score >= 90 ? say(lang, `Your profile is ${ps.score}% — looking strong!`, `Aapki profile ${ps.score}% hai — badhiya!`) : say(lang, `Your profile is ${ps.score}%. Fix these and brands will find you more:`, `Aapki profile ${ps.score}% hai. Ye theek karo, brands zyada dhundhenge:`), card: { type: "profile", score: ps }, state: st };
    }

    case "bio":
    case "portfolio": {
      const { profile } = await T.loadMe();
      const context = { name: profile?.name, niche: nichesOfMe(profile).slice(0, 3), city: profile?.city, followers: followersOfMe(profile), reach: reachOfMe(profile), bio: String(profile?.bio || "").slice(0, 300), past_brands: (profile?.past_brands || []).slice?.(0, 5) };
      const ai = await T.askAi(hit.intent === "bio" ? "creator_bio" : "creator_portfolio", text, { history, context });
      const fallback = hit.intent === "bio"
        ? `${profile?.name || "Creator"} · ${nicheGroupsOfMe(profile)[0] || "lifestyle"} creator${profile?.city ? ` from ${profile.city}` : ""}. I make honest, relatable reels that people actually watch${followersOfMe(profile) ? ` — ${shortNum(followersOfMe(profile))} followers` : ""}. Open for brand collabs & UGC.`
        : "Title: [what you made, e.g. \"Serum review reel\"]\nBrand: [brand name]\nResult: [views / likes / reach]\nWhat I did: [1 line — idea, shoot, edit]";
      return { reply: hit.intent === "bio" ? say(lang, "A bio for your profile — copy it, or ask me to change the tone:", "Aapki profile ke liye bio — copy karo, ya tone badalwa lo:") : say(lang, "How to write each portfolio piece (fill the brackets):", "Har portfolio piece aise likho (brackets bharo):"), card: { type: "copy", text: ai?.text || fallback, section: hit.intent === "bio" ? "profile" : "portfolio" }, state: st };
    }

    case "script":
      return writeScript(text, st, lang, history);

    case "brief":
    case "checklist": {
      const work = await T.loadWork();
      const active = (work.orders || []).find((o) => /IN_PROGRESS|CLAIMED|REVISION|ACTIVE|ACCEPTED/i.test(String(o.stage || o.status)));
      const b = active?.brief || null;
      if (!b) return { reply: say(lang, "Paste the brief here and I'll explain it simply.", "Brief yahan paste karo, simple bhasha mein samjha dungi."), state: { ...st, awaiting: "briefText" } };
      return { reply: say(lang, `"${b.title || "Your brief"}" in simple words:`, `"${b.title || "Aapka brief"}" simple bhasha mein:`), card: { type: "brief", brief: explainBrief(b), checklist: draftChecklist(b) }, state: st };
    }

    case "due": {
      const work = await T.loadWork(true);
      const items = dueItems({ orders: work.orders, applications: work.applications });
      if (!items.length) return { reply: say(lang, "Nothing pending right now. Want me to find new work?", "Abhi kuch pending nahi hai. Naya kaam dhundu?"), card: { type: "chips", send: "value", chips: [{ label: "Find campaigns", value: "Show campaigns for me" }] }, state: st };
      return { reply: say(lang, "Here's what's due:", "Ye baaki hai:"), card: { type: "due", items }, state: st };
    }

    case "earnings": {
      const { txns, failed } = await T.loadMoney();
      if (failed) return { reply: say(lang, "I couldn't check your earnings just now — your money is safe. Ask me again in a minute, or open Earnings.", "Abhi aapki earnings check nahi ho payi — paise safe hain. Ek minute baad phir poochho, ya Earnings kholo."), card: { type: "chips", send: "value", chips: [{ label: "Try again", value: "Show my earnings" }] }, state: st }; // v332
      const s = earningsSummary(txns); // v328: deals = paid / approved only, so also show the card when payouts are still coming
      return { reply: s.deals || s.pendingCount ? say(lang, "Your earnings on Ybex:", "Ybex pe aapki kamai:") : say(lang, "No paid work yet — let's find your first campaign!", "Abhi tak koi paid kaam nahi — chalo pehla campaign dhundte hain!"), card: { type: "earnings", s }, state: st };
    }

    case "kyc": {
      const [{ kyc, hasPayout, kycRaw, payoutUnknown }, money] = await Promise.all([T.loadMe(true), T.loadMoney()]);
      if (payoutUnknown || money.failed) return { reply: say(lang, "I couldn't check your payout details just now — nothing has changed with your money. Ask me again in a minute.", "Abhi payout details check nahi ho payi — paise mein kuch nahi badla. Ek minute baad phir poochho."), card: { type: "chips", send: "value", chips: [{ label: "Try again", value: "Check my payout" }] }, state: st }; // v332
      const s = earningsSummary(money.txns);
      const steps = [];
      if (!/approved|verified/.test(kyc)) steps.push({ text: kyc && /pending|review|submitted/.test(kyc) ? "KYC is under review — the team checks it within 24–48 hours." : kyc && /reject|declin/.test(kyc) ? `KYC was rejected${kycRaw?.rejection_reason ? `: ${kycRaw.rejection_reason}` : ""} — please submit again.` : "KYC isn't done — payouts need PAN + bank / UPI.", link: "/settings?section=kyc&from=eva", cta: "Open KYC" }); // v329: &from=eva → back to Eva
      if (!hasPayout) steps.push({ text: "No bank account / UPI added for payouts.", link: "/settings?section=kyc&from=eva", cta: "Add" }); // v329
      if (s.approvedCount) steps.push({ text: `${inr(s.approved)} is approved — the payout to your bank comes next.`, link: "/earnings", cta: "Earnings" }); // v328
      if (s.pendingCount) steps.push({ text: `${inr(s.pending)} is waiting: money is released after the brand approves your work (and the live link for collab reels).`, link: "/earnings", cta: "Earnings" });
      if (!steps.length) steps.push({ text: "Everything looks fine — KYC verified and payout account added. Payouts go out after the brand approves.", link: "/earnings", cta: "Earnings" });
      return { reply: say(lang, "Your payout check:", "Aapka payout check:"), card: { type: "steps", items: steps }, state: st };
    }

    case "growth": {
      const { profile } = await T.loadMe();
      const g = growthIdeas(profile, T.weekNo());
      const ai = await T.askAi("creator_growth", text, { history, context: { niche: g.niche, followers: followersOfMe(profile), reach: reachOfMe(profile) } });
      return { reply: say(lang, `This week's ideas for a ${g.niche.toLowerCase()} creator:`, `${g.niche} creator ke liye is hafte ke ideas:`), card: { type: "ideas", ideas: Array.isArray(ai?.ideas) && ai.ideas.length ? ai.ideas.slice(0, 5) : g.ideas, tips: g.tips }, state: st };
    }

    case "refer": {
      const { user } = await T.loadMe();
      return { reply: say(lang, "Invite a creator friend — when they join with your code you both benefit:", "Dost creator ko bulao — aapke code se join kare to dono ko fayda:"), card: { type: "refer", user }, state: st };
    }

    case "share": {
      const [{ profile }, money] = await Promise.all([T.loadMe(), T.loadMoney()]);
      const s = earningsSummary(money.txns);
      return { reply: say(lang, "Your share card — post it on your story:", "Aapka share card — story pe daalo:"), card: { type: "share", name: profile?.name || "Creator", deals: s.deals, niche: nicheGroupsOfMe(profile)[0] || "" }, state: st };
    }

    case "handoff": {
      const summary = history.filter((h) => h.user).slice(-5).map((h) => `• ${String(h.text).slice(0, 120)}`).join("\n");
      return { reply: say(lang, "The Ybex team can help on WhatsApp — your chat summary goes with it:", "Ybex team WhatsApp pe madad karegi — chat ka summary saath jayega:"), card: { type: "handoff", number: WA_NUMBER, text: `Hi YBEX Team, I am ${name || "a creator"} on Ybex. I need help with:\n${summary || text}` }, state: st };
    }

    default:
      return null;
  }
}

async function writeScript(text, st, lang, history) {
  // Session 58 (Eva settings): "Deals & offers" switched off → Eva doesn't read the creator's orders for context.
  const work = readEvaSettings().deals ? await T.loadWork() : { orders: [] };
  const active = (work.orders || []).find((o) => /IN_PROGRESS|CLAIMED|REVISION|ACTIVE|ACCEPTED/i.test(String(o.stage || o.status)));
  const ctx = active?.brief ? { product: active.brief.product_name || active.brief.title, requirements: String(active.brief.detailed_requirements || "").slice(0, 600), duration: active.brief.video_duration } : null;
  // v333 (Ravi: "Mere liye script likho" got a refusal in a Copy box): a request with no product / topic asks
  // for one first; only real words count, not "mere liye / for me / write / please".
  const GENERIC = /^(a|an|the|me|my|for|mere|mera|meri|liye|ke|ka|ki|ek|please|pls|plz|can|you|u|write|likho|likh|do|de|dena|bana|banao|make|create|give|ek|script|scripts|scrip|skript|hook|hooks|caption|captions|reel|reels|video|ugc|short|30|60|second|seconds|sec|s|aur|and|with|bhi)$/i;
  const topicWords = text.trim().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !GENERIC.test(w));
  const hasProduct = topicWords.length > 0 || ctx;
  if (!hasProduct) return { reply: say(lang, "Sure! Which product or brand is it for? Tell me in a line (or paste the brief).", "Zaroor! Kis product / brand ke liye? Ek line mein batao (ya brief paste karo)."), state: { ...st, awaiting: "scriptProduct" } };
  const ai = await T.askAi("creator_write", ctx ? `${text}\n\nBrief: ${JSON.stringify(ctx)}` : text, { history }); // v333: creator's own task
  const product = ctx?.product || "the product";
  const fallback = `HOOKS\n1. "I didn't expect ${product} to do this…"\n2. "Stop scrolling if you've ever had this problem."\n3. "3 reasons I'm keeping ${product} in my routine."\n\nSCRIPT (30s)\n0–3s: Hook + show ${product} close up\n3–15s: The problem → how you use it (show, don't tell)\n15–25s: The result / your honest take\n25–30s: "Try it — link in bio" + product shot\n\nCAPTION\nHonest review of ${product} ✨ Would you try it? #ad #review #reels`;
  // v333: the AI sometimes answered "I don't write scripts" — that is never shown as the script.
  const aiText = String(ai?.text || "").trim();
  const refused = /\b(nahi likh(ti|ta|te)|can(no|')t write|cannot write|i don'?t write|not able to write|unable to write|sirf ybex)\b/i.test(aiText);
  return { reply: say(lang, "Here you go — 3 hooks, a 30-second script and a caption:", "Ye lo — 3 hooks, 30 second script aur caption:"), card: { type: "copy", text: aiText && !refused ? aiText : fallback, title: "Script" }, state: st };
}
