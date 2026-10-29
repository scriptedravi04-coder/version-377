import { hasRefund } from "./refundFlags";
// Session 57 (Ravi's Money screens design, BP-01 / 01b / 02). One read-only list of a brand's money:
// campaign payments (per deal), UGC brief deposits (per brief), and every refund (campaign + UGC),
// with the summary numbers at the top. Nothing is written here; the money rules live in the locked
// payment files and are not touched.
import express from "express";
import { logIgnored } from "./logIgnored";

const up = (v: any) => String(v ?? "").trim().toUpperCase();
const actingBrandId = (u: any) => String(u?.parent_brand_id || u?.user_id || "");
const num = (v: any) => Number(v) || 0;

/** Pure: a campaign payment row's status for the brand. */
export function campaignPaymentStatus(tx: any): "escrow" | "released" | "refunded" {
  const st = up(tx?.status), ps = up(tx?.payout_status), rs = up(tx?.refund_status);
  if (st === "REFUNDED" || ps === "REFUNDED" || rs === "PROCESSED") return "refunded";
  if (ps === "RELEASED" || ps === "PAID" || ps === "COMPLETED" || String(tx?.payout_reference || "").trim()) return "released";
  return "escrow";
}

/** Pure: a UGC brief's status from its orders. Released once every claimed slot is approved and no slot is open. */
export function briefPaymentStatus(brief: any, orders: any[]): { status: "escrow" | "released"; delivered: number; completed: number; live: number } {
  const live = (orders || []).filter((o) => !["CANCELLED", "EXPIRED"].includes(up(o.status)));
  const completed = live.filter((o) => up(o.status) === "COMPLETED").length;
  const delivered = live.filter((o) => ["SUBMITTED", "QUALITY_REVIEW", "CONTENT_APPROVED", "AWAITING_LIVE_LINK", "LINKS_UNDER_REVIEW", "COMPLETED"].includes(up(o.status))).length;
  const slots = Math.max(0, num(brief?.max_creators));
  const allDone = slots > 0 && completed >= slots;
  return { status: allDone ? "released" : "escrow", delivered, completed, live: live.length };
}

