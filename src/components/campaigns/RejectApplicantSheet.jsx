import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// v333 (Ravi: "hn vo bhi kro"): rejecting an applicant used the browser's grey prompt box. This is the app's own
// sheet — a bottom sheet on phones, a centred card on desktop. The reason still goes with the same API call and,
// as before, the creator sees the brand's reason.
export const REJECT_REASONS = ["Budget didn't match", "Not the right niche", "Reach is too low", "All slots are filled", "Other"];

export default function RejectApplicantSheet({ applicant, onCancel, onConfirm }) {
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPick(""); setNote(""); setBusy(false); }, [applicant]);
  useEffect(() => {
    if (!applicant) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applicant, busy, onCancel]);
  if (!applicant || typeof document === "undefined") return null;

  const name = applicant.full_name || applicant.creator_name || applicant.name || "this creator";
  const photo = applicant.profile_photo_url || applicant.photo || "";
  const reason = pick === "Other" ? note.trim() : [pick, note.trim()].filter(Boolean).join(" — ");
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm?.(reason); } finally { setBusy(false); }
  };

  return createPortal(
    <div role="presentation" onClick={() => { if (!busy) onCancel?.(); }}
      className="fixed inset-0 z-[1200] bg-slate-900/45 backdrop-blur-[2px] flex items-end md:items-center justify-center"
      style={{ animation: "ybFadeIn .2s ease both" }}>
      <style>{"@keyframes ybFadeIn{from{opacity:0}to{opacity:1}}@keyframes ybSheetUp{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}"}</style>
      <div role="dialog" aria-modal="true" aria-label={`Decline ${name}`} onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[440px] bg-white rounded-t-[26px] md:rounded-[24px] px-5 pt-3 md:pt-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)", animation: "ybSheetUp .28s cubic-bezier(.2,.8,.2,1) both", fontFamily: "'DM Sans', sans-serif" }}
        data-testid="reject-applicant-sheet">
        <div className="md:hidden w-10 h-[5px] rounded-full bg-[#E4E1EC] mx-auto mb-4" />
        <div className="flex items-center gap-3">
          {photo
            ? <img src={photo} alt="" className="w-11 h-11 rounded-full object-cover bg-[#F3F1F8]" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            : <div className="w-11 h-11 rounded-full bg-[#F5F0FF] text-[#7C3AED] flex items-center justify-center font-bold">{String(name).charAt(0).toUpperCase()}</div>}
          <div className="min-w-0">
            <div className="text-[16px] font-bold text-[#0F0B1F] truncate">Decline {name}?</div>
            <div className="text-[12.5px] text-[#6B7280]">They'll see your reason. You can't undo this.</div>
          </div>
        </div>
        <div className="mt-4 text-[11px] font-bold tracking-wider text-[#8E8A9A] uppercase">Reason</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setPick(pick === r ? "" : r)} aria-pressed={pick === r}
              className={`min-h-[40px] px-3.5 rounded-full border text-[13.5px] font-semibold transition-colors ${pick === r ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#E4E1EC] text-[#3F3A4E]"}`}>
              {r}
            </button>
          ))}
        </div>
        {(pick === "Other" || pick) && (
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={3}
            placeholder={pick === "Other" ? "Write your reason" : "Add a note (optional)"}
            className="mt-3 w-full rounded-[14px] border border-[#E4E1EC] p-3 text-[16px] outline-none focus:border-[#7C3AED] resize-none" />
        )}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCancel} disabled={busy}
            className="h-12 rounded-[14px] border border-[#E4E1EC] bg-white text-[#0F0B1F] font-semibold text-[14.5px] disabled:opacity-60">Cancel</button>
          <button type="button" onClick={go} disabled={busy || (pick === "Other" && !note.trim())} data-testid="reject-applicant-confirm"
            className="h-12 rounded-[14px] bg-[#DC2626] text-white font-bold text-[14.5px] disabled:opacity-60">{busy ? "Declining…" : "Decline"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
