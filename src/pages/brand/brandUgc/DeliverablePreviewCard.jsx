import React from "react";
import { PlayCircle, ExternalLink, Lock } from "lucide-react";
import { mediaHref } from "../../../lib/mediaUrl";
import { resolveMediaUrl, YbexWatermarkOverlay } from "../../../components/shared/VideoEmbedPreview";


// Session 49 (clean-up): moved out of BrandUGCMobile.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function DeliverablePreviewCard(props) {
  const { deliverableUrl, isCompleted, isPlayableDeliverable, selectedOrder, isCollabOrder = true, pendingLabel } = props;
  // v358: real format + delivery date (was always "Reel" and "Submitted recently")
  const deliveredAt = selectedOrder?.delivered_at || selectedOrder?.submitted_at || null;
  const deliveredText = deliveredAt && Number.isFinite(Date.parse(deliveredAt))
    ? `Sent ${new Date(deliveredAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`
    : null;
  return (
    <div className="bg-white rounded-[20px] p-4 border border-[#E5E5EA] shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
                  Protected Draft
                </span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                isCompleted ? 'bg-[#E9F9EF] text-[#16A34A]' : 'bg-[#FEF7E0] text-[#B45309]'
              }`}>
                {isCompleted ? "Approved" : pendingLabel ? pendingLabel /* v358: revision / approved-draft / closed states */ : (deliverableUrl ? "Awaiting your review" : "Not submitted")}{/* v332: was "Unapproved" even with no draft */}
              </span>
            </div>

            {/* Video Player Container */}
            <div className="relative w-full aspect-[9/16] max-h-[380px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner group">
              {/* Session 43 (Ravi): the draft was a storage path (not "http…") so the brand got
                  "Open Cloud Link" instead of the video. Any uploaded file now plays here (through
                  the access-checked media proxy), with the Ybex watermark until approval; only a
                  Drive / Dropbox style link still opens outside. */}
              {deliverableUrl && isPlayableDeliverable(deliverableUrl) ? (
                <>
                  <video 
                    src={resolveMediaUrl(deliverableUrl) || mediaHref(deliverableUrl)} 
                    controls 
                    playsInline 
                    preload="metadata"
                    controlsList={isCompleted ? "nodownload" : "nodownload nofullscreen noremoteplayback"}
                    disablePictureInPicture={!isCompleted}
                    className="w-full h-full object-contain"
                    data-testid="brand-ugc-draft-video"
                  />
                  {!isCompleted && <YbexWatermarkOverlay label="Ybex Protected Draft" />}
                </>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto text-white shadow-xl">
                    <PlayCircle size={38} className="text-white fill-white/20" />
                  </div>
                  <div>
                    <h5 className="text-white text-sm font-bold">{deliverableUrl ? "Draft shared as a link" : "No draft yet"}</h5>
                    {/* v330: this line showed under "No draft yet" too */}
                    <p className="text-white/60 text-xs mt-1">{deliverableUrl ? "Shared as a link — opens outside Ybex" : "The creator's video will appear here."}</p>
                  </div>
                  {deliverableUrl && (
                    <a 
                      href={deliverableUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-[#7C3AED] text-white px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      <ExternalLink size={13} /> Open link
                    </a>
                  )}
                </div>
              )}

              {/* Watermark Tag Overlay — v332: only while the draft is really watermarked (not after approval / with no video) */}
              {!isCompleted && deliverableUrl && isPlayableDeliverable(deliverableUrl) && <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white/90 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1">
                <Lock size={10} /> Watermarked Preview
              </div>}
            </div>

            {/* Deliverable Metadata */}
            <div className="flex justify-between items-center text-xs text-[#6B7280] pt-1">
              <span>{/* v332: no made-up "30s · v1" when the order has no duration */}{[isCollabOrder ? "Reel" : "UGC video", selectedOrder.duration || selectedOrder.video_duration || selectedOrder.brief?.video_duration].filter(Boolean).join(" · ")}</span>
              {deliverableUrl && deliveredText && <span>{deliveredText}</span>}{/* v330: not when nothing was submitted · v358: real date */}
            </div>
          </div>
  );
}