function dealDetail(deal: any): string {
  const st = up(deal?.status);
  if (st === "CONTENT_SUBMITTED" || st === "PROOF_SUBMITTED") return "Draft in your review";
  if (st === "COMPLETED" || st === "APPROVED" || st === "CONTENT_APPROVED") return "Approved";
  if (deal?.content_deadline) {
    const d = new Date(deal.content_deadline);
    if (!Number.isNaN(d.getTime())) return `Draft due ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  }
  return "Creator is working on it";
}

export function setupBrandPaymentsRoutes(router: express.Router, { supabase, privilegedSupabase, parseAuthUser }: any) {
  router.get("/brand/payments-overview", async (req: any, res: any) => {
    const user = await parseAuthUser(req);
    if (!user) return res.status(401).json({ error: "Please sign in." });
    if (up(user.role) !== "BRAND") return res.status(403).json({ error: "Brands only" });
    const c = privilegedSupabase || supabase;
    if (!c) return res.json({ ok: false, items: [], refunds: [] });
    const brandId = actingBrandId(user);
    const ids = [...new Set([brandId, String(user.user_id)])];
    try {
      const [dealsR, briefsR, accR, ugcRefR] = await Promise.all([
        c.from("deals").select("id, campaign_id, creator_id, agreed_amount, status, content_deadline, created_at").in("brand_id", ids).limit(1000),
        c.from("ugc_briefs").select("id, title, product_name, budget, max_creators, status, razorpay_order_id, created_at").in("brand_id", ids).limit(1000),
        c.from("brand_refund_accounts").select("id").in("brand_id", ids).limit(1),
        c.from("ugc_refunds").select("id, brief_id, amount, slots, reason, status, utr, failure_reason, requested_at, processed_at").in("brand_id", ids).limit(500),
      ]);
      // v332: a failed read is not "no payments" (the first-time screen) — the app shows "Try again" instead.
      if (dealsR?.error || briefsR?.error || ugcRefR?.error) throw new Error("payments read failed");
      const deals = dealsR?.data || [];
      const briefs = (briefsR?.data || []).filter((b: any) => b.razorpay_order_id); // paid briefs only
      const dealIds = deals.map((d: any) => d.id);
      const briefIds = briefs.map((b: any) => b.id);

      const [txR, campR, ordersR] = await Promise.all([
        dealIds.length ? c.from("transactions").select("id, deal_id, gross_amount, brand_paid_amount, brand_fee_amount, brand_fee_pct, coupon_code, platform_fee_amount, gst_amount, creator_net_amount, status, payout_status, payout_reference, refund_amount, refund_status, refund_reference, refund_reason, refunded_at, zaakpay_order_id, created_at").in("deal_id", dealIds) : { data: [] },
        deals.length ? c.from("campaigns").select("campaign_id, title").in("campaign_id", [...new Set(deals.map((d: any) => d.campaign_id).filter(Boolean))]) : { data: [] },
        briefIds.length ? c.from("ugc_orders").select("id, brief_id, status").in("brief_id", briefIds) : { data: [] },
      ]);
      if ((txR as any)?.error) throw new Error("transactions read failed");
      const creatorIds = [...new Set(deals.map((d: any) => d.creator_id).filter(Boolean))];
      const { data: people } = creatorIds.length ? await c.from("users").select("user_id, name").in("user_id", creatorIds) : { data: [] };
      const nameOf = new Map((people || []).map((p: any) => [String(p.user_id), p.name]));
      const titleOf = new Map((campR?.data || []).map((x: any) => [String(x.campaign_id), x.title]));
      const dealOf = new Map(deals.map((d: any) => [String(d.id), d]));
      const ordersByBrief = new Map<string, any[]>();
      (ordersR?.data || []).forEach((o: any) => { const k = String(o.brief_id); ordersByBrief.set(k, [...(ordersByBrief.get(k) || []), o]); });

      const items: any[] = [];
      const refunds: any[] = [];
      for (const t of txR?.data || []) {
        const d: any = dealOf.get(String(t.deal_id)) || {};
        if (hasRefund(t)) { // Session 58: refund_status 'NONE' (DB default) is not a refund
          refunds.push({
            id: `tx_${t.id}`, kind: "campaign", title: titleOf.get(String(d.campaign_id)) || "Campaign deal",
            amount: num(t.refund_amount), status: up(t.refund_status) === "PROCESSED" ? "refunded" : "pending",
            reason: t.refund_reason || null, utr: up(t.refund_status) === "PROCESSED" ? (t.refund_reference || null) : null,
            date: t.refunded_at || t.created_at,
          });
          if (up(t.status) === "REFUNDED") continue;
        }
        items.push({
          id: t.id, kind: "campaign", deal_id: t.deal_id,
          title: titleOf.get(String(d.campaign_id)) || "Campaign deal",
          who: nameOf.get(String(d.creator_id)) || "Creator",
          amount: num(t.brand_paid_amount) || num(t.gross_amount), // Session 58 (Ravi): brands see only the total — no fee / GST / creator payout; v364: what the brand paid incl. service fee
          ...(num(t.brand_fee_amount) > 0 ? { deal_amount: num(t.gross_amount), service_fee: num(t.brand_fee_amount), service_fee_pct: num(t.brand_fee_pct), coupon_code: t.coupon_code || null } : {}),
          status: campaignPaymentStatus(t),
          detail: campaignPaymentStatus(t) === "escrow" ? dealDetail(d) : null,
          date: t.created_at, order_id: t.zaakpay_order_id || null,
        });
      }
      for (const b of briefs) {
        const orders = ordersByBrief.get(String(b.id)) || [];
        const s = briefPaymentStatus(b, orders);
        const slots = Math.max(1, num(b.max_creators));
        items.push({
          id: `brief_${b.id}`, kind: "ugc", brief_id: b.id,
          title: b.title || b.product_name || "UGC brief",
          who: `${slots} creator${slots > 1 ? "s" : ""}`,
          amount: num(b.budget) * slots,
          // Session 58 (bug hunt): a cancelled brief was shown as "Released" with its full amount — the money
          // goes back to the brand (see refunds), so it gets its own status.
          status: up(b.status) === "CANCELLED" ? "cancelled" : s.status,
          detail: s.status === "escrow" ? `${s.delivered} of ${slots} delivered` : null,
          date: b.created_at, order_id: b.razorpay_order_id,
        });
      }
      for (const r of ugcRefR?.data || []) {
        const b = briefs.find((x: any) => String(x.id) === String(r.brief_id));
        refunds.push({
          id: `ugc_${r.id}`, kind: "ugc", title: b?.title || b?.product_name || "UGC brief",
          amount: num(r.amount), status: up(r.status) === "PROCESSED" ? "refunded" : up(r.status) === "FAILED" ? "failed" : "pending",
          reason: r.reason || null, utr: up(r.status) === "PROCESSED" ? (r.utr || null) : null,
          failure: r.failure_reason || null, date: r.processed_at || r.requested_at,
        });
      }
      items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      refunds.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      const year = new Date().getFullYear();
      const summary = {
        in_escrow: items.filter((i) => i.status === "escrow").reduce((a, i) => a + i.amount, 0),
        spent_this_year: items.filter((i) => new Date(i.date || 0).getFullYear() === year).reduce((a, i) => a + i.amount, 0),
        active_campaign: items.filter((i) => i.kind === "campaign" && i.status === "escrow").length,
        active_ugc: items.filter((i) => i.kind === "ugc" && i.status === "escrow").length,
        has_refund_account: Array.isArray(accR?.data) && accR.data.length > 0,
        refund_waiting: refunds.filter((r) => r.status !== "refunded").reduce((a, r) => a + r.amount, 0),
      };
      return res.json({ ok: true, items, refunds, summary });
    } catch (e: any) {
      logIgnored("brandPayments:overview", e);
      return res.status(503).json({ ok: false, code: "PAYMENTS_UNAVAILABLE", error: "Payments couldn't be loaded right now. Please try again.", retry: true });
    }
  });
}
