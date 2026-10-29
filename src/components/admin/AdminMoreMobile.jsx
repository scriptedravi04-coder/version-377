import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, ListChecks, Megaphone, Lightbulb, MessageSquare, AlertTriangle, Film, Activity, BookOpen, Bell, Settings, HelpCircle, Users, ShieldCheck, Wallet, LayoutGrid, Trophy } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

// Session 43 (Ravi: "admin can't be used on a phone — no logout, no Platform Settings"): the admin's
// fifth bottom tab is "More" — every admin section in one list, and Logout at the end.
const SECTIONS = [
  { tab: "dashboard", label: "Overview", icon: LayoutGrid },
  { tab: "users", label: "Users", icon: Users },
  { tab: "waitlist", label: "Waitlist", icon: ListChecks },
  { tab: "verifications", label: "KYC checks", icon: ShieldCheck },
  { tab: "campaigns", label: "Campaigns", icon: Megaphone },
  { tab: "pitches", label: "Pitch leads", icon: Lightbulb },
  { tab: "challenge", label: "Challenge entries", icon: Trophy }, // v367
  { tab: "chat", label: "Chat moderation", icon: MessageSquare },
  { tab: "reports", label: "System reports", icon: AlertTriangle },
  { tab: "escrow", label: "Payments & escrow", icon: Wallet },
  { tab: "ugc-orders", label: "UGC orders", icon: Film },
  { tab: "activity-logs", label: "Activity logs", icon: Activity }, // v330: typo ("Active logs")
  { tab: "blog", label: "Blogs & content", icon: BookOpen },
  { tab: "push", label: "Push notifications", icon: Bell },
  { tab: "helpdesk", label: "Help desk", icon: HelpCircle },
  { tab: "feedback", label: "Chatbot (Ybex Eva)", icon: HelpCircle },
  { tab: "settings", label: "Platform settings", icon: Settings },
];

export default function AdminMoreMobile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth() || {};
  const [leaving, setLeaving] = useState(false); // v332: no double-tap on Log out
  return (
    <div className="px-4 pt-4 pb-28" style={{ fontFamily: "'DM Sans', sans-serif" }} data-testid="admin-more">
      <div className="text-[22px] font-bold tracking-tight">More</div>
      {user?.email && <div className="text-[13px] text-[#6B7280] mt-0.5 truncate">{user.email}</div>}
      <div className="mt-4 bg-white rounded-2xl border border-[#ECECF0] divide-y divide-[#F1F1F4] overflow-hidden">
        {SECTIONS.map(({ tab, label, icon: Icon }) => (
          <button key={tab} type="button" onClick={() => navigate(`/admin?tab=${tab}`)}
            className="w-full flex items-center gap-3 px-4 h-[52px] text-left active:bg-[#F7F7FA]">
            <Icon size={18} className="text-[#7C3AED] shrink-0" />
            <span className="flex-1 text-[15px] font-medium text-[#111]">{label}</span>
            <ChevronRight size={16} className="text-[#A1A1AA]" />
          </button>
        ))}
      </div>
      <button type="button" disabled={leaving} onClick={async () => { if (leaving) return; setLeaving(true); try { await logout?.(); } finally { navigate("/ybx-admin", { replace: true }); } }}
        className="disabled:opacity-60 mt-4 w-full h-[52px] rounded-2xl bg-white border border-[#FDE2E2] text-[#DC2626] font-semibold text-[15px] flex items-center justify-center gap-2"
        data-testid="admin-more-logout">
        <LogOut size={18} /> {leaving ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}
