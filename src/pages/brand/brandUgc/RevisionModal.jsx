import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";


// Session 49 (clean-up): moved out of BrandUGCMobile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function RevisionModal(props) {
  const { handleSubmitRevision, revisionNotes, setRevisionNotes, setShowRevisionModal, showRevisionModal, submittingRevision, isLinkStage = false } = props;
  // v358: the same sheet asks for a corrected LIVE LINK after the draft was approved — video-editing wording was wrong there
  return (
    <AnimatePresence>
          {showRevisionModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowRevisionModal(false)} 
                className="fixed inset-0 bg-black/50 backdrop-blur-xs" 
              />
              <motion.div 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                exit={{ y: "100%" }} 
                className="relative bg-white w-full max-w-lg rounded-t-[26px] sm:rounded-[26px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 space-y-4 max-h-[85vh] max-h-[85dvh] overflow-y-auto" /* v330: home bar + iOS dvh */
              >
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-[#0A0A0A]">{isLinkStage ? "Ask for a corrected link" : "Request Free Revision"}</h3>
                  <button onClick={() => setShowRevisionModal(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600 w-10 h-10 -mr-2 flex items-center justify-center">{/* v330 */}
                    <X size={20} />
                  </button>
                </div>
                <p className="text-xs text-[#6B7280]">
                  {isLinkStage
                    ? "Say what's wrong with the post or link (e.g. wrong account, caption missing the tag, post not public)."
                    : "Be specific about required adjustments (e.g. cut length, caption placement, lighting)."}
                </p>
                <textarea 
                  rows={4}
                  aria-label="What should the creator change?" /* v332: textarea had no label */
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder={isLinkStage ? "e.g. Please tag @ourbrand in the caption and share the link to the public post." : "e.g. Please show the texture at 0:08 for 2 more seconds, and update the link CTA overlay."}
                  className="w-full bg-[#F9F9FB] border border-[#E5E5EA] rounded-xl p-3.5 text-base text-[#0A0A0A] outline-none focus:border-[#7C3AED]" /* v330: 16px stops iOS zoom */
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowRevisionModal(false)} 
                    className="flex-1 py-3 bg-[#F2F2F7] rounded-xl text-xs font-bold text-[#0A0A0A]"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={submittingRevision}
                    onClick={handleSubmitRevision}
                    className="flex-1 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50"
                  >
                    {submittingRevision ? "Submitting..." : "Send Request"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
}
