import React, { useEffect, useState } from "react";
import { formatAmount } from "../../utils/safeFormat";
import { api } from "../../lib/api";
import { useLoading } from "../../contexts/LoadingContext";
import { Wallet, Download, Activity } from "lucide-react";
import { toast } from "sonner";
import InvoiceModal from "../../components/payments/InvoiceModal";
import { useAuth } from "../../contexts/AuthContext";
import useIsMobile from "../../hooks/useIsMobile";
import { Navigate } from "react-router-dom";

import { Presence } from "../../components/common/Popup";
import PaymentsRetryCard from "../../components/common/PaymentsRetryCard";
export default function CreatorUGCEarnings() {
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadError, setLoadError] = useState(false); // v330: failed load ≠ "No earnings yet"
  const { user } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const isMobile = useIsMobile();

  // v332: one load function so the "Try again" card can call it (the error only said "refresh the page")
  const loadEarnings = () => {
    setLoading(true);
    startLoading();
    return api.get("ugc/earnings").then(res => {
      setEarnings(Array.isArray(res.data) ? res.data : []); // v330: non-array answer crashed .reduce
      setLoadError(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(true); // v332: the calm retry card explains it — no extra error toast
    }).finally(() => {
      setLoading(false);
      stopLoading();
    });
  };
  useEffect(() => { loadEarnings(); }, []);
  const showNumbers = !loading && !(loadError && earnings.length === 0); // v332: no ₹0 / 0 while loading or after a failed load

  // What the creator actually receives: the server attaches creator_net_amount (after the
  // platform fee). creator_payout is the gross order amount and used to be shown as earnings.
  const netOf = (o) => Number(o?.creator_net_amount ?? o?.creator_payout) || 0;
  const grossOf = (o) => Number(o?.gross_amount ?? o?.creator_payout) || 0;

  // v330: dates in IST, en-IN; a missing date shows "—" instead of "Invalid Date".
  const fmtDate = (v) => {
    const d = v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "—";
  };

  const handleDownloadCSV = () => {
    if (!earnings.length) {
      toast.error("No earnings data to download.");
      return;
    }
    const headers = ["Brief Title,Completed Date,Gross,Convenience fee & TDS,Net Payout"]; // v330: fee label (Ravi)
    const rows = earnings.map(o => {
      const title = `"${(o.brief?.title || "UGC Order").replace(/"/g, '""')}"`;
      const date = `"${fmtDate(o.approved_at || o.created_at)}"`;
      return `${title},${date},${grossOf(o)},${Number(o.platform_fee_amount) || 0},${netOf(o)}`;
    });
    const csvContent = headers.concat(rows).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "creator_ugc_earnings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const total = earnings.reduce((acc, o) => acc + netOf(o), 0);
  const inEscrowOrders = earnings
    .filter((o) => o.payment_status !== "RELEASED" && o.payment_status !== "PAID")
    .reduce((acc, o) => acc + netOf(o), 0);

  const twentyEightDaysAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const ugcPast28Days = earnings
    .filter((o) => new Date(o.approved_at || o.created_at || 0).getTime() >= twentyEightDaysAgo)
    .reduce((acc, o) => acc + netOf(o), 0);

  const paidToBankUgc = earnings
    .filter((o) => o.payout_status === "PAID" || Boolean(o.utr_number))
    .reduce((acc, o) => acc + netOf(o), 0);

  // Session 58 (bug hunt): the phone version here missed KYC / payout-account data and the payout button
  // ("KYC not submitted" for verified creators). Phones use the one full Earnings screen instead.
  if (isMobile) return <Navigate to="/earnings" replace />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] mb-2">UGC Earnings</h1>
          <p className="text-[var(--text-tertiary)] font-medium">Track what you've earned from UGC orders.</p>{/* v332: no hard-coded "22-hour" claim */}
        </div>
        <button onClick={handleDownloadCSV} className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer">
          <Download size={16} /> Download CSV
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
          <Wallet className="text-emerald-400 mb-4" size={28}/>
          <span className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-widest block mb-2">Total UGC Earnings</span>
          <span className="text-5xl font-black num-black text-[var(--text-primary)]">{showNumbers ? `₹${total.toLocaleString("en-IN")}` : "—"}</span>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 rounded-3xl relative overflow-hidden flex flex-col justify-center">
          <Activity className="text-[var(--violet)] mb-4" size={28}/>
          <span className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-widest block mb-2">Completed Orders</span>
          <span className="text-5xl font-black num-black text-[var(--text-primary)]">{showNumbers ? earnings.length : "—"}</span>
        </div>
      </div>
      {loadError && earnings.length === 0 && !loading && (
        <PaymentsRetryCard compact onRetry={loadEarnings} className="mt-8" />
      )}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl overflow-hidden mt-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-secondary)]">
            <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
              <tr>
                <th className="px-6 py-4">Brief</th>
                <th className="px-6 py-4">Completed Date</th>
                <th className="px-6 py-4">Payout</th>
                <th className="px-6 py-4">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {/* v330: loading and failed states no longer read "No earnings yet" */}
              {loading && earnings.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-[var(--text-tertiary)]">Loading your earnings…</td>
                </tr>
              ) : loadError && earnings.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-[var(--text-secondary)]">Your earnings will show here once they load.</td>
                </tr>
              ) : earnings.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-[var(--text-secondary)]">No earnings yet. Start claiming briefs!</td>
                </tr>
              ) : earnings?.map((o) => {
                 const txData = {
                   ...o,
                   id: o.id || `txn-${o.brief_id}`,
                   amount: grossOf(o),
                   created_at: o.approved_at || o.created_at,
                   brand_name: o.brief?.brand_name || "Brand",
                   // RELEASED ≠ PAID: the admin payout desk marks PAID once money reaches the bank.
                   payout_status: o.payment_status || 'RELEASED'
                 };
                 return (
                <tr key={o.id} className="hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-6 py-5 font-bold text-[var(--text-primary)] max-w-[200px] truncate">{o.brief?.title || "UGC Order"}</td>
                  <td className="px-6 py-5 whitespace-nowrap">{fmtDate(o.approved_at || o.created_at)}</td>
                  <td className="px-6 py-5 font-black num-black text-[#027A48]">₹{formatAmount(netOf(o))}</td>
                  <td className="px-6 py-5">
                    <button onClick={() => setSelectedInvoice(txData)} className="text-[var(--violet)] hover:text-[var(--text-primary)] transition-colors font-bold text-xs uppercase tracking-widest border border-[var(--violet)]/20 px-3 py-1 rounded-md bg-[var(--violet)]/10 cursor-pointer">View</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      
      <Presence>{selectedInvoice && (
        <InvoiceModal key="invoicemodal"
          transaction={selectedInvoice}
          isBrand={false}
          creatorName={user?.name || "Creator"}
          brandName={selectedInvoice.brand_name || "Brand"}
          onClose={() => setSelectedInvoice(null)}
        />
      )}</Presence>
    </div>
  );
}
