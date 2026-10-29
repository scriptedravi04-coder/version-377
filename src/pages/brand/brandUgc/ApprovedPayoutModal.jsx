import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Download } from "lucide-react";
import { mediaHref } from "../../../lib/mediaUrl"; // v358


// Session 49 (clean-up): moved out of BrandUGCMobile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function ApprovedPayoutModal(props) {
  const { amount, deliverableUrl, selectedOrder, setActiveTab, setSelectedOrderId, setShowApprovedModal, setView, showApprovedModal } = props;
  return (
    <AnimatePresence>
          {showApprovedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }} 
                className="relative bg-white w-full max-w-md rounded-[28px] p-6 z-10 text-center space-y-4 shadow-2xl max-h-[90vh] max-h-[90dvh] overflow-y-auto" /* v330: scrolls on short phones */
              >
                <div className="w-16 h-16 rounded-full bg-[#E9F9EF] text-[#16A34A] flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 size={36} strokeWidth={2.5} />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-[#0A0A0A]">Payout Released</h3>
                  <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                    ₹{amount.toLocaleString("en-IN")} is released to {selectedOrder.creator_name || "the creator"} — Ybex pays it to their bank next. You can download the watermark-free file below or from this order any time.
                  </p>
                </div>

                <div className="bg-[#F9F9FB] border border-[#ECECF0] rounded-2xl p-4 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between gap-3">{/* v332: gap so label and value never touch */}
                    <span className="text-[#6B7280]">Deliverable</span>
                    <span className="font-bold text-[#0A0A0A] text-right">{({ collaboration_reel: "Collab reel", ugc_video_edited: "Edited video", ugc_video_raw: "Raw clips" })[selectedOrder.deliverable_type || selectedOrder.brief?.deliverable_type] || "UGC video"}{(selectedOrder.brief?.video_duration || selectedOrder.video_duration) ? ` · ${selectedOrder.brief?.video_duration || selectedOrder.video_duration}` : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Released from Payment Hold</span>
                    <span className="font-bold text-[#16A34A]">₹{amount.toLocaleString("en-IN")}</span>
                  </div>
                  {/* v332: removed a made-up "Usage Rights: Paid Ads & Social · 6 Months" row — no brief stores usage rights */}
                </div>

                <div className="space-y-2.5 pt-2">
                  {deliverableUrl && (
                    <a 
                      href={mediaHref(deliverableUrl) /* v358: uploaded files are private — open through the media link */}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Download size={14} /> Download Master File
                    </a>
                  )}
                  <button 
                    onClick={() => {
                      setShowApprovedModal(false);
                      setSelectedOrderId(null);
                      setView("main");
                      setActiveTab("orders");
                    }}
                    className="w-full py-3 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#0A0A0A] rounded-xl font-bold text-xs"
                  >
                    Back to Orders
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
}
