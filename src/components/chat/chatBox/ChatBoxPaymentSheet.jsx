import BrandFeeSummary, { quoteTotal } from "../../payments/BrandFeeSummary"; // v364
import React from "react";
import { ShieldCheck, Check, X } from "lucide-react";
import CheckoutPicker from "../../payments/checkout/CheckoutPicker"; // v366
import { CheckoutDealCard, CheckoutPayBar } from "../../payments/checkout/CheckoutScreens"; // v366
import { motion, AnimatePresence } from "framer-motion";


// Session 49 (clean-up): moved out of ChatBox.jsx word for word (one section of the page).
// Everything it needs comes in as props; no logic, text or server call changed.
export default function ChatBoxPaymentSheet(props) {
  const { currentThread, getDealAmount, handleEscrowPayment, isPaymentFunded, paymentLoading, paymentStep, setShowPaymentSheet, showPaymentSheet } = props;
  const [fee, setFee] = React.useState({ quote: null, couponCode: "" }); // v364
  const [method, setMethod] = React.useState("upi"); // v366: Ravi's checkout — Razorpay opens on the picked app / method
  // v332: "₹ 0" showed while the amount wasn't known — a dash / no amount instead (Razorpay shows the real total)
  const amt = Number(getDealAmount(currentThread)) || 0;
  const amtText = amt > 0 ? `₹${amt.toLocaleString('en-IN')}` : "";
  return (
    <AnimatePresence>
          {showPaymentSheet && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPaymentSheet(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="relative z-10 bg-[var(--bg-card)] rounded-t-3xl border-t border-[var(--border-default)] shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto" /* v330: dvh + home-bar padding */
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-neutral-700 rounded-full mx-auto mb-4" />

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[var(--text-primary)]">Ybex Secure Payment Hold</h4>
                      <p className="text-xs text-[var(--text-secondary)]">Funds stay in a secure payment hold until delivery is approved.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaymentSheet(false)}
                    aria-label="Close" /* v330 */
                    className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="bg-[var(--bg-elevated)] rounded-xl p-4 mb-4 border border-[var(--border-default)] text-left">
                  <div className="flex justify-between items-center">{/* v330: brand payment screens show the total only — the "Platform Security Fee FREE (₹ 0)" row is gone */}
                    <span className="text-xs text-[var(--text-secondary)] font-medium">Deal Agreed Amount</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{amtText || "—" /* v330: was an invented ₹3,000 fallback */}</span>
                  </div>
                </div>

                {isPaymentFunded ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-left">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-emerald-500">Secure Payment Completed</h5>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {amtText ? `The sum of ${amtText}` : "The payment" /* v330: was an invented ₹3,000 fallback */} is held in the secure payment hold. Creator can now begin creation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-left bg-white rounded-2xl">{/* v366: Ravi's checkout design */}
                    <CheckoutDealCard total={quoteTotal(fee.quote, amt)} note="Held in Ybex escrow until you approve the work.">
                      <BrandFeeSummary dealId={currentThread?.deal_id || null} threadId={currentThread?.id || null} grossAmount={getDealAmount(currentThread)} onQuote={setFee} disabled={paymentLoading} compact variant="checkout" />{/* v364 */}
                    </CheckoutDealCard>
                    <div className="mt-4"><CheckoutPicker value={method} onChange={setMethod} disabled={paymentLoading} /></div>
                    <CheckoutPayBar sticky={false} total={quoteTotal(fee.quote, amt)} choice={method} paying={paymentLoading} payingText={paymentStep || "Processing..."}
                      onPay={async () => {
                        await handleEscrowPayment(fee.couponCode || "", method);
                        setShowPaymentSheet(false);
                      }} testId="sheet-escrow-pay" />
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
}
