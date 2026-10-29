// Session 58 (Ravi: "han kro") — where a signup came from (Instagram, Google, Meta ads, …).
// The browser remembers the first link a visitor arrived on (src/lib/signupSource.js). Right after any
// sign-in (email, Google or Apple) it sends that once to POST /auth/signup-source; the server saves it
// only for a NEW account (made in the last 2 days) that has no source yet — so it is written once and an
// old account can never be relabelled. Nothing in sign-up / login depends on this; a failure is ignored.
import express from "express";
import { logIgnored } from "./logIgnored";

const clip = (v: any, n = 80) => {
  const s = String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9 ._\-/:]/g, "").slice(0, n);
  return s || null;
};

const PAID = new Set(["cpc", "ppc", "paid", "paid_social", "paidsocial", "ads", "ad", "display", "sponsored"]);

/** Pure: one channel name from what the browser saw. */
export function channelFrom(input: { utm_source?: any; utm_medium?: any; referrer?: any; gclid?: any; fbclid?: any; app?: any }): string {
  const src = clip(input?.utm_source) || "";
  const med = clip(input?.utm_medium) || "";
  const ref = String(input?.referrer || "").toLowerCase();
  const paid = PAID.has(med) || !!input?.gclid;
  let host = "";
  if (ref.startsWith("android-app://")) return "android_app";
  try { host = ref ? new URL(ref).hostname.replace(/^www\.|^m\.|^l\./, "") : ""; } catch { host = ""; }
  const key = src || host;
  const pick = (k: string) => {
    if (/instagram|^ig$/.test(k)) return paid ? "meta_ads" : "instagram";
    if (/facebook|^fb$|^meta$/.test(k)) return paid ? "meta_ads" : "facebook";
    if (/google/.test(k)) return paid ? "google_ads" : "google";
    if (/youtube|youtu\.be/.test(k)) return "youtube";
    if (/linkedin|lnkd\.in/.test(k)) return "linkedin";
    if (/whatsapp|wa\.me/.test(k)) return "whatsapp";
    if (/twitter|^x$|t\.co|x\.com/.test(k)) return "x";
    if (/bing|yahoo|duckduckgo/.test(k)) return "other_search";
    return "";
  };
  const named = pick(key);
  if (named) return named;
  if (!key && input?.gclid) return "google_ads";
  if (!key && input?.fbclid) return "facebook";
  if (src) return paid ? `${src}_ads`.slice(0, 40) : src.slice(0, 40);
  if (host && !/ybex/.test(host)) return "other_website";
  if (input?.app) return "app";
  return "direct";
}

/** Pure: what to write on the user row. */
export function sourceRow(body: any) {
  const b = body && typeof body === "object" ? body : {};
  return {
    signup_source: channelFrom(b),
    utm_source: clip(b.utm_source),
    utm_medium: clip(b.utm_medium),
    utm_campaign: clip(b.utm_campaign, 120),
  };
}

export const NEW_ACCOUNT_MS = 2 * 24 * 60 * 60 * 1000;

export function setupSignupSourceRoutes(router: express.Router, { supabase, privilegedSupabase, parseAuthUser }: any) {
  router.post("/auth/signup-source", async (req: any, res: any) => {
    const user = await parseAuthUser(req);
    if (!user?.user_id) return res.status(401).json({ ok: false });
    const c = privilegedSupabase || supabase;
    if (!c) return res.json({ ok: false });
    try {
      const { data: row, error } = await c.from("users").select("user_id, created_at, signup_source").eq("user_id", user.user_id).maybeSingle();
      if (error || !row) return res.json({ ok: false });
      if (row.signup_source) return res.json({ ok: true, saved: false, reason: "already set" });
      const age = Date.now() - new Date(row.created_at || 0).getTime();
      if (!(age >= 0 && age <= NEW_ACCOUNT_MS)) return res.json({ ok: true, saved: false, reason: "not a new account" });
      const out = sourceRow(req.body);
      const { error: upErr } = await c.from("users").update(out).eq("user_id", user.user_id).is("signup_source", null);
      if (upErr) { logIgnored("signupSource:update", upErr); return res.json({ ok: false }); }
      return res.json({ ok: true, saved: true, signup_source: out.signup_source });
    } catch (e: any) {
      logIgnored("signupSource", e);
      return res.json({ ok: false });
    }
  });
}
