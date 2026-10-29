// v349 (Ravi): "Explore Creators se kisi creator ko hatana ho to sirf delete ya ban hai — sirf hide ka option do."
// Admin → Users → creator → "Hide from Explore & Meet the Creators" (on = hidden, creator_profiles.hidden_from_explore).
// Hidden ≠ banned: the creator's profile link, deals and chats keep working. Saved by
// POST /admin/creators/:userId/explore-hide (backend/creatorHomePicks.ts).
import React, { useState } from "react";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import ButtonSpinner from "../common/ButtonSpinner";
import SocialLogo from "../common/SocialLogo"; // v364: real platform logos

const calmError = (err, fallback) => {
  const m = err?.response?.data?.error || err?.response?.data?.detail;
  return typeof m === "string" && m && m.length < 160 ? m : fallback;
};

export default function ExploreHideControl({ userId, initialHidden = false, onSaved }) {
  const [local, setLocal] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const hidden = local !== undefined ? local : Boolean(initialHidden);

  const toggle = async () => {
    if (busy || !userId) return;
    const next = !hidden;
    setBusy(true);
    try {
      await api.post(`admin/creators/${userId}/explore-hide`, { hidden: next });
      setLocal(next);
      toast.success(next ? "Hidden from Explore & Meet the Creators" : "Shown on Explore & Meet the Creators again");
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(calmError(e, "Couldn't save. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="admin-explore-hide">
      <p className="text-[11px] text-gray-500 font-medium sm:max-w-md" data-testid="admin-explore-hide-help">
        {hidden
          ? "Hidden: brands and visitors don't see this creator on Explore, Meet the Creators, top creators or the landing page. Their profile link, deals and chats still work."
          : "Removes this creator from the lists brands and visitors browse (Explore, Meet the Creators, top creators, landing page) — without banning or deleting the account."}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={hidden}
        onClick={toggle}
        disabled={busy}
        data-testid="admin-explore-hide-toggle"
        className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 border ${
          hidden ? "bg-gray-800 text-white border-gray-800 shadow-sm hover:bg-gray-900" : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
        }`}
        title="Hide from Explore Creators and Meet the Creators (not a ban)"
      >
        {busy ? <ButtonSpinner /> : <EyeOff size={15} />}
        <span>{hidden ? "Hidden from Explore — Unhide" : "Hide from Explore & Meet the Creators"}</span>
      </button>
    </div>
  );
}


// v349: Admin → Users → creator → "Refresh from Instagram" (backend/instagramConnect.ts). Live numbers via Meta's API.
export function InstagramRefreshControl({ userId, profile, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  const p = profile || {};
  const shown = stats || (p.instagram_stats && !p.instagram_stats.error ? p.instagram_stats : null);
  const refresh = async () => {
    if (busy || !userId) return;
    setBusy(true);
    try {
      const { data } = await api.post(`admin/creators/${userId}/instagram-refresh`, {});
      setStats(data?.stats || null);
      toast.success("Updated from Instagram");
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(calmError(e, "Couldn't refresh from Instagram."));
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="admin-ig-refresh">
      <p className="text-[11px] text-gray-500 font-medium">
        {shown ? `Instagram @${shown.username}: ${Number(shown.followers || 0).toLocaleString("en-IN")} followers · avg views ${Number(shown.avg_views || shown.reach_28d || 0).toLocaleString("en-IN")} · ER ${shown.engagement_rate ?? "—"}%` : "Instagram numbers are typed by the creator (not synced yet)."}
        {p.instagram_verified_at ? ` · Verified (${p.instagram_verify_method === "oauth" ? "Instagram login" : "DM code"})` : ""}
      </p>
      <button type="button" onClick={refresh} disabled={busy} className="shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 disabled:opacity-50">
        {busy ? <ButtonSpinner /> : <SocialLogo platform="instagram" size={15} />}<span>Refresh from Instagram</span>
      </button>
    </div>
  );
}
