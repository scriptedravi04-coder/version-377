import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { safeStorage } from "../../utils/storage";
import { postLoginPath, afterLoginPath } from "../auth/Login";
import ButtonSpinner from "../../components/common/ButtonSpinner";
import { afterSignupPath, trackRegistration, isNewAccount } from "../../lib/afterSignup"; // v376

// v286: where Google / Apple send the person back (backend/oauth_routes.ts → /app/oauth#token=…).
// Saves the session token, makes sure the account has the role they tapped, then opens the app.
const ERRORS = {
  no_email: "We didn't get an email address from that account. Please use your email instead.",
  banned: "This account has been banned. Please contact support.",
  deleted: "This account was deleted. Write to support to recover it.",
  admin: "This email belongs to a Ybex admin account. It can't be used as a Brand or Creator.",
  cancelled: "Sign-in was cancelled.",
};

export function readOAuthHash(hash) {
  const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return { token: p.get("token") || "", role: p.get("role") || "", error: p.get("error") || "", handoff: p.get("handoff") === "1" };
}

export default function AppOAuthDone() {
  const navigate = useNavigate();
  const { setUser } = useAuth() || {};
  const [error, setError] = useState("");
  const [done, setDone] = useState(false); // v378: sign-in finished in the iPhone sheet → "go back to the app"

  useEffect(() => {
    const parsed = readOAuthHash(window.location.hash);
    const { token, error: err } = parsed;
    // Session 58 (Q17): the web Google flow (popup blocked / link back cut) remembers the tapped role and ?next here.
    let savedRole = "", savedNext = "";
    try { savedRole = window.sessionStorage.getItem("ybex_oauth_role") || ""; savedNext = window.sessionStorage.getItem("ybex_oauth_next") || ""; window.sessionStorage.removeItem("ybex_oauth_role"); window.sessionStorage.removeItem("ybex_oauth_next"); } catch { /* private mode */ }
    const role = parsed.role || savedRole;
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* keep going */ } // token out of the address bar
    if (err || !token) { setError(ERRORS[err] || "Sign-in didn't finish. Please try again or use your email."); return; }
    // v378: started from the iPhone Home Screen app — this is the separate browser sheet. The app signs itself in
    // (lib/oauthHandoff.js); here we only tell the person to go back to it, instead of running the website in the sheet.
    if (parsed.handoff && !(typeof navigator !== "undefined" && navigator.standalone === true)) { setDone(true); return; }
    (async () => {
      try {
        safeStorage.setItem("ybex_token", token);
        let { data } = await api.get("auth/me", { bypassCache: true });
        let u = data?.user || data;
        if (u && !u.role && (role === "creator" || role === "brand")) {
          try { await api.post("auth/role", { role }); const again = await api.get("auth/me", { bypassCache: true }); u = again.data?.user || again.data; } catch { /* onboarding asks */ }
        }
        safeStorage.setItem("ybex_user", JSON.stringify(u));
        try { if (u?.email) window.localStorage.setItem("ybex_last_email", String(u.email).toLowerCase()); } catch { /* private mode */ }
        setUser?.(u);
        // Session 58 (Q17): this was a web popup Google cut loose — the original tab takes over, so close it.
        if (window.name === "GoogleAuth") { try { window.close(); } catch { /* not allowed */ } }
        trackRegistration(u, "google"); // v376: new Google / Apple account → Meta CompleteRegistration (once)
        // v376: a NEW creator gives Instagram + WhatsApp on one screen, then Home (or the challenge page)
        if (String(u?.role || "") === "creator" && isNewAccount(u) && !String(u?.phone || "").replace(/\D/g, "")) {
          const nextQ = savedNext ? `?next=${encodeURIComponent(savedNext)}` : "";
          navigate("/app/details" + nextQ, { replace: true });
          return;
        }
        // v376: creators skip onboarding; a new creator from the offer page goes back to it
        navigate(afterSignupPath(u, savedNext), { replace: true });
      } catch {
        setError("Sign-in didn't finish. Please try again or use your email.");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[100dvh] bg-[#F2F1F7] flex flex-col items-center justify-center px-6 text-center" style={{ fontFamily: "'DM Sans', sans-serif" }} data-testid="app-oauth-done">
      {done ? (
        <>
          <div className="text-[44px]">✅</div>
          <p className="mt-3 text-[18px] text-[#0A0A0A] font-bold" data-testid="oauth-handoff-done">You're signed in</p>
          <p className="mt-1 text-[14px] text-[#6B7280] max-w-xs">Close this window (✕ at the top) to go back to the Ybex app.</p>
        </>
      ) : error ? (
        <>
          <p className="text-[16px] text-[#0A0A0A] font-semibold max-w-xs">{error}</p>
          <button type="button" onClick={() => navigate("/app", { replace: true })} className="mt-6 h-[50px] px-6 rounded-2xl bg-[#7C3AED] text-white font-semibold">Back to login</button>
        </>
      ) : (
        <><ButtonSpinner /><p className="mt-3 text-[14px] text-[#6B7280]">Signing you in…</p></>
      )}
    </div>
  );
}
