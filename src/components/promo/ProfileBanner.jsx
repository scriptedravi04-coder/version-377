import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { safeStorage } from "../../utils/storage";

// v290 (Ravi, Swish-style): admin-uploaded strip under the photo on My Profile (creator + brand).
// 1080 × 200 poster, whole strip tappable. No banner live → nothing, not even empty space.
//
// Session 48 (Ravi: "the invite banner pops in a few ms after the profile opens — it should already be
// there"): the banner is fetched and its picture downloaded in the background as soon as the person is
// logged in (prefetchProfileBanner, called from the app shell), and the last answer is remembered on
// the phone. The profile page then draws it on the very first frame and only refreshes it quietly.
const KEY = "ybex_profile_banner";
let mem; // undefined = not asked yet · null = none live · object = banner
let inflight = null;
// v344: the banner is per role, so the cache is keyed by role + user id — another account on the same
// phone must not see the previous account's banner. A new key resets the in-memory cache.
let memKey = null;
const whoKey = () => {
  try { const u = JSON.parse(safeStorage.getItem("ybex_user") || "null"); return u ? `${u.role || ""}:${u.user_id || u.id || ""}` : "anon"; } catch { return "anon"; }
};
const storeKey = () => {
  const k = whoKey();
  if (k !== memKey) { memKey = k; mem = undefined; inflight = null; }
  return `${KEY}:${k}`;
};
const readStore = () => { try { const v = localStorage.getItem(storeKey()); return v ? JSON.parse(v) : undefined; } catch { return undefined; } };
const writeStore = (v) => { try { const k = storeKey(); if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* private mode */ } };
const warm = (url) => { try { if (url) { const im = new Image(); im.src = url; } } catch { /* no window */ } };

/** Current best guess, available synchronously (memory first, then what the phone remembered). */
export function cachedProfileBanner() {
  storeKey(); // v344: drop the other account's in-memory banner
  if (mem === undefined) { const s = readStore(); if (s !== undefined) { mem = s; warm(s?.image_url); } }
  return mem || null;
}

/** Ask the server for the live banner and download its picture. Safe to call many times. */
export function prefetchProfileBanner() {
  const askedFor = storeKey(); // v344: resets mem/inflight when the account changed
  if (inflight) return inflight;
  inflight = api.get("promos/banner", { bypassCache: true })
    .then((r) => {
      const x = r.data?.banner || null;
      if (storeKey() !== askedFor) return null; // v344: account switched mid-request
      if (!x) { mem = null; writeStore(null); return null; }
      return new Promise((res) => {
        const im = new Image();
        im.onload = () => { mem = x; writeStore(x); res(x); };
        im.onerror = () => res(mem || null);
        im.src = x.image_url;
      });
    })
    .catch(() => mem || null)
    .finally(() => { setTimeout(() => { inflight = null; }, 15000); });
  return inflight;
}

export default function ProfileBanner({ style }) {
  const navigate = useNavigate();
  const [b, setB] = useState(() => cachedProfileBanner());
  useEffect(() => {
    let off = false;
    prefetchProfileBanner().then((x) => {
      if (off) return;
      setB((cur) => (cur?.id === x?.id && cur?.image_url === x?.image_url ? cur : x));
    });
    return () => { off = true; };
  }, []);
  useEffect(() => { if (b?.id) api.post(`promos/${b.id}/event`, { type: "view" }).catch(() => {}); }, [b?.id]);
  if (!b) return null;
  const tap = () => {
    api.post(`promos/${b.id}/event`, { type: "click" }).catch(() => {});
    const l = String(b.link_url || "");
    if (!l) return;
    if (l.startsWith("/")) navigate(l); else window.open(l, "_blank", "noopener");
  };
  return (
    <button type="button" onClick={tap} data-testid="profile-banner" aria-label={b.title || b.name || "Open offer"} /* v332: says what it is */
      style={{ display: "block", width: "100%", padding: 0, border: "none", background: "transparent", cursor: b.link_url ? "pointer" : "default", ...style }}>
      <img src={b.image_url} alt="" decoding="sync" loading="eager" style={{ display: "block", width: "100%", aspectRatio: "1080 / 200", objectFit: "cover", borderRadius: 16 }} />
    </button>
  );
}
