import React, { useEffect, useState } from "react";
import { formatAmount } from "../../utils/safeFormat";
import { api } from "../../lib/api";
import { BrandPaymentsSkeleton } from "../../components/common/MobileSkeletons";
import { Wallet, Clock } from "lucide-react";
import useIsMobile from "../../hooks/useIsMobile";
import BrandPaymentsMobile from "../../components/payments/BrandPaymentsMobile";
import PaymentsRetryCard from "../../components/common/PaymentsRetryCard";

export default function BrandUGCPayments() {
  const [orders, setOrders] = useState([]);
  // v332: "loading" stops the ₹0 / "No payment history" flash; "failed" shows a calm Try again card
  // instead of an empty table when the orders couldn't be read.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const isMobile = useIsMobile();

  const loadOrders = () => {
    // v333: no global top loader — the page draws its own skeleton.
    return api.get("ugc/orders/brand").then(res => {
      // v330: the endpoint can answer { orders: [...] } — an object here crashed the page (.filter is not a function).
      const d = res?.data;
      setOrders(Array.isArray(d) ? d : Array.isArray(d?.orders) ? d.orders : []);
      setFailed(false);
    }).catch(err => {
      console.error(err);
      setFailed(true); // v332: no scary toast — the page shows the retry card
    }).finally(() => {
      setLoaded(true);
    });
  };

  useEffect(() => { loadOrders(); }, []);

  // Session 58: the server writes ESCROW_HELD (never "HELD"), so "In Payment Hold" was always ₹0; amounts as numbers.
  const isHeld = (o) => ['ESCROW_HELD', 'HELD'].includes(String(o.payment_status || '').toUpperCase());
  const totalSpent = orders?.filter(o => o.payment_status === 'RELEASED').reduce((acc, o) => acc + (Number(o.agreed_amount) || 0), 0);
  const inEscrow = orders?.filter(isHeld).reduce((acc, o) => acc + (Number(o.agreed_amount) || 0), 0);

  // v333: a page-shaped skeleton on phones while the orders load (it showed ₹0 and an empty list first).
  if (isMobile && !loaded) return <BrandPaymentsSkeleton />;
  if (isMobile) {
    return (
      <BrandPaymentsMobile
        activeEscrowAmount={inEscrow || 0}
        settledPayoutsAmount={totalSpent || 0}
        activeProtectionsCount={orders?.length || 0}
        past28DaysFunded={inEscrow || 0}
        growthPercent={null /* was a hardcoded "+100%" */}
        listFailed={failed} // v332: orders couldn't be read → calm retry card, not "no payments"
        onRetryList={loadOrders}
        transactions={(orders || []).map((o, idx) => ({
          id: o.id || `ugc-o-${idx}`,
          // v332: no made-up fallbacks ("UGC Fast Turnaround Brief", "Creator Partner", CTR-UGC-3900…)
          contract_id: o.id ? `CTR-UGC-${String(o.id).slice(-6).toUpperCase()}` : "—",
          campaign_title: o.brief?.title || "UGC brief",
          creator_name: o.creator?.name || "Creator",
          gross_amount: o.agreed_amount,
          amount: o.agreed_amount,
          status: o.payment_status === "RELEASED" ? "released" : ["REFUNDED", "FAILED"].includes(String(o.payment_status || "").toUpperCase()) || String(o.status || "").toUpperCase() === "CANCELLED" ? "refunded" : "held",
          created_at: o.created_at,
          utr_number: o.utr_number
        }))}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black num-black text-[var(--text-primary)] mb-2">UGC Payments & Payment Hold</h1>
      <p className="text-[var(--text-tertiary)] mb-8 font-medium">Track your UGC spends and secure payment hold balances.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-5 rounded-2xl">
          <Wallet className="text-[var(--violet)] mb-2" size={24}/>
          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest block mb-1">Total Spent</span>
          <span className="text-3xl font-black num-black text-[var(--text-primary)]">{loaded && !failed ? `₹${totalSpent.toLocaleString("en-IN")}` : "—"}</span>{/* v332: no ₹0 flash / ₹0 on a failed load */}
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-5 rounded-2xl">
          <Clock className="text-blue-400 mb-2" size={24}/>
          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest block mb-1">In Payment Hold</span>
          <span className="text-3xl font-black num-black text-blue-400">{loaded && !failed ? `₹${inEscrow.toLocaleString("en-IN")}` : "—"}</span>
        </div>
      </div>

      {failed ? (
        <PaymentsRetryCard className="mt-8" onRetry={loadOrders} />
      ) : (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl overflow-hidden mt-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-secondary)]">
            <thead className="bg-[var(--bg-elevated)] text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
              <tr>
                <th className="px-6 py-4">Brief</th>
                <th className="px-6 py-4">Creator ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loaded ? (
                <tr>
                  <td colSpan="5" className="px-6 pt-4 pb-6">{/* v333: skeleton rows, not "Loading payments…" */}
                    {[0, 1, 2].map((i) => <div key={i} className="h-10 my-2 rounded-lg bg-white/5 animate-pulse" />)}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 pt-6 pb-10 text-center text-[var(--text-secondary)]">No payment history.</td>
                </tr>
              ) : orders?.map((o) => (
                <tr key={o.id} className="hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-6 py-5 font-bold text-[var(--text-primary)] truncate max-w-[200px]">{o.brief?.title || "UGC"}</td>
                  <td className="px-6 py-5 font-mono text-xs">{o.creator_id ? `${String(o.creator_id || "—").slice(0, 8)}…` : "—" /* v330: was "—..." (pinned text kept) */}</td>
                  {/* v330: IST date, no "Invalid Date" */}
                  <td className="px-6 py-5">{o.created_at && !Number.isNaN(new Date(o.created_at).getTime()) ? new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—"}</td>
                  <td className="px-6 py-5 font-bold text-[var(--text-primary)]">₹{formatAmount(o.agreed_amount)}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      o.payment_status === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      isHeld(o) ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                      'bg-[var(--bg-base)]0/10 text-[var(--text-tertiary)] border-[var(--border-default)]'
                    }`}>
                      {/* v330: was the raw enum (ESCROW_HELD, RELEASED…) */}
                      {o.payment_status === 'RELEASED' ? 'Released' : isHeld(o) ? 'In payment hold' : String(o.payment_status || 'Pending').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase())}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
