import React, { useState, useEffect, useMemo } from "react";
import { APPROVE_NOTICE } from "../../lib/fileRetention";
import PayConsentLine from "../../components/legal/PayConsentLine";
import BriefRefundStatus from "../../components/brand/BriefRefundStatus";
import BriefSafetyExplainer, { useBriefExplainer } from "../../components/ugc/BriefSafetyExplainer";
import CreatorCard from "../../components/ugc/CreatorCard";
import { orderWindowHours } from "../../utils/ugcTerms";
import { formatAmount } from "../../utils/safeFormat";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { processRazorpayPayment } from "../../lib/razorpay";
import BrandFeeSummary from "../../components/payments/BrandFeeSummary"; // v364
import CheckoutPicker from "../../components/payments/checkout/CheckoutPicker"; // v366
import { CheckoutDealCard, RazorpayTrust } from "../../components/payments/checkout/CheckoutScreens"; // v366
import { choiceLabel } from "../../components/payments/checkout/checkoutMethods"; // v366
import { quoteTotal } from "../../components/payments/BrandFeeSummary"; // v366
import { getPaidBriefOrder, savePaidBriefOrder, clearPaidBriefOrder, FINAL_ORDER_CODES, goToPostedBriefs, watchPaidOrder, checkBriefOrderPaid, savePendingBriefOrder, recoverPendingBriefOrder } from "../../lib/briefPaymentRetry";
import { DELIVERY_OPTIONS, DEFAULT_DELIVERY_HOURS, deliveryHoursOf } from "../../utils/ugcTerms";
import { CheckCircle2, Clock, MessageCircle, RefreshCw, Check, X, Plus, RotateCcw, Lock, ChevronRight, ChevronLeft, AlertCircle, Eye, Film, Info } from "lucide-react";
import { toast } from "sonner";
import OrderSupportModal from "../../components/chat/OrderSupportModal";
import { BrandBriefListSkeleton } from "../../components/common/MobileSkeletons";
import { mediaHref } from "../../lib/mediaUrl";
import { ignored } from "../../utils/ignored";
import CancelBriefModal from "../../components/brand/CancelBriefModal";
import BrandCancelOrderModal, { BrandCancelOrderButton } from "../../components/ugc/BrandCancelOrderModal";
import { draftGet, draftRemove, draftSet } from "../../lib/userDraft";
import { useHideBottomNav } from "../../lib/bottomNavVisibility";
import useScrollLock from "../../lib/useScrollLock";

import { Presence } from "../../components/common/Popup";
import BrandLogo from "../../components/common/BrandLogo";
import AiPromptSheet from "./brandUgc/AiPromptSheet";
import ApprovedPayoutModal from "./brandUgc/ApprovedPayoutModal";
import BriefStepFormat from "./brandUgc/BriefStepFormat";
import BriefStepProduct from "./brandUgc/BriefStepProduct";
import BriefStepTitle from "./brandUgc/BriefStepTitle";
import CreateFabMenu from "./brandUgc/CreateFabMenu";
import DeliverablePreviewCard from "./brandUgc/DeliverablePreviewCard";
import OrdersTab from "./brandUgc/OrdersTab";
import { OfflineAware } from "../../components/common/OfflineState"; // v334
import RevisionModal from "./brandUgc/RevisionModal";
import UgcHomeHeader from "./brandUgc/UgcHomeHeader";

/** Session 43: an uploaded draft (storage path or direct video file) plays inline; share links
 *  from Drive / Dropbox / OneDrive can't be played here and keep their "open" button. */
export function isPlayableDeliverable(url) {
  const u = String(url || "").trim();
  if (!u) return false;
  if (/drive\.google|dropbox\.com|1drv\.ms|onedrive|wetransfer|icloud\.com/i.test(u)) return false;
  if (!/^https?:/i.test(u)) return true; // our own storage path
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(u) || /\/(storage|media|api\/media)\//i.test(u);
}
// SLA Calculation helper
// totalHours = the order's own first-draft window (24/48/72h), not a fixed 24h.
function getSlaTimeLeft(deadline, totalHours = 24) {
  if (!deadline) return { text: "Deadline pending", isUrgent: false, percent: 100 };
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "Past deadline", isUrgent: true, percent: 0 }; // v332: plain words (was "SLA Exceeded")
  const totalSlaMs = totalHours * 60 * 60 * 1000;
  const percent = Math.max(0, Math.min(100, (diff / totalSlaMs) * 100));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return {
    text: `${hours}h ${minutes}m left`,
    isUrgent: diff < 6 * 60 * 60 * 1000,
    percent
  };
}

// Format Label Helper
function getFormatLabel(type) {
  const dt = String(type || "").toLowerCase();
  if (dt === 'ugc_video_raw' || dt === 'ugc_raw_video' || dt.includes('raw')) return 'UGC Raw';
  if (dt === 'ugc_video_edited' || dt === 'ugc_video' || dt.includes('edited')) return 'UGC Edited';
  if (dt === 'collaboration_reel' || dt.includes('collab') || dt.includes('reel')) return 'Collaboration Video';
  return 'Collaboration Video';
}

// Minimum budget per video.
// Session 52 (Ravi: "minimum ₹1 bhi daal sakte hain, wo waisa hi rehne dena… jab users zyada honge tab
// UGC ka minimum 3000 karenge"): ₹1 on every domain for now. The old rule raised it to ₹1,500–2,500 on
// any real domain (e.g. ybexmedia.in) — that would have surprised brands at launch. To raise it later,
// change UGC_MIN_BUDGET (and BrandUGCPost.jsx + src/components/assist/brand/brandLogic.js UGC_MIN).
const UGC_MIN_BUDGET = 1;
function getMinBudget(type) { // eslint-disable-line no-unused-vars
  return UGC_MIN_BUDGET;
}

const SUGGESTED_DOS = [
  "Show product texture clearly in natural daylight",
  "Include strong hook in the first 3 seconds",
  "Demonstrate product in actual daily use",
  "Include clear call-to-action (where to buy)",
  "Highlight unboxing & key benefits"
];

const SUGGESTED_DONTS = [
  "Do not mention competitor brand names or prices",
  "Do not use heavy artificial beauty filters",
  "Avoid noisy background or distracting clutter",
  "Do not show damaged shipping boxes",
  "Do not publish without prior brand review approval"
];

