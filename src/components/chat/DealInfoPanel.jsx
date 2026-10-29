import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/common/Badge';

export default function DealInfoPanel({ thread, onClose, role }) {
  if (!thread) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 bottom-0 w-full md:w-80 bg-[var(--bg-card)] border-l border-[var(--border-default)] z-50 md:z-20 flex flex-col"
      >
        <div className="p-3 md:p-5 flex justify-between items-center border-b border-[var(--border-default)]">
          <h3 className={'text-sm md:text-base font-bold'}>Deal Information</h3>
          <button type="button" onClick={onClose} aria-label="Close deal information" /* v332 */ className="p-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-elevated)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 md:space-y-6">
          <div className="text-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl md:rounded-2xl p-4 md:p-5">
             <div className={`text-[10px] font-bold uppercase tracking-wider mb-2`}>Agreed Amount</div>
             <div className={`font-mono font-bold tracking-tight text-lg text-[var(--violet)]`}>
               {/* v332: "₹0" before an amount was agreed (and the fixed amount was ignored) */}
               {Number(thread.agreed_amount || thread.amount_fixed) > 0 ? `₹${Number(thread.agreed_amount || thread.amount_fixed).toLocaleString("en-IN")}` : "Not agreed yet"}
             </div>
             <div className="mt-3 inline-block">
               <Badge variant={thread.flow_state || thread.status || "review"}>{String(thread.flow_state || thread.status || "In review").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) /* v332: was the raw code ("CONTENT_SUBMITTED") */}</Badge>
             </div>
          </div>

          <div>
             <h4 className={`text-base font-bold mb-3`}>Timeline</h4>
             <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--border-strong)] before:to-transparent">
                {['NEGOTIATING', 'ACTIVE', 'CONTENT_SUBMITTED', 'APPROVED', 'COMPLETED'].map((step, idx) => {
                  // Session 58 (bug hunt): the server's real states (SUBMITTED, CONTENT_APPROVED, PROOF_SUBMITTED…) matched
                  // no step, so nothing was highlighted — map them onto the five steps.
                  const rawStage = (thread.flow_state || thread.status || 'NEGOTIATING').toUpperCase();
                  const STEP_OF = { SUBMITTED: 'CONTENT_SUBMITTED', IN_REVIEW: 'CONTENT_SUBMITTED', REVISION_REQUESTED: 'ACTIVE', REVISION_DECLINED: 'CONTENT_SUBMITTED', CONTENT_APPROVED: 'APPROVED', AWAITING_LIVE_LINK: 'APPROVED', PROOF_SUBMITTED: 'APPROVED', LIVE_LINK_SUBMITTED: 'APPROVED', LINKS_UNDER_REVIEW: 'APPROVED', AI_AGREEMENT_READY: 'NEGOTIATING', NEGOTIATING_COUNTER: 'NEGOTIATING', PAYMENT_PENDING: 'NEGOTIATING', IN_PROGRESS: 'ACTIVE', RELEASED: 'COMPLETED' };
                  const currentStage = STEP_OF[rawStage] || rawStage;
                  const isActive = currentStage === step;
                  const steps = ['NEGOTIATING', 'ACTIVE', 'CONTENT_SUBMITTED', 'APPROVED', 'COMPLETED'];
                  const isPast = steps.indexOf(currentStage) > idx;

                  return (
                    <div key={step} className="relative flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${isPast || isActive ? 'bg-[var(--violet)] border-[var(--violet)]' : 'bg-[var(--bg-elevated)] border-[var(--border-default)]'} z-10 shrink-0 shadow max-md:ml-[2px]`}>
                         {(isPast || isActive) && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <div className={isActive ? 'font-bold text-sm' : (isPast ? 'text-sm text-gray-500' : 'text-[11px] font-medium')}>
                        {step.replace('_', ' ')}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>

          <div className="bg-[var(--bg-elevated)] rounded-xl md:rounded-2xl p-3 md:p-4 border border-[var(--border-default)]">
             <div className="flex justify-between items-center mb-2 md:mb-3">
               <span className={'text-sm text-gray-500'}>Deadline</span>
               <span className={'font-mono tracking-tight text-sm'}>{thread.deadline && !Number.isNaN(new Date(thread.deadline).getTime()) ? new Date(thread.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" /* v332: IST */ }) : 'TBD'}</span>
             </div>
             <div className="flex justify-between items-center mb-3">
               <span className={'text-sm text-gray-500'}>Revisions</span>
               {/* Session 58 (bug hunt): revision_count is the ALLOWANCE (never goes down) — it said "Revisions Left: 5" for ever. */}
               <span className={'font-mono tracking-tight text-sm'}>{thread.revision_count != null ? `${thread.revisions_used != null ? `${Math.max(0, Number(thread.revision_count) - Number(thread.revisions_used))} left of ` : ""}${thread.revision_count}` : 'N/A'}</span>
             </div>
             <div className="pt-3 border-t border-[var(--border-default)]">
               <span className={`text-[10px] font-bold uppercase tracking-wider block mb-2`}>Deliverables</span>
               <ul className="space-y-2">
                 {/* v332: an empty list showed nothing at all, and object items crashed / showed [object Object] */}
                 {Array.isArray(thread.deliverables) && thread.deliverables.length > 0 ? thread.deliverables.map((d, i) => (
                   <li key={i} className={`text-sm text-gray-500 flex items-start gap-2`}>
                     <CheckCircle size={14} className="text-[var(--violet)] opacity-80 shrink-0 mt-0.5" />
                     <span className="min-w-0 break-words">{typeof d === "object" && d ? (d.title || d.type || d.name || "") : String(d)}</span>
                   </li>
                 )) : <li className={'text-[11px] font-medium'}>As agreed in the chat</li>}
               </ul>
             </div>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
