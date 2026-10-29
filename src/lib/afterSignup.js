// v376 (Ravi: "111 log signup page pe aaye, sirf 3 ne account banaya"): what happens right after someone signs
// up or logs in from the app's sign-in screens (email code, mobile + SMS code, Google, Apple).
//   - Creators never get stuck in onboarding: city, niche, rate card, KYC are filled later (Home shows
//     "Complete your profile"). Same per-device switch as "Finish later" (lib/onboardingLater.js).
//   - A NEW creator who came from the offer page (/offer, /challenge) lands straight on "Add your Diwali reel"
//     (v377: the portfolio add-reel screen with "Submit to Diwali Challenge" ON — not the dashboard).
//   - Meta Pixel CompleteRegistration fires once per new account (also from AuthContext as a fallback).
import { markFinishLater } from "./onboardingLater";
import { afterLoginPath } from "../pages/auth/Login";
import { isNewAccount, trackRegistration } from "./signupSource";
export { isNewAccount, trackRegistration };
export { rememberSignupIg, signupIg } from "./signupIg";

const OFFER_KEY = "ybex_from_offer";
/** v377: the "Add your Diwali reel" screen (portfolio add flow, challenge toggle ON). */
export const DIWALI_ADD_PATH = "/creator/settings?section=portfolio&add=1&diwali=1";
const OFFER_FOR_MS = 3 * 24 * 60 * 60 * 1000;

const ls = () => { try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; } };

/** The offer page was opened on this device (logged out). */
export function noteOfferVisit(now = Date.now()) {
  try { ls()?.setItem(OFFER_KEY, String(now)); } catch { /* private mode */ }
}
export function cameFromOffer(now = Date.now()) {
  try { const t = Number(ls()?.getItem(OFFER_KEY) || 0); return t > 0 && now - t < OFFER_FOR_MS; } catch { return false; }
}
export function clearOfferVisit() {
  try { ls()?.removeItem(OFFER_KEY); } catch { /* ignore */ }
}

/** Where to go after sign-in / sign-up. Pure apart from the two device switches above. */
export function afterSignupPath(user, nextParam = "", { justCreated = false } = {}) {
  const role = String(user?.role || "").toLowerCase();
  if (role === "creator") {
    markFinishLater(user.user_id || user.id);
    if ((justCreated || isNewAccount(user)) && cameFromOffer()) { clearOfferVisit(); return DIWALI_ADD_PATH; }
  }
  return afterLoginPath(user, nextParam);
}
