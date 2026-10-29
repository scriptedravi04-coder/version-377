import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus } from "lucide-react";


// Session 49 (clean-up): moved out of BrandUGCMobile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function CreateFabMenu(props) {
  const { fabOpen, handleResumeDraft, handleStartNewBrief, hasDraft, setFabOpen, view } = props;
  return <>{view === "main" && (
        <>
          {/* FAB Backdrop */}
          <AnimatePresence>
            {fabOpen && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setFabOpen(false)} 
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" 
              />
            )}
          </AnimatePresence>

          {/* FAB Popup Menu */}
          <AnimatePresence>
            {fabOpen && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.8, opacity: 0, y: 20 }} 
                className="fixed bottom-[calc(164px+env(safe-area-inset-bottom))] right-5 z-50 flex flex-col items-end gap-2.5"
              >
                {hasDraft && (
                  <button 
                    onClick={handleResumeDraft}
                    className="bg-white text-[#0A0A0A] font-bold text-xs px-4 py-3 rounded-2xl shadow-xl border border-[#E5E5EA] flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock size={14} />
                    </div>
                    <span>Resume draft</span>
                  </button>
                )}

                <button 
                  onClick={handleStartNewBrief}
                  className="bg-white text-[#0A0A0A] font-bold text-xs px-4 py-3 rounded-2xl shadow-xl border border-[#E5E5EA] flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-[#F1E8FF] text-[#7C3AED] flex items-center justify-center">
                    <Plus size={14} />
                  </div>
                  <span>New brief</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Floating Action Button (Raised cleanly above 84px bottom navbar) */}
          <button 
            onClick={() => setFabOpen(!fabOpen)}
            className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-5 z-40 w-14 h-14 rounded-[19px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center justify-center shadow-[0_14px_28px_-12px_rgba(124,58,237,.65)] active:scale-95 transition-all cursor-pointer"
            aria-label={fabOpen ? "Close menu" : "Create brief"} // v332: FAB + menu clear the iPhone home bar; label matches state
            aria-expanded={fabOpen}
          >
            <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
              <Plus size={24} strokeWidth={2.5} />
            </motion.div>
          </button>
        </>
      )}</>;
}
