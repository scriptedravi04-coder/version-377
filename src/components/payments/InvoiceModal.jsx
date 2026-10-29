import React from 'react';
import usePlatformTax from "../../lib/usePlatformTax";
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { downloadInvoicePDF } from '../../utils/invoicePdf';

import { Presence, PopupBackdrop, PopupPanel } from "../common/Popup";
function InvoiceModalBody({ transaction, isBrand, creatorName, brandName, onClose }) {
  const tax = usePlatformTax(); // session 34: real GSTIN only when the admin switched GST on
  if (!transaction) return null;

  // v333: `gross_amount ?? amount` kept a stored 0 and the receipt read ₹0.00 although ₹11,700 was paid.
  const firstPositive = (...v) => { for (const x of v) { const n = Number(x); if (Number.isFinite(n) && n > 0) return n; } return 0; };
  const amount = firstPositive(transaction.gross_amount, transaction.amount, transaction.agreed_amount, transaction.deal_amount,
    Number(transaction.creator_net_amount || 0) + Number(transaction.platform_fee_amount || 0));
  // Session 58: the fee is what was stored (0 on a zero-fee deal) — never an assumed 10% / 15%, which lowered the
  // "net payout" on receipts below what the creator was actually paid.
  const storedFee = transaction.platform_fee_amount !== undefined && transaction.platform_fee_amount !== null && transaction.platform_fee_amount !== "" ? Number(transaction.platform_fee_amount) : null;
  const storedNet = transaction.creator_net_amount !== undefined && transaction.creator_net_amount !== null && transaction.creator_net_amount !== "" ? Number(transaction.creator_net_amount) : null;
  const platformFee = storedFee !== null && storedFee > 0 ? storedFee
    : (storedNet !== null && storedNet > 0 && amount > storedNet ? Math.round((amount - storedNet) * 100) / 100 : 0);
  const feePercentage = amount > 0 && platformFee > 0 ? Math.round((platformFee / amount) * 1000) / 10 : 0;
  const netAmount = Number.isFinite(storedNet) && storedNet !== null && storedNet > 0 ? storedNet : Math.round((amount - platformFee) * 100) / 100;
  // v365 (Ravi: "invoice mai convenience fee ki line"): the brand's convenience fee (split model) + coupon, and the total
  // the brand really paid. Not a GST invoice — Ybex is under the GST limit (GSTIN shows only when switched on).
  const brandFee = Math.max(0, Number(transaction.brand_fee_amount || 0) + Number(transaction.brand_fee_gst || 0));
  const brandPaid = Number(transaction.brand_paid_amount || 0) > 0 ? Number(transaction.brand_paid_amount) : amount + brandFee;
  const showBrandFee = isBrand && (brandFee > 0 || transaction.brand_fee_pct != null);

  const formatMoney = (n) => {
    const num = Number(n) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const campaignName = transaction.campaign_title || (transaction.deals && transaction.deals.campaigns ? transaction.deals.campaigns.title : "Campaign Partnership");
  const receiptId = (transaction.id || "direct").toString().toUpperCase().replace('TXN_', '');
  
  const txDate = transaction.payout_completed_at || transaction.payout_released_at || transaction.updated_at || transaction.created_at;
  // v332: a receipt with no date showed today's date as if that were the payment date — and "Invalid Date" for a bad one.
  const dateStr = txDate && !Number.isNaN(new Date(txDate).getTime())
    ? new Date(txDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) // v330: IST
    : "—";
  // v332: campaign receipts said "UGC Content Deliverables"
  const isUgcTx = Boolean(transaction.ugc_order_id || transaction.order_type === "ugc" || transaction.type === "ugc_order" || transaction.deal_type === "ugc");
  const shortId = (n) => (receiptId.length > n ? `${receiptId.slice(0, n)}…` : receiptId);

  const payer = brandName || transaction.brand_name || "A brand"; // v353: real brand name (was always "Brand Partner" on phone)
  // v353: a creator's payout that has no UTR / PAID status yet is not "transferred" — say "statement", not "receipt".
  const payoutPaid = isBrand || ["PAID", "COMPLETED"].includes(String(transaction.payout_status || "").toUpperCase()) || Boolean(transaction.utr_number || transaction.payout_reference);
  const payee = creatorName || "Content Creator";

  const handleDownload = () => {
    downloadInvoicePDF(transaction, isBrand, payee);
  };

  return createPortal(
    <PopupBackdrop className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-x-hidden overflow-y-auto overscroll-contain relative font-sans max-h-[calc(100dvh-24px)]" /* Session 43 (Ravi): Android cut it off — it now fits the screen and scrolls */
      >
        <PopupPanel kind="modal" className="p-4 sm:p-8 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#9D7CFF]/5 rounded-bl-[100px] -z-10" />
          
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-3 mb-6 sm:mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">Ybex</span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#9D7CFF]/10 text-[#9D7CFF] border border-[#9D7CFF]/30 uppercase tracking-wider">
                  {isBrand ? "PAYMENT RECEIPT" : payoutPaid ? "TRANSFER RECEIPT" : "PAYOUT STATEMENT"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Ybex Media{tax.gstRegistered ? ` · GSTIN ${tax.gstin}` : ""}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Transaction Statement
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">RECEIPT NO</div>
              <div className="font-mono text-sm font-bold text-[#9D7CFF]">
                {shortId(10)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Date: {dateStr}
              </div>
            </div>
          </div>

          {/* Billed To / Beneficiary */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
            <div>
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1">PAYER (BRAND)</div>
              <div className="font-bold text-sm text-slate-900">{payer}</div>
              <div className="text-slate-500 mt-1 font-mono text-[11px]">
                Platform Secure Payment Hold Account
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1">PAYEE (CREATOR)</div>
              <div className="font-bold text-sm text-slate-900">{payee}</div>
              <div className="text-slate-500 mt-1 font-mono text-[11px]">
                Transaction ID: {shortId(8)}
              </div>
            </div>
          </div>

          {/* Transaction Summary Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                  <th className="p-3">ITEM DESCRIPTION</th>
                  <th className="p-3 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                <tr>
                  <td className="p-3 font-sans">
                    <div className="font-semibold text-slate-900">
                      {campaignName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {isUgcTx ? "UGC Content Deliverables & Production Rate" : "Campaign Content Deliverables"}
                    </div>
                  </td>
                  <td className="p-3 text-right">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                {showBrandFee && (
                  <tr data-testid="invoice-brand-fee">
                    <td className="p-3 font-sans">
                      <div className="font-semibold text-slate-900">Convenience fee{transaction.brand_fee_pct != null ? ` (${Number(transaction.brand_fee_pct)}%)` : ""}</div>
                      {transaction.coupon_code && <div className="text-[11px] text-emerald-600 mt-0.5">Coupon {transaction.coupon_code} applied</div>}
                    </td>
                    <td className="p-3 text-right">₹{brandFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr>
                  <td className="p-3 font-sans">
                    <div className="font-semibold text-slate-900">
                      Ybex Protection & Secure Payment Hold Insurance
                    </div>
                  </td>
                  <td className="p-3 text-right text-emerald-600 font-bold">Included (100% Secured)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs mt-6">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">{showBrandFee ? "Deal amount:" : "Total Paid (Gross):"}</span>
              <span className="font-mono font-semibold text-slate-900">₹{formatMoney(amount)}</span>
            </div>
            {isBrand ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Secure Payment Hold Protection & Coverage:</span>
                  <span className="font-semibold text-emerald-600">Included (100% Secured)</span>
                </div>
                {showBrandFee && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Convenience fee{transaction.brand_fee_pct != null ? ` (${Number(transaction.brand_fee_pct)}%)` : ""}:</span>
                    <span className="font-mono font-semibold text-slate-900">₹{formatMoney(brandFee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2.5 border-t border-slate-200 text-sm font-extrabold">
                  <span className="text-slate-900">Total Billed Amount:</span>
                  <span className="font-mono text-slate-900">₹{formatMoney(showBrandFee ? brandPaid : amount)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Convenience fee &amp; TDS:</span>
                  {/* v365 deep test: creators pay 0% in the split model — "₹0.00", never "-₹0.00" in red */}
                  <span className={`font-mono font-semibold ${platformFee > 0 ? "text-rose-500" : "text-slate-900"}`} data-testid="invoice-creator-fee">{platformFee > 0 ? "-" : ""}₹{formatMoney(platformFee)}</span>
                </div>
                <div className="flex justify-between pt-2.5 border-t border-slate-200 text-sm font-extrabold">
                  <span className="text-slate-900">Net payout to creator:</span>
                  <span className="font-mono text-[#027A48]">₹{formatMoney(netAmount)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-[11px] text-slate-400 text-center pt-4 italic">
            This is a computer-generated transaction receipt issued by Ybex Media.
          </div>
        </PopupPanel>

        <div className="no-print flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-2.5 bg-[#9D7CFF] hover:bg-[#8B6CEB] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Download size={14} /> Print / Save PDF
          </button>
        </div>
      </motion.div>
    </PopupBackdrop>,
    document.body
  );
}

// Session 37: stays mounted for its closing animation.
export default function InvoiceModal(props) {
  return <Presence>{props.transaction && <InvoiceModalBody key="invoicemodal" {...props} />}</Presence>;
}

