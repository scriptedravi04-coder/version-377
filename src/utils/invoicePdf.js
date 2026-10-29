import { jsPDF } from "jspdf";

/**
 * Generates and downloads a beautifully styled, high-fidelity PDF invoice receipt
 * for campaign payouts on Ybex.
 * 
 * @param {Object} transaction 
 * @param {boolean} isBrand 
 * @param {string} partnerName 
 */
export const downloadInvoicePDF = (transaction, isBrand, partnerName) => {
  if (!transaction) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // v333: same rule as InvoiceModal — a stored 0 must not hide the real amount.
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

  const formatPdfInr = (n) => {
    const num = Number(n) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const campaignName = transaction.campaign_title || (transaction.deals && transaction.deals.campaigns ? transaction.deals.campaigns.title : "Campaign Partnership");
  const receiptId = (transaction.id || "direct").toString().toUpperCase().replace('TXN_', '');
  
  const dateStr = transaction.created_at 
    ? new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  // --- Background / Border ---
  doc.setDrawColor(241, 245, 249); // light border
  doc.setFillColor(255, 255, 255);
  doc.rect(5, 5, 200, 287, "FD");

  // --- Header Band (Ybex Brand Violet #7C3AED) ---
  doc.setFillColor(124, 58, 237);
  doc.rect(10, 10, 190, 36, "F");

  // --- Ybex Monogram Badge ---
  doc.setFillColor(255, 255, 255);
  doc.ellipse(28, 28, 8, 8, "F");
  
  doc.setTextColor(124, 58, 237);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("YB", 25.5, 29);

  // --- Header Brand Text ---
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("YBEX PAYMENTS", 44, 26);
  
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("INFLUENCER COLLABORATION INVOICE RECEIPT", 44, 32);

  // --- Payment Success Header ---
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSFER SUCCESSFUL", 15, 62);

  // --- Underline bar ---
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(15, 65, 30, 1.5, "F");

  // --- Green success circle with checkmark ---
  doc.setFillColor(16, 185, 129); // #10B981
  doc.ellipse(25, 84, 8, 8, "F");
  
  // Tick lines
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.8);
  doc.line(22.5, 84, 24.2, 86);
  doc.line(24.2, 86, 27.5, 81.5);

  // --- Congratulations text ---
  doc.setTextColor(51, 65, 85); // slate-700
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  
  // v353: before the payout is PAID / has a UTR the creator's PDF said "successfully processed and transferred".
  const payoutPaid = ["PAID", "COMPLETED"].includes(String(transaction.payout_status || "").toUpperCase()) || Boolean(transaction.utr_number || transaction.payout_reference);
  const recipientMsg = isBrand 
    ? `Congratulations! Your payment transfer of INR ${amount.toLocaleString('en-IN')} to ${partnerName} was successful.`
    : payoutPaid
      ? `Congratulations! Your payout of INR ${netAmount.toLocaleString('en-IN')} has been successfully processed and transferred.`
      : `Your payout of INR ${netAmount.toLocaleString('en-IN')} is approved. It reaches your bank / UPI in 1-2 working days.`;
  
  doc.text(recipientMsg, 38, 85);

  // --- Receipt Metadata Summary Grid ---
  // Background Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.rect(15, 100, 180, 48, "FD");

  // Meta labels
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT ID", 22, 110);
  doc.text("TRANSACTION DATE", 112, 110);

  doc.text("CAMPAIGN PARTNERSHIP", 22, 132);
  doc.text("PAYMENT GATEWAY / METHOD", 112, 132);

  // Meta values
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(receiptId, 22, 116);
  doc.text(dateStr, 112, 116);
  doc.text(campaignName, 22, 138);
  doc.text("Direct Bank Transfer (IMPS/NEFT via Ybex Secure payment hold)", 112, 138);

  // --- Invoice breakdown Table ---
  // Table Header
  doc.setFillColor(124, 58, 237); // violet header
  doc.rect(15, 162, 180, 8.5, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM DESCRIPTION", 22, 167.5);
  doc.text("AMOUNT (INR)", 160, 167.5);

  // Row 1 - Gross amount
  doc.setTextColor(51, 65, 85); // slate-700
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text("Collaboration Content Deliverables (Agreed Rate)", 22, 178);
  doc.text(`INR ${formatPdfInr(amount)}`, 160, 178);

  // v365 (Ravi: "invoice mai convenience fee ki line add kar de"): the brand's own convenience fee (split model) — what
  // the brand paid on top of the deal, with the coupon if one was used. Not a GST invoice (Ybex is under the GST limit).
  const brandFee = Math.max(0, Number(transaction?.brand_fee_amount || 0) + Number(transaction?.brand_fee_gst || 0));
  const brandPaid = Number(transaction?.brand_paid_amount || 0) > 0 ? Number(transaction.brand_paid_amount) : amount + brandFee;
  const showBrandFee = isBrand && (brandFee > 0 || transaction?.brand_fee_pct != null);
  if (showBrandFee) {
    doc.setTextColor(51, 65, 85);
    const pct = transaction?.brand_fee_pct != null ? ` (${Number(transaction.brand_fee_pct)}%${transaction?.coupon_code ? `, coupon ${String(transaction.coupon_code).slice(0, 20)}` : ""})` : "";
    doc.text(`Convenience fee${pct}`, 22, 186);
    doc.text(`INR ${formatPdfInr(brandFee)}`, 160, 186);
  }

  // Row 2 - Platform Fee (for Creator)
  if (!isBrand) {
    // v365 deep test: a 0% creator fee (split model) prints "INR 0.00" in grey, not "Less: … -INR 0.00" in red
    if (platformFee > 0) doc.setTextColor(225, 29, 72); // rose-600
    else doc.setTextColor(51, 65, 85);
    doc.text(`${platformFee > 0 ? "Less: " : ""}Convenience fee & TDS (${feePercentage}%)`, 22, 186); // v330: fee label (Ravi)
    doc.text(`${platformFee > 0 ? "-" : ""}INR ${formatPdfInr(platformFee)}`, 160, 186);
  }

  // Row 3 - Secure payment hold (session 34: was "Insurance" — Ybex sells no insurance)
  doc.setTextColor(51, 65, 85);
  const rowY = isBrand && !showBrandFee ? 188 : 194;
  doc.text("Secure payment hold", 22, rowY);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text("Included", 160, rowY);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(15, 202, 195, 202);

  // Total Payout/Transferred row
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  
  const totalLabel = isBrand ? "TOTAL SECURE PAYMENT HOLD SECURED AMOUNT" : "NET BANK DISBURSED PAYOUT";
  doc.text(totalLabel, 22, 211);
  
  doc.setTextColor(16, 185, 129); // emerald-600
  const finalAmountToDisplay = isBrand ? brandPaid : netAmount; // v365: the brand's total includes the convenience fee
  doc.text(`INR ${formatPdfInr(finalAmountToDisplay)}`, 160, 211);

  // --- Secure Payment Hold Guarantee Seal ---
  doc.setFillColor(240, 253, 250); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.3);
  doc.rect(15, 228, 180, 22, "FD");

  doc.setTextColor(5, 150, 105); // emerald-600
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("YBEX PAYMENTS SAFETY TRUST SEAL", 22, 236.5);
  
  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("This transaction is recorded on Ybex.", 22, 243);

  // --- Bottom Stamp Info ---
  doc.setDrawColor(241, 245, 249);
  doc.line(15, 264, 195, 264);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("This is an electronically generated official platform transaction receipt. No physical signature is required.", 15, 274);
  doc.text("Ybex Media • ybexmedia.in • support@ybexmedia.in", 15, 279);

  // --- Save File ---
  try {
    const blob = doc.output("blob");
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `ybex_invoice_${receiptId}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  } catch (error) {
    console.error("Robust blob download failed, calling fallback doc.save...", error);
    doc.save(`ybex_invoice_${receiptId}.pdf`);
  }
};
