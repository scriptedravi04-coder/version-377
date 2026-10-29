import React from "react";
import { RefreshCw, X, RotateCcw } from "lucide-react";
import { PopupPanel } from "../../../components/common/Popup";


// Session 49 (clean-up): moved out of BrandUGCOrders.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function OrderModalPanel(props) {
  const { handleSubmitRevision, isLiveLinkMode, revisionNotes, selectedOrder, setRevisionNotes, setShowRevisionModal, submittingRevision } = props;
  return (
    <PopupPanel kind="modal" className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <RotateCcw size={18} className="text-amber-500" />
                  {isLiveLinkMode ? "Re-request Live Link Correction" : "Request Video Revision"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  aria-label="Close" // v330 / v332: bigger tap target
                  className="p-2.5 -m-1.5 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitRevision} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-primary)] block mb-1.5">
                    {isLiveLinkMode 
                      ? "Specific instructions for updated live post URL:" 
                      : `Specific Revision Instructions for ${selectedOrder.creatorName || "the creator"}:`}{/* v332: no "for undefined" */}
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder={isLiveLinkMode 
                      ? "Detail what needs to be corrected in the live post (e.g. tag @brand in caption, unhide post, link sticker correction, proper audio credit)..." 
                      : "Detail exact timestamp modifications, lighting adjustments, script corrections, or audio changes required..."}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    // v332: 16px text on phones (stops iOS zoom)
                    className="w-full p-3.5 bg-[var(--bg-elevated)] rounded-xl text-base md:text-xs font-medium text-[var(--text-primary)] border border-[var(--border-default)] outline-none focus:border-[var(--violet)] transition-all resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border-default)]">
                  <button
                    type="button"
                    onClick={() => setShowRevisionModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submittingRevision} // v332: dimmed while sending
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submittingRevision ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <RotateCcw size={14} />
                        <span>{isLiveLinkMode ? "Send Link Correction Request" : "Send Revision Request"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </PopupPanel>
  );
}