export default function BrandUGCMobile({ initialTab = "briefs", initialView = "main" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Primary State
  const [activeTab, setActiveTab] = useState(initialTab); // 'briefs' | 'orders'
  const [view, setView] = useState(initialView); // 'main' | 'post' | 'order-detail'
  // v330: order detail / post wizard are drawn inside the same route — the bottom nav stayed on top of
  // their fixed Approve / Pay bar. Hide it while an inner screen is open (same as CreatorUGCMobile).
  useHideBottomNav(view !== "main");
  
  // Data State
  const [briefs, setBriefs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefsError, setBriefsError] = useState(false); // v330: failed load ≠ "No Briefs Found"
  const [ordersError, setOrdersError] = useState(false); // v330: same for orders

  // Search & Filters
  const [searchOpen, setSearchOpen] = useState(false);
  const [briefSearch, setBriefSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all"); // 'all' | 'review' | 'in_progress' | 'done'

  // Selected Order for Detail View
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // v358: the order screen and the post-brief wizard are drawn inside this route, so the phone's Back (and
  // Android's hardware Back, src/lib/native.js) left Instant UGC altogether. Opening one now adds a history step;
  // Back closes it and returns to the list. Closing it with the on-screen button removes that step again.
  const viewPushedRef = React.useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.history?.pushState) return;
    // /brand/ugc/post has its own address (and moves to My Briefs after posting) — no extra step there.
    if (!viewPushedRef.current && location.pathname.startsWith("/brand/ugc/post")) return;
    if (view !== "main" && !viewPushedRef.current) {
      viewPushedRef.current = true;
      try { window.history.pushState({ ...(window.history.state || {}), ybexUgcView: view }, ""); } catch (e) { ignored("BrandUGCMobile:pushState", e); }
    } else if (view === "main" && viewPushedRef.current) {
      viewPushedRef.current = false;
      try { window.history.back(); } catch (e) { ignored("BrandUGCMobile:back", e); }
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPop = () => {
      if (!viewPushedRef.current) return; // our own history.back() above
      if (window.history.state && window.history.state.ybexUgcView) return; // still on our step (e.g. checkout closed its own entry)
      viewPushedRef.current = false;
      setSelectedOrderId(null);
      setView("main");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // FAB Menu State (Screen 01b)
  const [fabOpen, setFabOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null); // v345: { title, fromEva } — shown as a card on My briefs

  // Post Brief Wizard State (Screens 03-07)
  const [postStep, setPostStep] = useState(1);
  const [ugcFee, setUgcFee] = useState({ quote: null, couponCode: "" }); // v364: brand service fee + coupon
  const [ugcMethod, setUgcMethod] = useState("upi"); // v366: Ravi's checkout — Razorpay opens on the picked app / method
  const [postData, setPostData] = useState({
    title: "",
    product_name: "",
    product_description: "",
    detailed_requirements: "",
    product_url: "",
    sample_content_url: "",
    deliverable_type: "collaboration_reel",
    video_duration: "30s",
    budget: 2000,
    max_creators: 1,
    delivery_hours: DEFAULT_DELIVERY_HOURS,
    dos: [],
    donts: []
  });

  // Modals & Bottom Sheets
  const [showLivePreview, setShowLivePreview] = useState(false); // Screen 08
  // Session 24: "Your money stays safe" — first time the brand opens the post flow.
  const [explainerOpen, openExplainer, closeExplainer, explainerReopened] = useBriefExplainer(user?.user_id, view === "post");
  const [showApprovedModal, setShowApprovedModal] = useState(false); // Screen 11
  const [approvedOrderData, setApprovedOrderData] = useState(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState(false);
  const [showApplicantsSheet, setShowApplicantsSheet] = useState(false);
  useScrollLock(showLivePreview || showApplicantsSheet); // v344: page behind the sheets must not scroll
  const [activeBriefForApplicants, setActiveBriefForApplicants] = useState(null);
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showCancelOrder, setShowCancelOrder] = useState(false); // session 25: brand cancels one order
  const [selectedBriefForCancel, setSelectedBriefForCancel] = useState(null);

  // Check LocalStorage for draft on mount & auto-restore if in post view
  useEffect(() => {
    try {
      const draft = draftGet("ugc_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed) {
          const loaded = parsed.formData || parsed;
          if (loaded && (loaded.title || loaded.product_name || loaded.deliverable_type)) {
            setHasDraft(true);
            setDraftInfo({ title: loaded.title || loaded.product_name || "Untitled brief", fromEva: parsed.from === "assist" });
            if (initialView === "post") {
              setPostData(prev => ({
                ...prev,
                ...loaded,
                dos: Array.isArray(loaded.dos) ? loaded.dos : [],
                donts: Array.isArray(loaded.donts) ? loaded.donts : []
              }));
              if (parsed.step) {
                setPostStep(parsed.step);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [initialView]);

  // Sync draft to LocalStorage
  useEffect(() => {
    if (view === "post" && (postData.title || postData.product_name || postStep > 1)) {
      try {
        draftSet("ugc_draft", JSON.stringify({
          formData: postData,
          step: postStep,
          updated_at: Date.now()
        }));
        setHasDraft(true);
      } catch (e) { ignored("BrandUGCMobile:174", e); }
    }
  }, [postData, postStep, view]);

  // Fetch Briefs and Orders from real APIs
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [briefsRes, ordersRes] = await Promise.allSettled([
        api.get("ugc/briefs/my"),
        api.get("ugc/orders/brand")
      ]);

      if (briefsRes.status === "fulfilled") {
        // v332: the answer can be { briefs: [...] } — an object here broke the list (.filter is not a function)
        const bd = briefsRes.value?.data;
        setBriefs(Array.isArray(bd) ? bd : Array.isArray(bd?.briefs) ? bd.briefs : []);
      }
      setBriefsError(briefsRes.status !== "fulfilled");
      setOrdersError(ordersRes.status !== "fulfilled");
      if (ordersRes.status === "fulfilled") {
        const rawOrders = ordersRes.value?.data?.orders || ordersRes.value?.data || [];
        setOrders(Array.isArray(rawOrders) ? rawOrders : []);
      }
    } catch (err) {
      console.error("Error fetching mobile UGC data:", err);
      toast.error("Couldn't load your UGC briefs and orders. Please try again."); // v332: calm copy
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Keep selected order synchronized with orders list
  useEffect(() => {
    if (selectedOrderId && orders.length > 0) {
      const found = orders.find(o => String(o.id) === String(selectedOrderId));
      if (found) setSelectedOrder(found);
    }
  }, [selectedOrderId, orders]);

  // Filtered Briefs
  const filteredBriefs = useMemo(() => {
    if (!briefSearch.trim()) return briefs;
    const q = briefSearch.toLowerCase();
    return briefs.filter(b => 
      (b.title || "").toLowerCase().includes(q) ||
      (b.product_name || "").toLowerCase().includes(q)
    );
  }, [briefs, briefSearch]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Stage mapping
      const stage = (o.stage || o.status || "").toUpperCase();
      // Session 58 (bug hunt): live links waiting for payout approval were hidden from "Review", and orders waiting
      // for a live link / a revision from "In progress" (they only showed under All).
      if (orderFilter === "review" && !["IN_REVIEW", "SUBMITTED", "REVISION_DECLINED", "LIVE_LINK_SUBMITTED", "LINKS_UNDER_REVIEW", "REVISION_DECLINED_LINKS"].includes(stage)) return false;
      if (orderFilter === "in_progress" && !["IN_PROGRESS", "ACCEPTED", "CLAIMED", "AWAITING_LIVE_LINK", "REVISION_REQ", "REVISION_REQUESTED", "REVISION_REQUESTED_LINKS"].includes(stage)) return false;
      if (orderFilter === "done" && stage !== "COMPLETED" && stage !== "PAID") return false;

      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        const matches = 
          (o.title || o.brief?.title || o.campaign_title || "").toLowerCase().includes(q) ||
          (o.creator_name || o.creatorName || "").toLowerCase().includes(q) ||
          String(o.order_number || o.id || "").toLowerCase().includes(q); // v332: numeric ids crashed the search
        if (!matches) return false;
      }
      return true;
    });
  }, [orders, orderFilter, orderSearch]);

  // Handle Resume Draft
  const handleResumeDraft = () => {
    try {
      const draft = draftGet("ugc_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        const loaded = parsed.formData || parsed;
        setPostData(prev => ({
          ...prev,
          ...loaded,
          dos: Array.isArray(loaded.dos) ? loaded.dos : [],
          donts: Array.isArray(loaded.donts) ? loaded.donts : []
        }));
        if (parsed.step) {
          setPostStep(parsed.step);
        }
        toast.success("Resumed saved draft");
      }
    } catch (e) {
      console.error(e);
    }
    setFabOpen(false);
    setView("post");
  };

  // Handle New Brief Start
  const handleStartNewBrief = () => {
    draftRemove("ugc_draft");
    setHasDraft(false);
    setDraftInfo(null);
    setPostData({
      title: "",
      product_name: "",
      product_description: "",
      detailed_requirements: "",
      product_url: "",
      sample_content_url: "",
      deliverable_type: "collaboration_reel",
      video_duration: "30s",
      budget: getMinBudget("collaboration_reel"),
      max_creators: 1,
      delivery_hours: DEFAULT_DELIVERY_HOURS,
      dos: [],
      donts: []
    });
    setPostStep(1);
    setFabOpen(false);
    setView("post");
  };

  // AI Brief Generator / Enhancer
  const handleGenerateWithAi = async (customPrompt = "") => {
    setAiGenerating(true);
    toast.loading("Generating high-converting UGC brief with AI...", { id: "ai-brief" });
    try {
      const res = await api.post("/ugc/ai-generate-brief", {
        product_name: postData.product_name || customPrompt || "D2C Product",
        focus_area: customPrompt || "Authentic viral conversion",
        current_title: postData.title,
        current_requirements: postData.detailed_requirements
      });

      if (res.data?.ok && res.data?.data) {
        const ai = res.data.data;
        setPostData(prev => ({
          ...prev,
          title: ai.title || prev.title,
          product_name: prev.product_name || ai.product_name || prev.product_name,
          product_description: ai.product_description || prev.product_description,
          detailed_requirements: ai.detailed_requirements || prev.detailed_requirements,
          dos: Array.isArray(ai.dos) && ai.dos.length > 0 ? ai.dos : prev.dos,
          donts: Array.isArray(ai.donts) && ai.donts.length > 0 ? ai.donts : prev.donts,
          // v358: keep the format / length the brand chose (AI used to switch UGC video → collab reel silently)
          deliverable_type: prev.deliverable_type || ai.recommended_format,
          video_duration: prev.video_duration || ai.recommended_duration
        }));
        toast.success("AI brief generated! Review and tweak below.", { id: "ai-brief" });
        setShowAiAssist(false);
      } else {
        toast.error("Couldn't generate a brief right now. Please try again.", { id: "ai-brief" }); // v332: no tech wording
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      toast.error("Couldn't reach Ybex Eva right now. Your brief is unchanged — please try again.", { id: "ai-brief" }); // v332: nothing was "applied"
    } finally {
      setAiGenerating(false);
    }
  };

  const postingRef = React.useRef(false);
  const payBusyRef = React.useRef(false); // Session 56: blocks a second payment while one is open
  const [paying, setPaying] = useState(false); // v358: visible busy state (the ref alone made the button look dead)
  const stopWatchRef = React.useRef(null);
  React.useEffect(() => () => { if (stopWatchRef.current) stopWatchRef.current(); }, []);

  // Submit Brief and Process Payment (Step 5 -> Screen 08 -> Pay)
  // Posts the brief against a PAID order. Returns true when the brief exists.
  const postBriefWithOrder = async (orderId, paymentId, finalBudget, totalEscrow) => {
    // Session 26: one post per payment even if the checkout callback and the safety net both fire.
    if (postingRef.current) return false;
    postingRef.current = true;
    if (stopWatchRef.current) { stopWatchRef.current(); stopWatchRef.current = null; }
    const cleanDos = (postData.dos || []).filter(d => typeof d === 'string' && d.trim().length > 0);
    const cleanDonts = (postData.donts || []).filter(d => typeof d === 'string' && d.trim().length > 0);
    toast.loading("Securing brief & placing funds in secure payment hold...", { id: "ugc-pay" });
    try {
      await api.post("ugc/briefs", {
        ...postData,
        title: postData.title || `Review of ${postData.product_name || "Product"}`,
        dos: cleanDos,
        donts: cleanDonts,
        budget: finalBudget,
        total_budget: totalEscrow,
        // The server creates the brief only against this PAID order — no invented payment id.
        razorpay_order_id: orderId || null,
        payment_id: paymentId || null
      });
      clearPaidBriefOrder();
      draftRemove("ugc_draft");
      setHasDraft(false);
      setDraftInfo(null); // v345
      toast.success("Brief posted successfully! Certified creators notified.", { id: "ugc-pay" });
      setView("main");
      setActiveTab("briefs");
      fetchData();
      // Session 31: move the URL to My Briefs too (it stayed on /brand/ugc/post, so the checkout's
      // "back" or a refresh showed an empty Create brief form).
      if (location.pathname.startsWith("/brand/ugc/post")) goToPostedBriefs(navigate);
      return true;
    } catch (err) {
      postingRef.current = false;
      console.error("Failed to save brief after payment:", err);
      const code = err?.response?.data?.code;
      if (FINAL_ORDER_CODES.includes(code)) {
        clearPaidBriefOrder();
        toast.error(`${err?.response?.data?.error || "This payment can't be used for the brief."} Contact support if you were charged.`, { id: "ugc-pay", duration: 10000 });
      } else {
        savePaidBriefOrder(orderId, totalEscrow);
        toast.error("Payment received, but the brief couldn't be saved. Tap “Secure brief & pay” again to retry — you won't be charged again.", { id: "ugc-pay", duration: 10000 });
      }
      return false;
    }
  };

  const handleProceedPayment = async () => {
    const minBudget = getMinBudget(postData.deliverable_type);
    // v346: a budget under the minimum is an error, not silently raised to the minimum
    if (!(Number(postData.budget) >= minBudget)) {
      toast.error(`Budget per video must be at least ₹${minBudget.toLocaleString("en-IN")}.`);
      setShowLivePreview(false); setPostStep(4);
      return;
    }
    const finalBudget = Math.max(postData.budget, minBudget);
    const totalEscrow = finalBudget * postData.max_creators;

    setShowLivePreview(false);

    // Session 56 (payment audit): one payment at a time — a second tap while the checkout is open
    // (or during the UPI app switch) is ignored instead of starting a second payment.
    if (payBusyRef.current) return;
    payBusyRef.current = true;
    setPaying(true);
    try {
    // Already paid on this device but the brief wasn't saved → post it, don't charge again.
    const paid = getPaidBriefOrder();
    if (paid) {
      await postBriefWithOrder(paid.order_id, null, finalBudget, totalEscrow);
      return;
    }
    // Session 56: an order from an earlier try that got paid after the app closed → use it.
    const recovered = await recoverPendingBriefOrder();
    if (recovered) {
      await postBriefWithOrder(recovered, null, finalBudget, totalEscrow);
      return;
    }

    toast.loading("Opening secure checkout…", { id: "ugc-pay" });
    postingRef.current = false;

    try {
      await processRazorpayPayment({
        onOrderCreated: (orderId) => {
          savePendingBriefOrder(orderId, totalEscrow);
          // Safety net: payment done but the success callback never came → post anyway.
          stopWatchRef.current = watchPaidOrder(checkBriefOrderPaid, orderId, (paidId) => {
            savePaidBriefOrder(paidId, totalEscrow);
            postBriefWithOrder(paidId, null, finalBudget, totalEscrow);
          });
        },
        grossAmount: totalEscrow,
        amount: totalEscrow,
        couponCode: ugcFee.couponCode || "", // v364
        method: ugcMethod, // v366
        description: `Ybex UGC Secure payment hold: ${postData.title || postData.product_name || "Brief"}`,
        notes: {
          product_name: postData.product_name,
          format: postData.deliverable_type,
          creators: postData.max_creators
        },
        user: {
          name: user?.name || user?.company_name || "Brand Partner",
          email: user?.email || "",
          phone: user?.phone || ""
        },
        onSuccess: async (paymentData) => {
          const orderId = paymentData?.order_id || paymentData?.razorpay_order_id || null;
          // Keep it before posting, so a crash or closed tab can still recover it.
          savePaidBriefOrder(orderId, totalEscrow);
          await postBriefWithOrder(orderId, paymentData?.razorpay_payment_id || paymentData?.payment_id || null, finalBudget, totalEscrow);
        },
        onError: (err) => {
          // v358: no raw checkout / server text
          if (/closed|cancel|dismiss/i.test(String(err?.message || ""))) toast.info("Payment cancelled — nothing was charged.", { id: "ugc-pay" });
          else toast.error("Payment didn't go through. If money was debited it won't be charged twice — tap Secure brief & pay again.", { id: "ugc-pay" });
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't open the payment. Please try again.", { id: "ugc-pay" }); // v332: calm copy
    }
    } finally {
      payBusyRef.current = false;
      setPaying(false);
    }
  };

  // Approve Order (draft or live link escrow release)
  const handleApproveOrder = async (orderId, action = null) => {
    if (approvingOrder) return;
    const isDraft = action === 'approve_draft';
    // v344: the Approve buttons already ask (with the amount) — a second confirm here asked twice.
    setApprovingOrder(true);
    toast.loading(isDraft ? "Approving video draft..." : "Releasing secure payment hold payout to creator...", { id: "ugc-approve" });
    try {
      const payload = action ? { action } : {};
      const res = await api.post(`/ugc/orders/${orderId}/approve`, payload);
      if (isDraft || res.data?.message?.includes("Awaiting live links")) {
        toast.success("Video draft approved! Creator notified to post live link.", { id: "ugc-approve" });
      } else {
        toast.success("Payout released! Order completed.", { id: "ugc-approve" });
        setApprovedOrderData(selectedOrder);
        setShowApprovedModal(true);
      }
      await fetchData();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || "Couldn't approve right now. Please try again.", { id: "ugc-approve" }); // v332
    } finally {
      setApprovingOrder(false);
    }
  };

  // Submit Revision
  const handleSubmitRevision = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!revisionNotes.trim()) {
      toast.error("Please enter revision instructions.");
      return;
    }

    setSubmittingRevision(true);
    toast.loading("Sending revision request...", { id: "ugc-rev" });
    try {
      // Same rule as desktop BrandUGCOrders: in the live-link stage this is a LINK correction,
      // not a draft revision. Without the action the server spent a draft revision and asked
      // the creator to re-upload a video the brand had already approved (session 23).
      const st = String(selectedOrder.brand_status || selectedOrder.stage || selectedOrder.status || "").toUpperCase();
      const fl = String(selectedOrder.flow_state || selectedOrder.thread_flow_state || "").toUpperCase();
      const isLiveLinkStage =
        ["LIVE_LINK_SUBMITTED", "PROOF_SUBMITTED", "LINKS_UNDER_REVIEW", "AWAITING_LIVE_LINK", "REVISION_REQUESTED_LINKS"].includes(st) ||
        fl === "PROOF_SUBMITTED";
      await api.post(`/ugc/orders/${selectedOrder.id}/revision`, {
        notes: revisionNotes.trim(),
        ...(isLiveLinkStage ? { action: "reject_live_links" } : {})
      });
      toast.success("Revision requested! Creator notified.", { id: "ugc-rev" });
      setShowRevisionModal(false);
      setRevisionNotes("");
      await fetchData();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || "Couldn't send the change request. Please try again.", { id: "ugc-rev" }); // v332
    } finally {
      setSubmittingRevision(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: SUB-VIEWS
  // ----------------------------------------------------

  // SCREEN 10: Order Detail View
  if (view === "order-detail" && selectedOrder) {
    const rawStatus = (selectedOrder.brand_status || selectedOrder.stage || selectedOrder.status || "IN_PROGRESS").toUpperCase();
    const thrFlow = (selectedOrder.flow_state || selectedOrder.thread_flow_state || selectedOrder.thread_status || '').toUpperCase();
    const isLiveLinkRevision = rawStatus === 'REVISION_REQUESTED_LINKS' || thrFlow === 'REVISION_REQUESTED_LINKS';
    const isLiveLinkDeclined = rawStatus === 'REVISION_DECLINED_LINKS' || thrFlow === 'REVISION_DECLINED_LINKS';
    const liveLink = selectedOrder.live_link || (Array.isArray(selectedOrder.live_links) ? selectedOrder.live_links[0] : selectedOrder.live_links) || (selectedOrder.proof && (selectedOrder.proof.live_link || selectedOrder.proof.link)) || null;
    const deliverableType = String(selectedOrder.deliverable_type || selectedOrder.brief?.deliverable_type || "collaboration_reel").toLowerCase();
    const isCollabOrder = selectedOrder.requires_live_link !== undefined
      ? Boolean(selectedOrder.requires_live_link)
      : (selectedOrder.is_collaboration !== undefined
        ? Boolean(selectedOrder.is_collaboration)
        : (!deliverableType.includes('raw') && !deliverableType.includes('edited') && !deliverableType.startsWith('ugc_video')));

    const hasLiveLink = isCollabOrder && Boolean(liveLink || selectedOrder.live_links_submitted);
    const isContentApproved = isCollabOrder && (Boolean(selectedOrder.draft_approved_at) || rawStatus === 'CONTENT_APPROVED' || rawStatus === 'COMPLETED_APPROVAL' || rawStatus === 'AWAITING_LIVE_LINK' || thrFlow === 'CONTENT_APPROVED' || selectedOrder.content_approved === true || selectedOrder.isApproved === true || isLiveLinkRevision || isLiveLinkDeclined);
    const isLiveLinkSubmitted = isCollabOrder && !isLiveLinkRevision && !isLiveLinkDeclined && Boolean(hasLiveLink || rawStatus === 'PROOF_SUBMITTED' || rawStatus === 'LIVE_LINK_SUBMITTED' || rawStatus === 'LINKS_UNDER_REVIEW' || thrFlow === 'PROOF_SUBMITTED');
    const isAwaitingLiveLink = isCollabOrder && isContentApproved && !isLiveLinkSubmitted && !isLiveLinkRevision && !isLiveLinkDeclined;
    const isCompleted = rawStatus === "COMPLETED" || rawStatus === "PAID" || rawStatus === "RELEASED" || thrFlow === "COMPLETED" || Boolean(selectedOrder.utr_number || selectedOrder.utrNumber) || (!isCollabOrder && (Boolean(selectedOrder.draft_approved_at) || rawStatus === 'CONTENT_APPROVED' || selectedOrder.content_approved === true));
    // v358: closed orders (cancelled / expired / refunded) and the creator-revision states have their own screens —
    // they used to show "In Production · Step 1 of 4", a red "Past deadline" banner and "Held with Ybex SafePay".
    const statusUp = String(selectedOrder.status || "").toUpperCase();
    const isClosed = !isCompleted && (["CANCELLED", "EXPIRED", "REFUNDED"].includes(statusUp) || ["CANCELLED", "EXPIRED", "REFUNDED"].includes(rawStatus) || ["CANCELLED", "EXPIRED", "REFUNDED"].includes(thrFlow));
    const isVideoRevision = !isClosed && !isCompleted && (rawStatus === "REVISION_REQUESTED" || rawStatus === "REVISION_REQ" || rawStatus === "IN_REVISION" || thrFlow === "REVISION_REQUESTED");
    const isVideoDeclined = !isClosed && !isCompleted && (rawStatus === "REVISION_DECLINED" || rawStatus === "DECLINED_REVISION" || rawStatus === "RESUBMISSION_DECLINED" || thrFlow === "REVISION_DECLINED");
    const declineReason = selectedOrder.decline_reason || (isLiveLinkDeclined ? selectedOrder.decline_notes_links : "") || "";
    const revisionNotesShown = (isLiveLinkRevision ? (selectedOrder.revision_notes_links || selectedOrder.revision_notes) : selectedOrder.revision_notes) || "";
    const closedText = String(selectedOrder.expiry_reason || "") === "BRAND_CANCELLED"
      ? "You cancelled this order. The refund for this slot is in progress (1–2 working days)."
      : String(selectedOrder.expiry_reason || "").startsWith("CREATOR_CANCELLED")
        ? "The creator stepped away before sending a draft. Your brief is back at the top for other creators and the payment stays with Ybex SafePay."
        : "No draft arrived by the deadline, so this order was closed. Your brief is back at the top for other creators and the payment stays with Ybex SafePay.";
    const isInReview = !isClosed && !isVideoRevision && !isCompleted && !isAwaitingLiveLink && !isLiveLinkSubmitted && !isLiveLinkRevision && (rawStatus === "IN_REVIEW" || rawStatus === "SUBMITTED" || rawStatus === "CONTENT_SUBMITTED" || rawStatus === "DELIVERED" || selectedOrder.submission_link || selectedOrder.video_url);

    const sla = getSlaTimeLeft(selectedOrder.deadline || selectedOrder.internal_deadline || selectedOrder.sla_deadline, orderWindowHours(selectedOrder));
    // Server amounts only — this figure is shown in the "release payout" confirmation.
    const amount = Number(selectedOrder.amount || selectedOrder.agreed_amount || selectedOrder.creator_payout || selectedOrder.budget || 0);
    const orderNumber = selectedOrder.order_number || selectedOrder.orderNumber || `#ORD-${String(selectedOrder.id).slice(-6).toUpperCase()}`;
    const deliverableUrl = selectedOrder.deliverable_url || selectedOrder.submission_url || selectedOrder.video_url || selectedOrder.submission_link;

    return (
      <div className="min-h-screen bg-[#F2F2F7] text-[#0A0A0A] font-['DM_Sans'] pb-28 relative">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E5EA] px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setSelectedOrderId(null);
                setView("main");
                setActiveTab("orders");
              }}
              className="w-10 h-10 rounded-full bg-[#F2F2F7] active:bg-[#E5E5EA] flex items-center justify-center text-[#0A0A0A] transition-all cursor-pointer"
              aria-label="Back" // v330
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6D28D9] bg-[#F1E8FF] px-2 py-0.5 rounded-md">
                  {orderNumber}
                </span>
              </div>
              <h2 className="text-sm font-bold text-[#0A0A0A] line-clamp-1 max-w-[200px]">
                {selectedOrder.title || selectedOrder.brief?.title || selectedOrder.brief?.product_name || selectedOrder.campaign_title || "UGC Order"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSupportModal(true)}
              className="w-10 h-10 rounded-full bg-[#F1E8FF] text-[#7C3AED] flex items-center justify-center active:scale-95 transition-all shadow-xs cursor-pointer"
              title="Order help" // v332: it opens order help, not the chat; 40px
              aria-label="Order help" // v330
            >
              <MessageCircle size={18} />
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* Progress Stage Tracker (4 steps) */}
          <div className="bg-white rounded-[20px] p-4 border border-[#E5E5EA] shadow-xs">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                {isClosed ? "Order closed" : isCompleted ? "Order Completed" : isLiveLinkSubmitted ? "Live Post Review" : isLiveLinkRevision ? "Waiting for the corrected link" : isAwaitingLiveLink ? "Draft Approved • Waiting for Live Link" : isVideoRevision ? "Waiting for the revised video" : isVideoDeclined || isLiveLinkDeclined ? "Creator declined your changes" : isInReview ? "Draft Video Review" : "In Production"}
              </span>
              {!isClosed && (
              <span className="text-[11px] font-bold text-[#7C3AED]">
                {isCollabOrder
                  ? (isCompleted ? "Step 4 of 4" : isLiveLinkSubmitted ? "Step 3 of 4" : isAwaitingLiveLink ? "Step 2 of 4" : isInReview ? "Step 2 of 4" : "Step 1 of 4")
                  : (isCompleted ? "Step 3 of 3" : isInReview ? "Step 2 of 3" : "Step 1 of 3") /* v358: raw / edited UGC has no live post step */}
              </span>
              )}
            </div>
            
            {/* Steps progress bar — v358: 4 steps for collab reels, 3 for raw / edited UGC */}
            <div className={`grid ${isCollabOrder ? "grid-cols-4" : "grid-cols-3"} gap-1.5 mb-2`}>
              <div className={`h-1.5 rounded-full ${!isClosed ? 'bg-[#7C3AED]' : 'bg-gray-200'}`} />
              <div className={`h-1.5 rounded-full ${!isClosed && (isInReview || isAwaitingLiveLink || isLiveLinkSubmitted || isCompleted) ? 'bg-[#7C3AED]' : 'bg-[#E5E5EA]'}`} />
              {isCollabOrder && <div className={`h-1.5 rounded-full ${isLiveLinkSubmitted || isCompleted ? 'bg-[#7C3AED]' : 'bg-[#E5E5EA]'}`} />}
              <div className={`h-1.5 rounded-full ${isCompleted ? 'bg-[#10B981]' : 'bg-[#E5E5EA]'}`} />
            </div>

            <div className="flex justify-between text-[9.5px] font-bold text-[#9CA3AF] uppercase tracking-wider">
              <span className={isClosed ? "" : "text-[#7C3AED]"}>Draft</span>
              <span className={!isClosed && (isInReview || isAwaitingLiveLink || isLiveLinkSubmitted || isCompleted) ? "text-[#7C3AED]" : ""}>Approve</span>
              {isCollabOrder && <span className={isLiveLinkSubmitted || isCompleted ? "text-[#7C3AED]" : ""}>Live Link</span>}
              <span className={isCompleted ? "text-[#10B981]" : ""}>Paid</span>
            </div>
          </div>

          {/* Creator Info Card — session 24 designed card (real stats only) */}
          <CreatorCard
            variant="mobile"
            creatorId={selectedOrder.creator_id || selectedOrder.creator_user_id}
            name={selectedOrder.creator_name || selectedOrder.creatorName}
            avatar={selectedOrder.creator_avatar}
            status={isCompleted ? `Paid out · ₹${amount.toLocaleString("en-IN")}` : isClosed ? `Order closed · ₹${amount.toLocaleString("en-IN")}` : `Held with Ybex SafePay · ₹${amount.toLocaleString("en-IN")}`} /* v332: a finished order isn't "held" any more · v358: nor a closed one */
            onChat={() => navigate(`/brand/inbox?thread=${selectedOrder.thread_id || selectedOrder.id}`)}
          />
          <button
            onClick={() => setShowSupportModal(true)}
            className="-mt-1 self-start text-[12px] font-semibold text-[#6B7280] underline underline-offset-2"
          >
            Need help with this order?
          </button>

          {/* SLA Countdown Banner — v332: only while the first draft is still due (it showed a red, pulsing
              "SLA Exceeded" on approved / completed orders) */}
          {!isCompleted && !isClosed && !isVideoRevision && !isVideoDeclined && !isInReview && !isAwaitingLiveLink && !isLiveLinkSubmitted && !isLiveLinkRevision && !isLiveLinkDeclined && ( /* v358: not on closed / revision orders */
          <div className="bg-white rounded-[20px] p-4 border border-[#E5E5EA] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0A0A0A]">
                <Clock size={15} className="text-[#7C3AED]" />
                <span>Time left for the draft</span>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                sla.isUrgent ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse' : 'bg-[#F1E8FF] text-[#6D28D9]'
              }`}>
                {sla.text}
              </span>
            </div>
            <div className="w-full bg-[#E5E5EA] h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${sla.isUrgent ? 'bg-rose-500' : 'bg-[#7C3AED]'}`}
                style={{ width: `${sla.percent}%` }}
              />
            </div>
          </div>
          )}

          {/* Session 25 (rule 52): cancel one order — only 24h+ after the claim, no draft, no fee. */}
          {!isInReview && !isCompleted && !isClosed && !isVideoRevision && !isVideoDeclined && !isAwaitingLiveLink && !isLiveLinkSubmitted && (
            <BrandCancelOrderButton order={selectedOrder} onOpen={() => setShowCancelOrder(true)} />
          )}
          <Presence>{showCancelOrder && (
            <BrandCancelOrderModal key="brandcancelordermodal"
              mobile
              order={selectedOrder}
              amount={selectedOrder.brief?.budget || amount}
              onClose={() => setShowCancelOrder(false)}
              onCancelled={() => {
                setShowCancelOrder(false);
                setSelectedOrderId(null);
                setView("main");
                setActiveTab("orders");
                fetchData(true);
              }}
            />
          )}</Presence>

          {/* v358: why a closed order closed (same words as desktop) */}
          {isClosed && (
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-xs font-bold text-slate-900">Order closed</div>
              <p className="text-xs text-slate-700 leading-relaxed mt-1">{closedText}</p>
            </div>
          )}
          {/* v358: what the creator said when they declined, and what you asked for */}
          {(isVideoDeclined || isLiveLinkDeclined) && (
            <div className="bg-rose-50 border border-rose-200 rounded-[18px] p-4">
              <div className="text-xs font-bold text-rose-900">Creator declined your changes</div>
              <p className="text-xs text-rose-800 leading-relaxed mt-1">{declineReason ? `"${declineReason}"` : "No reason given."} You can approve the current {isLiveLinkDeclined ? "link" : "video"} or get help from Ybex.</p>
            </div>
          )}
          {(isVideoRevision || isLiveLinkRevision) && revisionNotesShown && (
            <div className="bg-amber-50 border border-amber-200 rounded-[18px] p-4">
              <div className="text-xs font-bold text-amber-900">You asked for</div>
              <p className="text-xs text-amber-800 leading-relaxed mt-1 whitespace-pre-line">{revisionNotesShown}</p>
            </div>
          )}

          {/* Deliverable Video Preview Card */}
          <DeliverablePreviewCard deliverableUrl={deliverableUrl} isCompleted={isCompleted} isPlayableDeliverable={isPlayableDeliverable} selectedOrder={selectedOrder} isCollabOrder={isCollabOrder} pendingLabel={isClosed ? "Closed" : isVideoRevision ? "Changes asked" : isVideoDeclined ? "Creator declined" : (isAwaitingLiveLink || isLiveLinkSubmitted || isLiveLinkRevision || isLiveLinkDeclined) ? "Draft approved" : undefined} />

          {/* v358: the live post itself — the brand used to approve & release money without seeing it */}
          {isCollabOrder && liveLink && (
            <div className="bg-white rounded-[18px] p-4 border border-[#E5E5EA] shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Live post</div>
                <div className="text-xs font-semibold text-[#0A0A0A] truncate">{String(liveLink).replace(/^https?:\/\//, "")}</div>
              </div>
              <a href={liveLink} target="_blank" rel="noopener noreferrer" className="shrink-0 bg-[#7C3AED] text-white text-xs font-bold px-3 min-h-[40px] rounded-lg flex items-center">Open post ↗</a>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Bar */}
        {/* v330: clears the iPhone home bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-30 shadow-lg space-y-2">
          {!isCompleted ? (
            isLiveLinkRevision ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>Live link revision requested. Waiting for creator to submit updated link...</span>
                </div>
                <button 
                  onClick={() => setShowSupportModal(true)}
                  className="bg-amber-600 text-white font-bold px-3 min-h-[40px] rounded-lg text-xs shrink-0"
                >
                  Help{/* v332: opens order help, not the chat */}
                </button>
              </div>
            ) : isAwaitingLiveLink ? (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
                  <span>Waiting for live link from creator...</span>
                </div>
                <button 
                  onClick={() => setShowSupportModal(true)}
                  className="bg-indigo-600 text-white font-bold px-3 min-h-[40px] rounded-lg text-xs shrink-0"
                >
                  Help{/* v332 */}
                </button>
              </div>
            ) : isVideoRevision ? (
              /* v358: changes asked — the creator's turn, nothing to approve */
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>Waiting for the creator's revised video.</span>
                </div>
                <button onClick={() => setShowSupportModal(true)} className="bg-amber-600 text-white font-bold px-3 min-h-[40px] rounded-lg text-xs shrink-0">Help</button>
              </div>
            ) : !(isInReview || isLiveLinkSubmitted || isLiveLinkDeclined || isVideoDeclined) || isClosed ? (
              /* Session 58: nothing to approve yet (in production / expired / cancelled) — every tap used to fail. */
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                {isClosed ? "This order is closed — details above." : "Waiting for the creator's video draft."}
              </div>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowRevisionModal(true)}
                  className="flex-1 bg-[#FEF7E0] hover:bg-[#FDE68A] text-[#92400E] border border-[#F7E3AE] font-bold py-3.5 px-4 rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} /> Request Revision
                </button>

                {isCollabOrder && !isLiveLinkSubmitted && !isLiveLinkDeclined ? ( /* Session 58: declined link changes → approve the existing link, not the draft again */
                  <button 
                    disabled={approvingOrder}
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to approve this video draft? The creator will be notified to publish the post and submit their live link.\n\n${APPROVE_NOTICE}`)) {
                        handleApproveOrder(selectedOrder.id, 'approve_draft');
                      }
                    }}
                    className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-3.5 px-4 rounded-xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {approvingOrder ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={16} strokeWidth={3} /> Approve Video Draft
                      </>
                    )}
                  </button>
                ) : (
                  <button 
                    disabled={approvingOrder}
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to approve and release the secure payment hold payout of ₹${amount.toLocaleString("en-IN")} to ${selectedOrder.creator_name || selectedOrder.creatorName || "the creator"}? This action cannot be reversed.\n\n${APPROVE_NOTICE}`)) {
                        handleApproveOrder(selectedOrder.id, isCollabOrder ? 'approve_live_links' : null);
                      }
                    }}
                    className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-3.5 px-4 rounded-xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {approvingOrder ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={16} strokeWidth={3} /> Approve & Release ₹{amount.toLocaleString("en-IN")}
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="flex items-center justify-between p-3 bg-[#E9F9EF] rounded-xl border border-[#BBF7D0] text-[#16A34A]">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 size={16} />
                <span>Order Approved & Secure Payment Hold Released</span>
              </div>
              {deliverableUrl && (
                <a 
                  href={mediaHref(deliverableUrl) /* v332: uploaded files are private — open through the media link */} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-[#16A34A] text-white px-3 py-2 rounded-lg text-xs font-bold shrink-0"
                >
                  Download
                </a>
              )}
            </div>
          )}
        </div>

        {/* Revision Modal */}
        <RevisionModal isLinkStage={isLiveLinkSubmitted || isLiveLinkDeclined} handleSubmitRevision={handleSubmitRevision} revisionNotes={revisionNotes} setRevisionNotes={setRevisionNotes} setShowRevisionModal={setShowRevisionModal} showRevisionModal={showRevisionModal} submittingRevision={submittingRevision} />

        {/* Screen 11: Approved Payout Modal */}
        <ApprovedPayoutModal amount={amount} deliverableUrl={deliverableUrl} selectedOrder={selectedOrder} setActiveTab={setActiveTab} setSelectedOrderId={setSelectedOrderId} setShowApprovedModal={setShowApprovedModal} setView={setView} showApprovedModal={showApprovedModal} />

        {/* Support/Chat Modal */}
        {showSupportModal && (
          <OrderSupportModal 
            isOpen={showSupportModal} 
            onClose={() => setShowSupportModal(false)} 
            thread={selectedOrder} /* v358: the modal reads `thread` — `orderId` was ignored, so tickets went out as "ORD-PENDING" with the creator's reasons */
            threadId={selectedOrder.thread_id || undefined}
            isUserBrand
          />
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // SCREEN 03 - 07: Post UGC Brief Wizard (Mobile)
  // ----------------------------------------------------
  if (view === "post") {
    const minBudget = getMinBudget(postData.deliverable_type);
    // v346: shown under the amount and blocks "Review & Pay" (an empty / ₹0 / negative budget used to become ₹1 silently)
    const budgetError = !(Number(postData.budget) >= minBudget) ? `Budget per video must be at least ₹${minBudget.toLocaleString("en-IN")}.` : "";
    const wordCountDesc = (postData.product_description || "").trim().split(/\s+/).filter(Boolean).length;
    const wordCountReq = (postData.detailed_requirements || "").trim().split(/\s+/).filter(Boolean).length;

    return (
      <div className="min-h-screen bg-[#F2F2F7] text-[#0A0A0A] font-['DM_Sans'] pb-28">
        {/* Post Wizard Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E5EA] px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (postStep > 1) setPostStep(s => s - 1);
                // v344: opened at /brand/ugc/post — leave that URL too, or Back looked dead
                else if (location.pathname.startsWith("/brand/ugc/post")) navigate("/brand/ugc/briefs", { replace: true });
                else setView("main");
              }}
              className="w-10 h-10 rounded-full bg-[#F2F2F7] active:bg-[#E5E5EA] flex items-center justify-center text-[#0A0A0A] transition-all cursor-pointer"
              aria-label="Back" // v330
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-[#0A0A0A]">Post UGC Brief</h2>
              <p className="text-[10px] text-[#6B7280]">Step {postStep} of 5</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Session 41 (Ravi): icons only — ⓘ how it works, 👁 preview */}
            <button
              type="button"
              onClick={openExplainer}
              aria-label="How it works"
              title="How it works"
              className="w-10 h-10 rounded-full bg-[#F1E8FF] text-[#7C3AED] flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Info size={17} />
            </button>
            <button 
              type="button"
              onClick={() => setShowLivePreview(true)}
              aria-label="Preview"
              title="Preview"
              className="w-10 h-10 rounded-full bg-[#F1E8FF] text-[#7C3AED] flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Eye size={17} />
            </button>
          </div>
        </header>
        <BriefSafetyExplainer open={explainerOpen} onClose={closeExplainer} reopened={explainerReopened} />

        {/* 5-Step Stepper Bar */}
        <div className="px-5 py-3 bg-white border-b border-[#E5E5EA] flex items-center justify-between">
          {[1, 2, 3, 4, 5].map(num => (
            <React.Fragment key={num}>
              <div 
                onClick={() => {
                  // Only allow jumping back, not forward past filled steps
                  if (num < postStep) setPostStep(num);
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  postStep === num 
                    ? 'bg-[#7C3AED] text-white shadow-sm ring-2 ring-[#7C3AED]/20' 
                    : postStep > num 
                      ? 'bg-[#10B981] text-white' 
                      : 'bg-[#F2F2F7] text-[#9CA3AF]'
                }`}
              >
                {postStep > num ? <Check size={13} strokeWidth={3} /> : num}
              </div>
              {num < 5 && (
                <div className={`h-0.5 flex-1 mx-1.5 rounded-full ${postStep > num ? 'bg-[#10B981]' : 'bg-[#E5E5EA]'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Wizard Step Content */}
        <div className="p-4 space-y-5">
          {/* STEP 1: Campaign Title & Detailed Requirements */}
          <BriefStepTitle postData={postData} postStep={postStep} setPostData={setPostData} setPostStep={setPostStep} setShowAiAssist={setShowAiAssist} wordCountReq={wordCountReq} />

          {/* STEP 2: Product Info */}
          <BriefStepProduct postData={postData} postStep={postStep} setPostData={setPostData} setPostStep={setPostStep} wordCountDesc={wordCountDesc} />

          {/* STEP 3: Format, Duration & Rules */}
          <BriefStepFormat SUGGESTED_DONTS={SUGGESTED_DONTS} SUGGESTED_DOS={SUGGESTED_DOS} postData={postData} postStep={postStep} setPostData={setPostData} setPostStep={setPostStep} />

          {/* STEP 4: Budget & Quantity */}
          {postStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[20px] p-5 border border-[#E5E5EA] shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    Budget per Video (₹)
                  </label>
                  <span className="text-[10px] font-bold text-[#7C3AED] bg-[#F1E8FF] px-2.5 py-1 rounded-full">
                    Min: ₹{minBudget.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Editable Manual Input with Currency Sign */}
                <div className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-3xl font-black text-[#7C3AED]">₹</span>
                    <input 
                      type="number"
                      min={minBudget}
                      max={500000}
                      value={postData.budget === 0 ? '' : postData.budget}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setPostData({ ...postData, budget: val });
                      }}
                      aria-invalid={Boolean(budgetError)}
                      placeholder={String(minBudget)}
                      className="text-4xl font-black text-[#0A0A0A] tracking-tight text-center bg-transparent border-b-2 border-dashed border-[#E5E5EA] focus:border-[#7C3AED] outline-none max-w-[200px]"
                    />
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-2">
                    Minimum required for {getFormatLabel(postData.deliverable_type)} is ₹{minBudget.toLocaleString("en-IN")} (Tap amount to type)
                  </p>
                  {budgetError && <p className="text-[12px] font-semibold text-red-600 mt-1" role="alert" data-testid="ugc-budget-error">{budgetError}</p>}
                </div>

                {/* Slider with smooth step */}
                <input 
                  type="range"
                  min={minBudget}
                  max={30000}
                  step={100}
                  value={postData.budget < minBudget ? minBudget : postData.budget}
                  onChange={(e) => setPostData({ ...postData, budget: Math.max(minBudget, Number(e.target.value)) })}
                  className="w-full accent-[#7C3AED]"
                />

                {/* Quick Add Pills */}
                <div className="flex justify-center gap-2 pt-1">
                  {[500, 1000, 2500, 5000].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setPostData({ ...postData, budget: (postData.budget || minBudget) + inc })}
                      className="text-[11px] font-bold px-3 min-h-[36px] rounded-lg bg-[#F2F2F7] text-[#3F3F46] hover:bg-[#E5E5EA] active:scale-95 transition-all cursor-pointer" /* v332: tap target */
                    >
                      +₹{inc.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>

                {/* Creator Count Selector */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">
                    Number of Creators Needed
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 5, 10].map(cnt => (
                      <button 
                        key={cnt}
                        type="button"
                        onClick={() => setPostData({ ...postData, max_creators: cnt })}
                        className={`py-2.5 rounded-xl border text-xs font-black transition-all ${
                          postData.max_creators === cnt
                            ? 'border-[#7C3AED] bg-[#F1E8FF] text-[#7C3AED] ring-2 ring-[#7C3AED]/20 shadow-xs'
                            : 'border-[#E5E5EA] bg-[#F9F9FB] text-[#3F3F46]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session 24: first-draft deadline the creator gets after claiming */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">
                    When do you need the video?
                  </label>
                  <div className="grid grid-cols-3 gap-2" data-testid="delivery-hours-picker">
                    {DELIVERY_OPTIONS.map(opt => {
                      const active = deliveryHoursOf(postData.delivery_hours) === opt.hours;
                      return (
                        <button
                          key={opt.hours}
                          type="button"
                          onClick={() => setPostData({ ...postData, delivery_hours: opt.hours })}
                          className={`relative py-2.5 rounded-xl border text-center transition-all ${
                            active
                              ? 'border-[#7C3AED] bg-[#F1E8FF] text-[#7C3AED] ring-2 ring-[#7C3AED]/20 shadow-xs'
                              : 'border-[#E5E5EA] bg-[#F9F9FB] text-[#3F3F46]'
                          }`}
                        >
                          {/* Session 41 (Ravi): Express costs nothing extra for now. */}
                          {opt.hours === 24 && (
                            <span className="ybex-shine absolute -top-2 -right-1.5 px-1.5 py-[1px] rounded-full bg-[#16A34A] text-white text-[9px] font-black tracking-wide shadow-sm" data-testid="express-free-badge">
                              FREE
                            </span>
                          )}
                          <span className="block text-xs font-black">{opt.label}</span>
                          <span className="block text-[10px] font-semibold opacity-80">{opt.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-[#6B7280]">The first draft is due this long after a creator claims.</p>
                </div>

                {/* Escrow total card */}
                <div className="bg-[#F8F4FF] border border-[#7C3AED]/20 rounded-xl p-3.5 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider">Total Payment Hold</span>
                    <p className="text-xs text-[#6B7280]">{postData.max_creators} creator{postData.max_creators === 1 ? "" : "s"} × ₹{formatAmount(postData.budget)}</p>{/* v332 */}
                  </div>
                  <span className="text-lg font-black text-[#7C3AED]">
                    ₹{(Math.max(Number(postData.budget) || 0, minBudget) * postData.max_creators).toLocaleString("en-IN") /* Session 58: the same total Razorpay charges */}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setPostStep(3)} 
                  className="flex-1 py-4 bg-[#F2F2F7] text-[#0A0A0A] rounded-2xl font-bold text-xs"
                >
                  Back
                </button>
                <button 
                  onClick={() => { if (budgetError) { toast.error(budgetError); return; } setPostStep(5); } /* v346 */}
                  className="flex-[2] py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
                >
                  Review & Pay
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Secure Escrow */}
          {postStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[20px] p-5 border border-[#E5E5EA] shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-black text-[#0A0A0A] leading-tight">
                    {postData.title || `Review of ${postData.product_name}`}
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">{postData.product_name}</p>
                </div>

                <div className="space-y-2.5 text-xs text-[#6B7280] pb-4 border-b border-[#E5E5EA]">
                  <div className="flex justify-between">
                    <span className="uppercase text-[10px] font-bold">Format</span>
                    <span className="font-bold text-[#7C3AED]">{getFormatLabel(postData.deliverable_type)}{postData.deliverable_type !== "ugc_video_raw" && postData.video_duration ? ` · ${postData.video_duration}` : ""}</span>{/* v332: raw clips have no duration */}
                  </div>
                  <div className="flex justify-between">
                    <span className="uppercase text-[10px] font-bold">Quantity</span>
                    <span className="font-bold text-[#0A0A0A]">{postData.max_creators} creator{postData.max_creators === 1 ? "" : "s"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="uppercase text-[10px] font-bold">First draft</span>
                    <span className="font-bold text-[#0A0A0A]">Within {deliveryHoursOf(postData.delivery_hours)} hours</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1">
                    <span className="uppercase text-[10px] font-bold text-[#0A0A0A]">Total Budget in Payment Hold</span>
                    <span className="text-[#7C3AED] font-black">₹{(Math.max(Number(postData.budget) || 0, minBudget) * postData.max_creators).toLocaleString("en-IN") /* Session 58: the same total Razorpay charges */}</span>
                  </div>
                </div>
                {/* v364 (Ravi: brand fee on UGC too): escrow · service fee · coupon · total — from the server, same as Razorpay */}
                {/* v366: Ravi's checkout — You pay + lines, then UPI apps / other ways */}
                <CheckoutDealCard testId="ugc-checkout-card" total={quoteTotal(ugcFee.quote, Math.max(Number(postData.budget) || 0, minBudget) * postData.max_creators)} note="Held in Ybex escrow. Each creator is paid only after you approve their video.">
                  <BrandFeeSummary grossAmount={Math.max(Number(postData.budget) || 0, minBudget) * postData.max_creators} onQuote={setUgcFee} compact variant="checkout" />
                </CheckoutDealCard>
                <CheckoutPicker value={ugcMethod} onChange={setUgcMethod} disabled={paying} />

                {/* Delivery Promise */}
                <div className="bg-[#F8F4FF] border border-[#7C3AED]/20 rounded-xl p-3.5 flex gap-3 text-xs text-[#6D28D9]">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-[#7C3AED]" />
                  <div>
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-[#7C3AED]">⚡ Delivery Promise</h5>
                    <p className="text-[#6D28D9]/80 text-[11px] mt-0.5 leading-relaxed">
                      {postData.deliverable_type === 'collaboration_reel'
                        ? "Creator sends a draft by the deadline → you approve it → they post it and share the live link → you approve the link and the payment is released." /* v358: the draft-review step was missing */
                        : `Creator delivers the video within ${deliveryHoursOf(postData.delivery_hours)} hours of claiming. You approve before any payment is released.`}
                    </p>
                    <p className="text-[#6D28D9]/80 text-[11px] mt-1 font-semibold">✓ Only KYC-verified creators can claim your brief.</p>
                  </div>
                </div>
              </div>

              <PayConsentLine />
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setPostStep(4)} 
                  className="flex-1 py-4 bg-[#F2F2F7] text-[#0A0A0A] rounded-2xl font-bold text-xs"
                >
                  Back
                </button>
                <button 
                  type="button"
                  onClick={() => setShowLivePreview(true)}
                  className="px-4 py-4 bg-[#F2F2F7] text-[#7C3AED] hover:bg-[#F1E8FF] rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Preview Card"
                  aria-label="Preview" // v332: icon-only on phones
                >
                  <Eye size={16} />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                <button 
                  type="button"
                  onClick={handleProceedPayment}
                  disabled={paying}
                  className="flex-[2] py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Lock size={13} /> {paying ? "Opening checkout…" : `Pay ₹${Math.round(quoteTotal(ugcFee.quote, Math.max(Number(postData.budget) || 0, minBudget) * postData.max_creators)).toLocaleString("en-IN")} · via ${choiceLabel(ugcMethod)}` /* v366 (was "Secure Brief & Pay") */}
                </button>
              </div>
              <RazorpayTrust style={{ marginTop: 10 }} />
            </div>
          )}
        </div>

        {/* Screen 08: Live Preview Bottom Sheet (Confirm before pay / preview button) */}
        <AnimatePresence>
          {showLivePreview && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowLivePreview(false)} 
                className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
              />
              <motion.div 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                exit={{ y: "100%" }} 
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative bg-white w-full rounded-t-[28px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 space-y-4 max-h-[90vh] max-h-[90dvh] overflow-y-auto" /* v330: iOS dvh + home bar */
              >
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto" />
                
                <div className="text-center">
                  <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-widest bg-[#F1E8FF] px-2.5 py-1 rounded-full">
                    How creators will see it
                  </span>
                </div>

                {/* Session 43 (Ravi: "the black preview — make it look like our app"): the exact card a
                    creator sees in Explore UGC, then what the brand pays and gets. */}
                <div className="bg-white border border-[#E6E6EE] rounded-[20px] p-4 shadow-[0_14px_30px_-24px_rgba(16,16,20,.5)]" data-testid="ugc-brief-preview-card">
                  <div className="flex items-center gap-2.5">
                    <BrandLogo src={user?.logo || user?.picture} name={user?.company_name || user?.name || "Brand"} size={34} radius={11} />
                    <div className="text-[14px] font-semibold text-[#0A0A0A] truncate">{user?.company_name || user?.name || "Your brand"}</div>
                  </div>
                  <div className="mt-3 text-[16px] font-bold leading-snug text-[#0A0A0A] line-clamp-2">{postData.title || "Your brief title"}</div>
                  <div className="mt-1 text-[12.5px] leading-[1.5] text-[#6B7280] line-clamp-3">{postData.product_description || "Product description shows here."}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-[7px] text-[10.5px] font-semibold bg-[#F1E8FF] text-[#6D28D9] border border-[#DDD6FE]">{getFormatLabel(postData.deliverable_type)}</span>
                    {postData.video_duration && postData.deliverable_type !== "ugc_video_raw" && <span className="px-2.5 py-1 rounded-[7px] text-[10.5px] font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">{postData.video_duration}</span>}
                    <span className="relative px-2.5 py-1 rounded-[7px] text-[10.5px] font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">⚡ {deliveryHoursOf(postData.delivery_hours, 24)}h delivery<span className="ybex-shine absolute -top-[7px] -right-[6px] h-[13px] px-[5px] rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EC4899] text-white text-[7.5px] font-extrabold tracking-[0.4px] leading-[13px] shadow-sm" data-testid="ugc-new-badge"><span className="relative z-[2]">NEW</span></span></span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F0F0F4]">
                    <div className="text-[22px] font-bold tracking-[-.5px] text-[#047857]">₹{formatAmount(postData.budget)}</div>
                    <div className="text-[11.5px] text-[#6B7280]">Guaranteed in secure payment hold</div>
                  </div>
                  <div className="mt-3 h-11 rounded-[13px] bg-[#7C3AED] text-white text-[13.5px] font-semibold flex items-center justify-center opacity-90">View brief &amp; claim →</div>
                </div>

                <div className="rounded-[16px] bg-[#F9F9FB] border border-[#ECECF0] p-3.5 flex flex-col gap-2 text-[13px]" data-testid="ugc-brief-preview-summary">
                  <div className="flex justify-between"><span className="text-[#6B7280]">Per creator</span><span className="font-semibold">₹{formatAmount(postData.budget)}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280]">Creators</span><span className="font-semibold">{postData.max_creators || 1}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280]">Delivery</span><span className="font-semibold">within {deliveryHoursOf(postData.delivery_hours, 24)} hours of claiming</span></div>
                  <div className="h-px bg-[#E5E5EA]" />
                  <div className="flex justify-between items-baseline"><span className="font-bold">You pay now</span><span className="text-[18px] font-extrabold">₹{(Math.max(Number(postData.budget) || 0, minBudget) * Number(postData.max_creators || 1)).toLocaleString("en-IN")}</span></div>
                  <div className="text-[11.5px] leading-snug text-[#6B7280]">Held safely by Ybex. A creator is paid only after you approve their video. Unclaimed slots follow the Refund Policy.</div>
                </div>

                {/* Bottom Buttons */}
                <div className="space-y-2 pt-2">
                  <PayConsentLine />
                  <button 
                    onClick={handleProceedPayment}
                    disabled={paying}
                    className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Lock size={14} /> {paying ? "Opening checkout… " : "Proceed & Pay "}₹{(Math.max(Number(postData.budget) || 0, minBudget) * postData.max_creators).toLocaleString("en-IN") /* Session 58: the same total Razorpay charges */}
                  </button>
                  <button 
                    onClick={() => setShowLivePreview(false)}
                    className="w-full py-3 bg-[#F2F2F7] text-[#0A0A0A] rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Back to editing
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Prompt Assistant Sheet */}
        <AiPromptSheet aiGenerating={aiGenerating} handleGenerateWithAi={handleGenerateWithAi} postData={postData} setShowAiAssist={setShowAiAssist} showAiAssist={showAiAssist} />
      </div>
    );
  }

  // ----------------------------------------------------
  // SCREEN 01 & 09: Main Mobile UGC Tabs (My Briefs / Orders)
  // ----------------------------------------------------
  return (
    // v330: pb-44 — the last card's "Manage order" button sat under the floating + button.
    <div className="min-h-screen bg-[#F2F2F7] text-[#0A0A0A] font-['DM_Sans'] pb-44 relative">
      {/* SCREEN 01 HEADER: Instant UGC BETA + Search + Refresh */}
      <UgcHomeHeader activeTab={activeTab} briefSearch={briefSearch} briefs={briefs} fetchData={fetchData} orderSearch={orderSearch} orders={orders} refreshing={refreshing} searchOpen={searchOpen} setActiveTab={setActiveTab} setBriefSearch={setBriefSearch} setOrderSearch={setOrderSearch} setSearchOpen={setSearchOpen} />

      {/* TAB CONTENT */}
      <div className="p-4 space-y-3.5">
        {/* ======================================================== */}
        {/* TAB: MY BRIEFS */}
        {/* ======================================================== */}
        {activeTab === "briefs" && (
          <div className="space-y-3.5">
            {/* v345 (tester: "Eva se UGC banaya tha, ab dikh nahi raha"): an unpaid brief — from Eva or half-written —
                used to sit only behind the + button. It now shows here until it is paid or discarded. */}
            {hasDraft && draftInfo && (
              <div className="bg-white rounded-[20px] p-4 border border-dashed border-[#C4B5FD] shadow-xs flex items-center gap-3" data-testid="ugc-draft-card">
                <div className="w-10 h-10 rounded-xl bg-[#F3EDFF] text-[#7C3AED] flex items-center justify-center shrink-0"><Film size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">Draft · not posted yet{draftInfo.fromEva ? " · made with Eva" : ""}</div>
                  <div className="text-[14.5px] font-semibold text-[#0A0A0A] truncate">{draftInfo.title}</div>
                  <div className="text-[12px] text-[#6B7280]">Pay to post it — creators can't see it before that.</div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button type="button" onClick={handleResumeDraft} className="h-9 px-3.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-bold">Resume</button>
                  <button type="button" onClick={() => { if (window.confirm("Delete this draft brief?")) { draftRemove("ugc_draft"); setHasDraft(false); setDraftInfo(null); } }} className="h-8 px-3 rounded-xl text-[12px] font-semibold text-[#6B7280]">Discard</button>
                </div>
              </div>
            )}
            {loading && briefs.length === 0 ? (
              <BrandBriefListSkeleton count={3} />
            ) : briefsError && briefs.length === 0 ? (
              // v330: the request failed — say so instead of "No Briefs Found / Post your first brief".
              <OfflineAware onRetry={() => fetchData(true)}>{/* v334: offline → OfflineState */}
              <div className="bg-white rounded-[20px] p-8 text-center border border-[#E5E5EA] shadow-xs space-y-3" data-testid="brand-briefs-error">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Couldn't load your briefs</h3>
                  <p className="text-xs text-[#6B7280] mt-1">Check your connection and try again.</p>
                </div>
                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 bg-[#7C3AED] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-60"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Try again
                </button>
              </div>
              </OfflineAware>
            ) : filteredBriefs.length === 0 ? (
              <div className="bg-white rounded-[20px] p-8 text-center border border-[#E5E5EA] shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F1E8FF] text-[#7C3AED] flex items-center justify-center mx-auto">
                  <Film size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">No Briefs Found</h3>
                  <p className="text-xs text-[#6B7280] mt-1 max-w-xs mx-auto">
                    {briefSearch ? "No briefs match your search query." : "Post your first brief to recruit verified creators and get UGC videos in 24–72 hours."}
                  </p>
                </div>
                <button 
                  onClick={handleStartNewBrief}
                  className="inline-flex items-center gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Plus size={14} /> Post First Brief
                </button>
              </div>
            ) : (
              filteredBriefs.map(brief => {
                const claimed = brief.claimed_count || 0;
                const max = brief.max_creators || 1;
                const isAssigned = claimed >= max;
                const formatLabel = getFormatLabel(brief.deliverable_type);
                // v332: a cancelled brief showed a pulsing "Finding Creator"
                const isCancelledBrief = String(brief.status || "").toUpperCase() === "CANCELLED";
                const budgetAmount = Number(brief.total_budget || brief.budget * max || brief.budget || 0);
                const applicantsCount = brief.applications_count || brief.applicants?.length || 0;

                return (
                  <div 
                    key={brief.id}
                    className="bg-white rounded-[18px] p-4 border border-[#E5E5EA] shadow-xs space-y-3"
                  >
                    {/* Status badge & format tag */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          String(brief.status || '').toUpperCase() === 'COMPLETED' 
                            ? 'bg-teal-500' 
                            : isCancelledBrief
                              ? 'bg-slate-400'
                              : isAssigned 
                              ? 'bg-[#7C3AED]' 
                              : 'bg-[#10B981] animate-pulse'
                        }`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          String(brief.status || '').toUpperCase() === 'COMPLETED'
                            ? 'bg-teal-50 text-teal-700'
                            : isCancelledBrief
                              ? 'bg-slate-100 text-slate-600'
                              : isAssigned 
                              ? 'bg-[#F1E8FF] text-[#6D28D9]' 
                              : 'bg-[#E9F9F1] text-[#047857]'
                        }`}>
                          {String(brief.status || '').toUpperCase() === 'COMPLETED' ? "Completed" : isCancelledBrief ? "Cancelled" : isAssigned ? "Creator Assigned" : "Finding Creator"}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#6D28D9] bg-[#F1E8FF] px-2 py-0.5 rounded-md">
                        {formatLabel}
                      </span>
                    </div>

                    {/* Brief Title & Product Name */}
                    <div>
                      <h3 className="text-sm font-bold text-[#0A0A0A] leading-snug break-words">
                        {brief.title || (brief.product_name ? `Review of ${brief.product_name}` : "UGC brief")}{/* v332: no "Review of undefined" */}
                      </h3>
                      {brief.product_name && (
                        <p className="text-xs text-[#6B7280] mt-0.5 font-medium">
                          Product: <span className="text-[#0A0A0A]">{brief.product_name}</span>
                        </p>
                      )}
                    </div>

                    {/* Budget & Escrow Block */}
                    <div className="bg-[#F9F9FB] border border-[#ECECF0] rounded-[13px] p-3 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Budget & Payment Hold</span>
                          <span className="text-sm font-black text-[#0A0A0A]">₹{budgetAmount.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#7C3AED]">
                            Recruited ({claimed}/{max})
                          </span>
                          {/* v330: said "24h" even for 48h / 72h briefs */}
                          <p className="text-[9.5px] text-[#6B7280] font-medium">Delivery in {deliveryHoursOf(brief.delivery_hours, 24)}h{/* v360: plain words (was "SLA Guarantee") */}</p>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full bg-[#E5E5EA] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#7C3AED] rounded-full transition-all"
                          style={{ width: `${Math.min(100, (claimed / max) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button 
                        onClick={() => {
                          setActiveBriefForApplicants(brief);
                          setShowApplicantsSheet(true);
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-white border border-[#E5E5EA] text-[#3F3F46] font-bold text-xs flex items-center justify-center gap-1.5 active:bg-[#F2F2F7] transition-all cursor-pointer"
                      >
                        <Eye size={13} /> Creators ({applicantsCount}){/* v358: creators claim instantly — the sheet is "Claimed by" */}
                      </button>

                      <button 
                        onClick={() => {
                          // Switch to orders tab or filter by this brief
                          setOrderSearch(brief.title || brief.product_name || "");
                          setSearchOpen(true); // v344: show the filter so it can be cleared
                          setActiveTab("orders");
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Manage Orders</span> <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Cancel Brief / Refund Status */}
                    <div className="pt-2 flex items-center justify-between">
                      {brief.status === "CANCELLED" || brief.status === "PARTIALLY_CANCELLED" ? (
                        <BriefRefundStatus briefId={brief.id} compact />
                      ) : (max - claimed) > 0 ? (
                        <button
                          onClick={() => setSelectedBriefForCancel(brief)}
                          className="text-[11px] font-bold text-red-500 hover:text-red-600 active:underline flex items-center gap-1 ml-auto cursor-pointer min-h-[40px]" /* v332: tap target */
                        >
                          Cancel brief ({max - claimed} open)
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: ORDERS (SCREEN 02 & SCREEN 09) */}
        {/* ======================================================== */}
        <OrdersTab ordersError={ordersError} onRetry={() => fetchData(true)} refreshing={refreshing} activeTab={activeTab} filteredOrders={filteredOrders} getSlaTimeLeft={getSlaTimeLeft} handleStartNewBrief={handleStartNewBrief} loading={loading} orderFilter={orderFilter} orders={orders} setOrderFilter={setOrderFilter} setSelectedOrder={setSelectedOrder} setSelectedOrderId={setSelectedOrderId} setView={setView} />
      </div>

      {/* ======================================================== */}
      {/* SCREEN 01b: Floating Action Button (FAB) & Menu */}
      {/* ======================================================== */}
      <CreateFabMenu fabOpen={fabOpen} handleResumeDraft={handleResumeDraft} handleStartNewBrief={handleStartNewBrief} hasDraft={hasDraft} setFabOpen={setFabOpen} view={view} />

      {/* Applicants Bottom Sheet Modal */}
      <AnimatePresence>
        {showApplicantsSheet && activeBriefForApplicants && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowApplicantsSheet(false)} 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              className="relative bg-white w-full max-w-lg rounded-t-[28px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 space-y-4 max-h-[85vh] max-h-[85dvh] overflow-y-auto" /* v330 */
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto" />
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Claimed by</h3>
                  <p className="text-xs text-[#6B7280] break-words">{activeBriefForApplicants.title || activeBriefForApplicants.product_name || "UGC brief"}</p>
                </div>
                <button onClick={() => setShowApplicantsSheet(false)} aria-label="Close" className="text-gray-400 w-10 h-10 -mr-2 flex items-center justify-center">{/* v330: 40px tap target */}
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {activeBriefForApplicants.applicants && activeBriefForApplicants.applicants.length > 0 ? (
                  activeBriefForApplicants.applicants.map((app, idx) => (
                    <CreatorCard
                      key={app.creator_id || idx}
                      variant="mobile"
                      creatorId={app.creator_id || app.creator_user_id || app.creator?.id}
                      name={app.creator_name}
                      avatar={app.creator_avatar}
                      status={app.status ? String(app.status).replace(/_/g, " ").toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase()) : "Claimed" /* v330: no raw IN_PROGRESS */}
                      onNavigate={() => setShowApplicantsSheet(false)}
                      onManage={() => {
                        const cid = app.creator_id || app.creator_user_id || app.creator?.id;
                        const o = (orders || []).find((x) => x.brief_id === activeBriefForApplicants.id && x.creator_id === cid);
                        setShowApplicantsSheet(false);
                        // v332: keep the open order in sync with refreshes; if it isn't loaded, show the Orders tab
                        // filtered to this brief instead of silently doing nothing.
                        if (o) { setSelectedOrderId(o.id); setSelectedOrder(o); setView("order-detail"); }
                        else { setOrderSearch(activeBriefForApplicants.title || activeBriefForApplicants.product_name || ""); setActiveTab("orders"); }
                      }}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-[#6B7280] text-xs">
                    <p>No creator has claimed this brief yet.</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">
                      KYC-verified creators can see it now. They'll appear here once they claim.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Presence>{selectedBriefForCancel && (
        <CancelBriefModal key="cancelbriefmodal"
          isOpen={Boolean(selectedBriefForCancel)}
          brief={selectedBriefForCancel}
          onClose={() => setSelectedBriefForCancel(null)}
          onSuccess={() => fetchData(true)}
        />
      )}</Presence>
    </div>
  );
}
