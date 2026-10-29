import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Instagram } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import useBusy from "../../lib/useBusy";
import ButtonSpinner from "../../components/common/ButtonSpinner";
import { afterSignupPath, rememberSignupIg } from "../../lib/afterSignup";
import { saveProgress } from "../../lib/onboardingProgress";

// v376 (Ravi: "Google ke baad sirf Instagram username + WhatsApp number maango, phir seedha dashboard"): the one
// screen a new creator sees after Continue with Google / Apple. Saves both (POST /auth/quick-profile), starts the
// Instagram fetch (followers / reach, like the waitlist), then Home — or the challenge page for offer visitors.
// Ravi: both are required ("username aur WhatsApp zaroor poocho") — no skip.
const IG_RE = /^[a-z0-9._]{1,30}$/;
const cleanIg = (v) => String(v || "").trim().replace(/^.*instagram\.com\//i, "").replace(/^@+/, "").replace(/[/?#\s].*$/, "").toLowerCase();
const mobile10 = (v) => { let d = String(v || "").replace(/\D/g, ""); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return d; };

export default function AppQuickDetails() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth() || {};
  const { isBusy, anyBusy, run } = useBusy();
  const [ig, setIg] = useState("");
  const [wa, setWa] = useState("");
  const [error, setError] = useState("");
  const next = (() => { try { return new URLSearchParams(window.location.search).get("next") || ""; } catch { return ""; } })();
  const igClean = cleanIg(ig);
  const wa10 = mobile10(wa);
  const ok = IG_RE.test(igClean) && /^[6-9]\d{9}$/.test(wa10);
  const go = (u) => navigate(afterSignupPath(u || user, next, { justCreated: true }), { replace: true });

  const save = () => run("save", async () => {
    setError("");
    try {
      const { data } = await api.post("auth/quick-profile", { instagram: igClean, whatsapp: wa10 });
      rememberSignupIg(igClean);
      saveProgress({ flow: "creator_mobile", page: "identity", pos: null, answers: { instagramHandle: igClean }, basicsDone: false }).catch(() => {});
      Promise.resolve().then(() => api.post("creator/instagram/lookup", { username: igClean })).catch(() => {});
      const u = { ...(user || {}), phone: data?.phone || user?.phone };
      try { setUser?.(u); } catch { /* fine */ }
      go(u);
    } catch (e) {
      setError(e?.response?.data?.detail || "Couldn't save. Please try again.");
    }
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F2F2F7] text-[#0A0A0A] px-6" style={{ fontFamily: "'DM Sans', sans-serif", paddingTop: 24, paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }} data-testid="app-quick-details">
      <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">One last step</h1>
      <p className="mt-2 text-[15px] text-[#6B7280]">Brands find you by Instagram and reach you on WhatsApp.</p>
      <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); if (ok) save(); }}>
        <div className="flex items-center h-[56px] rounded-2xl bg-white border border-[#E5E2EE] focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-[#7C3AED]/10">
          <span className="pl-4 pr-1 text-[#C13584]"><Instagram size={18} /></span>
          <span className="pl-1 text-[17px] text-[#6B7280]">@</span>
          <input value={ig} onChange={(e) => setIg(e.target.value.replace(/\s/g, "").slice(0, 60))} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="Instagram username" aria-label="Instagram username" className="flex-1 h-full bg-transparent pr-4 text-[17px] outline-none" data-testid="details-ig" />
        </div>
        <div className="flex items-center h-[56px] rounded-2xl bg-white border border-[#E5E2EE] focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-[#7C3AED]/10">
          <span className="pl-4 pr-2 text-[17px] text-[#6B7280]">+91</span>
          <input value={wa} onChange={(e) => setWa(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))} inputMode="numeric" autoComplete="tel-national"
            placeholder="WhatsApp number" aria-label="WhatsApp number" className="flex-1 h-full bg-transparent pr-4 text-[17px] outline-none" data-testid="details-whatsapp" />
        </div>
        {error && <p className="text-[13px] text-[#DC2626]" role="alert">{error}</p>}
        <button type="submit" disabled={!ok || anyBusy} data-testid="details-save"
          className="w-full h-[54px] rounded-2xl bg-[#7C3AED] text-white text-[16px] font-semibold disabled:bg-[#E9E5F5] disabled:text-[#A39DB8] flex items-center justify-center">
          {isBusy("save") ? <ButtonSpinner /> : "Continue"}
        </button>
      </form>
    </div>
  );
}
