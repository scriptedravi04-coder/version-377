import React from "react";
import { Loader2, Send } from "lucide-react";
import GeminiIcon from "../../common/GeminiIcon";


// Session 49 (clean-up): moved out of ChatBox.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function ChatBoxComposer(props) {
  const { aiLoading, handleAiAssist, handleSend, isAgreementSigned, isBrand, isDealFixed, isMySignatureSigned, loading, sendingRef, setText, text } = props;
  return (
    <div className={`flex items-center sm:items-end gap-1 md:gap-3 rounded-2xl md:rounded-3xl bg-[var(--bg-base)] border border-[var(--border-default)] p-1 px-1.5 md:p-2 md:px-4 shadow-xs ${
                          isDealFixed && !isAgreementSigned && !isMySignatureSigned ? "opacity-60 pointer-events-none" : ""
                        }`}>
                          <button 
                            type="button"
                            onClick={handleAiAssist}
                            disabled={aiLoading || (isDealFixed && !isAgreementSigned && !isMySignatureSigned)}
                            title="AI Negotiation Assistant"
                            aria-label="AI negotiation help" /* v330: icon-only button had no label */
                            className="p-1.5 md:p-2.5 text-[var(--violet)] hover:text-white hover:bg-[var(--violet)] transition-colors rounded-full shrink-0 cursor-pointer"
                          >
                            {aiLoading ? <Loader2 size={16} className="animate-spin md:w-5 md:h-5" /> : <GeminiIcon className="w-4 h-4 md:w-5 md:h-5" />}
                          </button>
                          <textarea
                            value={text}
                            disabled={isDealFixed && !isAgreementSigned && !isMySignatureSigned}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!e.nativeEvent.isComposing && !sendingRef.current && !loading && text.trim()) {
                                  handleSend();
                                }
                              }
                            }}
                            placeholder={isDealFixed && !isAgreementSigned ? (!isMySignatureSigned ? "Please sign contract above to send messages..." : `Waiting for ${isBrand ? 'creator' : 'brand'} signature...`) : "Type a message..."}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none max-h-32 min-h-[34px] md:min-h-[40px] py-1.5 md:py-2.5 text-xs md:text-sm focus:outline-none"
                            rows={1}
                            aria-label="Message" /* v330 */
                          />
                          <button 
                            type="button"
                            disabled={!text.trim() || loading || (isDealFixed && !isAgreementSigned && !isMySignatureSigned)}
                            aria-label="Send message" /* v330 */
                            onClick={() => {
                              if (!sendingRef.current && !loading && text.trim()) {
                                handleSend();
                              }
                            }}
                            className={`p-1.5 md:p-2.5 shrink-0 rounded-full transition-all flex items-center justify-center cursor-pointer
                              ${(!text.trim() || loading || (isDealFixed && !isAgreementSigned && !isMySignatureSigned)) ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] opacity-60' : 'bg-[var(--violet)] text-white hover:bg-[var(--violet-hover)] shadow-xs'}`}
                          >
                            {loading ? (
                              <Loader2 size={14} className="animate-spin md:w-4 md:h-4 text-white" />
                            ) : (
                              <Send size={14} className={`md:w-4 md:h-4 ${text.trim() ? "ml-0.5" : ""}`} />
                            )}
                          </button>
                        </div>
  );
}
