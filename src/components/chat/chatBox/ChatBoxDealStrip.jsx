import React from "react";


// Session 49 (clean-up): moved out of ChatBox.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function ChatBoxDealStrip(props) {
  const { currentThread, flowState, getDealAmount, isAgreementSigned, isDealCompleted, isDealFixed, isEscrowFunded, rawStatus } = props;
  // v332: an unknown amount showed a made-up "₹3,000" — now the line simply leaves the amount out.
  const amt = Number(getDealAmount(currentThread)) || 0;
  const amtText = amt > 0 ? `₹${amt.toLocaleString('en-IN')} ` : "";
  return <>{(isAgreementSigned || rawStatus === 'ACTIVE' || flowState === 'ACTIVE' || isDealFixed) && (
        <div className={`w-full shrink-0 z-10 px-3.5 py-2 md:px-6 md:py-2.5 border-b flex items-center justify-between text-xs backdrop-blur-xs transition-colors ${
          isDealCompleted || isEscrowFunded
            ? "bg-emerald-50/95 dark:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-800/50"
            : "bg-amber-50/95 dark:bg-amber-950/50 border-amber-200/80 dark:border-amber-800/50"
        }`}>
          <div className={`flex items-center gap-2 font-semibold min-w-0 ${
            isDealCompleted || isEscrowFunded
              ? "text-emerald-800 dark:text-emerald-300"
              : "text-amber-800 dark:text-amber-300"
          }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              isDealCompleted || isEscrowFunded
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                : "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)] animate-pulse"
            }`} />
            <span className="truncate text-xs md:text-sm">
              {isDealCompleted
                ? `Deal completed · ${amtText}payment released`
                : isEscrowFunded
                  ? `Deal active · ${amt > 0 ? amtText : "payment "}held in a secure payment hold`
                  : "Deal active · Payment pending"
              }
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {isDealCompleted ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-300/50 dark:border-emerald-700/50">
                Completed
              </span>
            ) : isEscrowFunded ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-300/50 dark:border-emerald-700/50">
                Secure Payment Hold
              </span>
            ) : null}
          </div>
        </div>
      )}</>;
}
