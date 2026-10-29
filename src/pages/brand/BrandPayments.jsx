import React, { useState, useEffect } from "react";
import BrandRefundsCard from "../../components/payments/BrandRefundsCard";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import StatsCard from "../../components/dashboard/StatsCard";
import PaymentsTable from "../../components/payments/PaymentsTable";
import { Wallet, Coins, Landmark } from "lucide-react";
import useIsMobile from "../../hooks/useIsMobile";
import BrandPaymentsMobile from "../../components/payments/BrandPaymentsMobile";
import PaymentsRetryCard from "../../components/common/PaymentsRetryCard";

export default function BrandPayments() {
  const navigate = useNavigate();
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false); // v332: server couldn't read payments
  const [brandGstin, setBrandGstin] = useState("");
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const isMobile = useIsMobile();

  // v332: silent = a "Try again" from the payments card (keeps the card on screen instead of the skeleton).
  const loadData = async (opts) => {
    const silent = opts === true || opts?.silent === true;
    try {
      if (!silent) setLoading(true);

      // Fetch authentic brand KYC / GST info
      try {
        const { data: kycRes } = await api.get("verifications/me").catch(() => ({ data: null }));
        if (kycRes?.documents) {
          const g = (kycRes.documents.gstin || kycRes.documents.gst_cert || "").trim();
          if (g) setBrandGstin(g);
          if (kycRes.documents.company_name) setBrandCompanyName(kycRes.documents.company_name);
        }
      } catch (e) {
        console.warn("Could not retrieve KYC verification:", e);
      }

      try {
        const { data: bProfile } = await api.get("brand-profile").catch(() => ({ data: null }));
        if (bProfile) {
          if (bProfile.company_name || bProfile.name) {
            setBrandCompanyName((prev) => prev || bProfile.company_name || bProfile.name);
          }
          if (bProfile.gstin || bProfile.gst_number) {
            setBrandGstin((prev) => prev || (bProfile.gstin || bProfile.gst_number).trim());
          }
        }
      } catch (e) {
        console.warn("Could not retrieve brand profile:", e);
      }

      let liveTxns = [];
      let apiFailed = false;

      // 1. Primary: Query authenticated backend escrow endpoint which scopes to user session
      try {
        const { data: apiEscrow } = await api.get("escrow-transactions", { bypassCache: true });
        if (apiEscrow && Array.isArray(apiEscrow) && apiEscrow.length > 0) {
          liveTxns = apiEscrow;
        }
      } catch (err) {
        console.warn("API escrow-transactions failed:", err);
        apiFailed = true;
      }

      // 2. Fallback: Query Supabase strictly for current user's brand_id or creator_id
      if ((!liveTxns || liveTxns.length === 0) && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const { data: userDeals } = await supabase
              .from("deals")
              .select("id, brand_id, creator_id")
              .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`);
            const dealIds = (userDeals || []).map((d) => d.id).filter(Boolean);

            let query = supabase
              .from("transactions")
              .select("*, users!creator_id(name)");

            if (dealIds.length > 0) {
              query = query.or(`creator_id.eq.${user.id},deal_id.in.(${dealIds.join(",")})`);
            } else {
              query = query.eq("creator_id", user.id);
            }

            const { data: supaTxns, error: supaErr } = await query.order("created_at", { ascending: false });

            if (!supaErr && supaTxns && supaTxns.length > 0) {
              liveTxns = supaTxns.map((e, idx) => ({
                id: e.id || `et-${idx}`,
                contract_id:
                  e.contract_id ||
                  `CTR-${(e.deal_id || e.id || "0000").slice(0, 8).toUpperCase()}`,
                brand_id: e.brand_id,
                creator_id: e.creator_id,
                creator_name:
                  e.users?.name ||
                  (e.creator_name !== "Creator Pro" ? e.creator_name : "") || // v358: the server's made-up fallback name
                  "Creator", // v330: was the made-up name "Creator Pro"
                amount: Number(e.gross_amount || e.amount || 0),
                gross_amount: Number(e.gross_amount || 0),
                creator_net_amount: Number(e.creator_net_amount || 0),
                status: (e.payout_status === 'RELEASED' || e.payout_status === 'PAID')
                  ? "released"
                  : ["COMPLETED"].includes((e.status || "").toUpperCase())
                    ? "released"
                    : ["SUCCESS", "ACTIVE", "ESCROW_HELD"].includes((e.status || "").toUpperCase())
                      ? "held"
                      : (e.status || "held").toLowerCase(),
                payout_status: e.payout_status,
                payout_reference: e.payout_reference,
                escrow_hold: e.escrow_hold,
                created_at: e.created_at || new Date().toISOString(),
              }));
            }
          }
        } catch (err) {
          console.warn("Direct Supabase query for transactions:", err);
        }
      }

      // Deduplicate by canonical deal_id or contract_id
      const uniqueMap = new Map();
      (Array.isArray(liveTxns) ? liveTxns : []).forEach((t) => {
        const key = t.deal_id || t.ugc_order_id || t.contract_id || t.id || t.transaction_id;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { ...t });
        } else {
          // Merge or prioritize non-empty status
          const existing = uniqueMap.get(key);
          const isReleased = t.status === 'released' || t.payout_status === 'PAID' || t.payout_status === 'RELEASED' || Boolean(t.payout_reference || t.utr_number);
          if (isReleased) {
            existing.status = 'released';
            existing.payout_status = 'PAID';
            existing.payout_reference = t.payout_reference || t.utr_number || existing.payout_reference;
            existing.utr_number = t.utr_number || t.payout_reference || existing.utr_number;
          } else if (t.status === 'video_submitted' && existing.status !== 'released') {
            existing.status = t.status;
          }
          if (Number(t.amount || t.gross_amount || 0) > 0) {
            existing.amount = Number(t.amount || t.gross_amount);
          }
        }
      });

      setTxns(Array.from(uniqueMap.values()));
      setListFailed(apiFailed && uniqueMap.size === 0);
    } catch (e) {
      console.warn("Failed retrieving escrow metadata", e);
      setTxns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Live SUM/COUNT metrics against escrow_transactions data:
  // "Secure payment hold active" = SUM(amount) WHERE status IN ('deposited','held')
  const activeEscrowAmount = txns
    .filter((t) =>
      // v358: only money really in the hold (unpaid "pending" / "approved" rows inflated it)
      ["deposited", "held", "in_escrow", "video_submitted", "escrow_held"].includes(
        (t.status || "").toLowerCase()
      )
    )
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // "Settled payouts" = SUM(amount) WHERE status = 'released'
  const settledPayoutsAmount = txns
    .filter((t) =>
      ["released", "completed", "paid", "success"].includes((t.status || "").toLowerCase())
    )
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // "Active protections" = COUNT(DISTINCT contract_id) WHERE status != 'released'
  const activeProtectionsCount = new Set(
    txns
      .filter(
        (t) =>
          // v358: refunded / cancelled / failed payments are not "active protections"
          ["deposited", "held", "in_escrow", "video_submitted", "escrow_held"].includes(
            (t.status || "").toLowerCase()
          )
      )
      .map((t) => t.contract_id || t.id || t.transaction_id)
  ).size;

  // v358: the phone card says "Released this year" — only this year's releases (IST), not all-time
  const thisYearIst = new Date(Date.now() + 5.5 * 3600000).getUTCFullYear();
  const releasedThisYear = txns
    .filter((t) => ["released", "completed", "paid", "success"].includes(String(t.status || "").toLowerCase())
      && new Date(new Date(t.released_at || t.updated_at || t.created_at || 0).getTime() + 5.5 * 3600000).getUTCFullYear() === thisYearIst)
    .reduce((acc, curr) => acc + (Number(curr.amount || curr.gross_amount) || 0), 0);
  const now = Date.now();
  const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000;
  const past28DaysFunded = txns
    .filter((t) => {
      const tTime = new Date(t.created_at || 0).getTime();
      return tTime >= twentyEightDaysAgo;
    })
    .reduce((acc, curr) => acc + (Number(curr.amount || curr.gross_amount) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
          <div className="h-10 bg-slate-200/60 rounded-lg animate-pulse w-1/4 relative overflow-hidden"></div>
          <div className="h-4 bg-slate-200/60 rounded animate-pulse w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="h-32 bg-slate-200/60 rounded-xl animate-pulse"></div>
            <div className="h-32 bg-slate-200/60 rounded-xl animate-pulse"></div>
            <div className="h-32 bg-slate-200/60 rounded-xl animate-pulse"></div>
          </div>
          <div className="h-64 bg-slate-200/60 rounded-xl animate-pulse mt-4"></div>
        </div>
          <div className="text-[var(--text-secondary)] text-sm font-mono tracking-widest uppercase">
            Loading Secure Payment Hold Ledger...
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <BrandPaymentsMobile
        activeEscrowAmount={activeEscrowAmount}
        settledPayoutsAmount={releasedThisYear}
        activeProtectionsCount={activeProtectionsCount}
        past28DaysFunded={past28DaysFunded}
        growthPercent={null /* was a hardcoded "+100%" */}
        transactions={txns}
        companyName={brandCompanyName}
        gstin={brandGstin}
        onBack={() => navigate(-1)}
        listFailed={listFailed}
        onRetryList={() => loadData(true)}
      />
    );
  }

  if (listFailed) {
    return (
      <div className="w-full max-w-xl mx-auto pt-10 pb-8" data-testid="brand-payments-page">
        <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-6">Payments</h1>
        <PaymentsRetryCard onRetry={() => loadData(true)} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none text-left font-sans pb-8" data-testid="brand-payments-page">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            Secure Payouts Ledger
          </h1>
          <p className="text-[var(--text-secondary)] text-xs sm:text-sm mt-1">
            Control, deposit, and direct contract releases using our safe secure payment hold frameworks.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 p-2 px-3 rounded-xl self-start sm:self-auto">
          🛡️ 256-bit Encrypted Secure payment hold
        </div>
      </div>

      {/* Session 36: campaign / deal refunds (status, UTR, refund account) */}
      <BrandRefundsCard className="mb-6" />

      {/* Summary Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <StatsCard
          label="Secure Payment Hold Active"
          value={activeEscrowAmount}
          prefix="₹"
          icon={Coins}
          colorClass="text-[var(--violet)]"
        />
        <StatsCard
          label="Settled Payouts"
          value={settledPayoutsAmount}
          prefix="₹"
          icon={Wallet}
          colorClass="text-[var(--green)]"
        />
        <StatsCard
          label="Active Protections"
          value={activeProtectionsCount}
          suffix={activeProtectionsCount === 1 ? " Contract" : " Contracts"}
          icon={Landmark}
          colorClass="text-[var(--violet)]"
        />
      </div>

      {/* Secure Transactions Queue */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 font-sans">
          Secure Transactions Queue
        </h3>

        <PaymentsTable
          transactions={txns}
        />
      </div>
    </div>
  );
}
