import React, { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import useIsMobile from "../../hooks/useIsMobile";
import { isPublicPage } from "../../lib/inAppPage";

// Session 58 (Eva handoff §8d): Ybex Eva on DESKTOP. Below 768px the phone screens keep their own Eva
// (CreatorHomeMobile / BrandHomeMobile). From 768px Eva peeks at the bottom-right of every brand / creator
// page and opens as a docked glass panel (≥1100px) or a full-height drawer (768–1099px). Same Eva, same
// flows and rules. Loaded only when needed.
const FeedbackBot = lazy(() => import("./FeedbackBot"));

const HIDE_ON = [/^\/chat/, /\/inbox/, /^\/onboarding/, /^\/login/, /^\/signup/, /^\/verify-email/, /kyc$/, /^\/brand\/campaigns\/create/, /^\/brand\/ugc\/post/, /^\/admin/];

export function desktopEvaVisible(pathname, user) {
  if (!user || (user.role !== "brand" && user.role !== "creator")) return false;
  if (!(user.onboarded || user.onboarding_completed || user.onboarding_complete)) return false;
  if (isPublicPage(pathname)) return false; // v348: never on the landing / login / legal / share pages
  return !HIDE_ON.some((rx) => rx.test(String(pathname || "")));
}

export default function DesktopEva() {
  const isMobile = useIsMobile(768);
  const { user } = useAuth() || {};
  const { pathname } = useLocation();
  if (isMobile || !desktopEvaVisible(pathname, user)) return null;
  return (
    <Suspense fallback={null}>
      <FeedbackBot role={user.role} screen={`desktop ${pathname}`} desktop />
    </Suspense>
  );
}
