import { api } from "./api";
import { parseMethodChoice, razorpayDisplayConfig } from "../components/payments/checkout/checkoutMethods"; // v366
import { toast } from "sonner";
import { serverOrigin } from "./native"; // v375: absolute logo address (the Android app's own origin is https://localhost)

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("Failed to load Razorpay SDK dynamically");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export async function processRazorpayPayment({
  dealId,
  threadId,
  campaignId,
  briefId,
  creatorId,
  grossAmount,
  amount,
  description,
  notes,
  user,
  onSuccess,
  onError,
  // Session 26: told the Razorpay order id as soon as it exists (used by the UGC brief page's
  // safety net, src/lib/briefPaymentRetry.js watchPaidOrder).
  onOrderCreated,
  // Session 58: the method the brand picked on Review & pay ("upi" | "card" | "netbanking") — Razorpay opens on it.
  method,
  // Session 58: the screen shows its own success page → no extra "verified" toasts on top of it.
  quiet = false,
  // v364: brand-fee coupon typed on Review & pay (checked again by the server)
  couponCode = "",
  // v366 (Ravi's checkout): told when Razorpay's window opens (the "Opening secure checkout" screen hands off), and
  // `cancel` = { cancelled } checked once the order exists — Cancel on that screen stops the window from opening.
  onOpen,
  cancel
}) {
  // v366: method may be a choice string ("upi:phonepe", "upi:collect", "card", …). Razorpay gets the plain method in
  // prefill (as before) plus a config.display block that opens on the picked app / flow (default list kept below it).
  const displayConfig = razorpayDisplayConfig(method);
  method = parseMethodChoice(method).method || method;
  // Session 56 (payment audit): the returned promise now finishes only when the payment is DONE —
  // paid, failed or the window closed — not right after the Razorpay window opens. The screens keep
  // their Pay button disabled until then, so a second tap (e.g. after a UPI app switch) can't start a
  // second payment.
  let finish = () => {};
  const finished = new Promise((resolve) => { finish = resolve; });
  try {
    const verifiedAmount = Number(grossAmount ?? amount ?? 0);

    // 1. Create order on backend
    const { data: orderData } = await api.post("payments/razorpay/create-order", {
      deal_id: dealId || null,
      thread_id: threadId || null,
      campaign_id: campaignId || null,
      brief_id: briefId || null,
      creator_id: creatorId || null,
      gross_amount: verifiedAmount,
      amount: verifiedAmount,
      ...(couponCode ? { coupon_code: couponCode } : {}) // v364
    });

    if (!orderData?.order_id || !orderData?.key_id) {
      throw new Error(orderData?.error || "Failed to create Razorpay payment order");
    }
    if (cancel?.cancelled) { // v366: brand tapped Cancel while the order was being made — nothing opens, nothing is charged
      if (onError) onError(new Error("Payment cancelled"));
      return;
    }
    if (onOrderCreated) {
      try { onOrderCreated(orderData.order_id); } catch (e) { console.warn("[Razorpay] onOrderCreated failed:", e?.message); }
    }

    // Session 52 (Ravi: "Razorpay test mode se hata ke real mode pe rakho"): test or live is decided by the
    // SERVER (PAYMENTS_TEST_MODE + the key it sends). The old "*.run.app address = test" guess is gone —
    // on a live key it showed "Test Mode / Auto-Complete" buttons to real brands.
    const isTestMode = Boolean(
      orderData.is_test_mode ||
      orderData.order_id?.startsWith("order_test_") ||
      orderData.key_id?.startsWith("rzp_test_") ||
      orderData.key_id === "rzp_test_placeholder"
    );

    let isCompleted = false;
    let hasTriggeredSuccess = false;
    let pollInterval = null;
    let testToastId = null;
    let pollStartTime = Date.now();
    const POLL_MAX_DURATION = 120000; // 2 minutes hard timeout
    
    // FIX #1: Create a single persistence promise to prevent race condition
    // All success paths must use this same promise to ensure backend is only hit once
    let persistencePromise = null;

    const triggerSuccessOnce = (data) => {
      if (hasTriggeredSuccess) return;
      hasTriggeredSuccess = true;
      isCompleted = true;
      if (testToastId) {
        toast.dismiss(testToastId);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      Promise.resolve(onSuccess ? onSuccess(data) : null).catch((e) => console.warn("[Razorpay] onSuccess failed:", e?.message)).finally(() => finish());
    };
    
    // FIX #1: Single backend call for all paths — prevents duplicate verification
    const persistPaymentOnce = async (paymentId, source, signature = "pending") => {
      if (persistencePromise) {
        console.log(`[Razorpay] Payment persistence already in flight from ${source}, reusing existing promise`);
        return await persistencePromise;
      }
      
      console.log(`[Razorpay] Initiating payment persistence from ${source}`);
      persistencePromise = api.post("payments/razorpay/verify", {
        razorpay_order_id: orderData.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature || "pending",
        deal_id: dealId || null,
        thread_id: threadId || null,
        campaign_id: campaignId || null,
        brief_id: briefId || null,
        transaction_id: orderData.transaction_id || null,
        source: source // For logging
      });
      
      return await persistencePromise;
    };

    // Helper to simulate instant completion in test mode
    const simulateTestComplete = async () => {
      try {
        toast.loading("Simulating Test Payment Hold Deposit...", { id: "test-complete-toast" });
        const { data: testData } = await api.post("payments/razorpay/test-complete", {
          deal_id: dealId || null,
          thread_id: threadId || null,
          campaign_id: campaignId || null,
          brief_id: briefId || null,
          creator_id: creatorId || null,
          order_id: orderData.order_id,
          transaction_id: orderData.transaction_id,
          gross_amount: verifiedAmount,
          amount: verifiedAmount
        });
        toast.dismiss("test-complete-toast");
        if (testData?.verified || testData?.success) {
          if (testData?.state_sync_failed) {
            toast.error("Test payment recorded, but the deal status failed to update. This points to a real backend sync bug — check server logs for: " + (testData.state_sync_error || "unknown error"), { duration: 12000 });
          } else {
            toast.success("Test Payment Verified! Funds placed in secure payment hold.");
          }
          triggerSuccessOnce(testData);
        } else {
          toast.error("Test payment simulation failed");
        }
      } catch (err) {
        toast.dismiss("test-complete-toast");
        toast.error(err?.response?.data?.error || err.message || "Failed to simulate test payment");
      }
    };

    // If order was created in simulation/test mode on preview, auto-complete
    if (orderData.order_id?.startsWith("order_test_") || orderData.key_id === "rzp_test_placeholder") {
      return await simulateTestComplete();
    }

    if (typeof window.Razorpay === "undefined") {
      const loaded = await loadRazorpayScript();
      if (!loaded || typeof window.Razorpay === "undefined") {
        if (isTestMode) {
          toast.info("Razorpay SDK offline in sandbox. Completing test secure payment hold deposit...");
          return await simulateTestComplete();
        }
        toast.error("Razorpay SDK is currently unavailable. Please check your network and try again.");
        return;
      }
    }

    // Auto-polling helper to check if UPI QR payment was captured on phone
    // FIX #4: Add hard timeout to prevent 90-second polling hammering the server
    const startPolling = () => {
      let attempts = 0;
      pollInterval = setInterval(async () => {
        attempts++;
        const elapsedMs = Date.now() - pollStartTime;
        
        // FIX #4: Hard stop conditions
        if (isCompleted || hasTriggeredSuccess || attempts > 30 || elapsedMs > POLL_MAX_DURATION) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (elapsedMs > POLL_MAX_DURATION) {
            console.warn(`[Razorpay] Polling timeout reached (${elapsedMs}ms > ${POLL_MAX_DURATION}ms)`);
          }
          return;
        }
        
        try {
          const { data: statusData } = await api.post("payments/razorpay/check-status", {
            deal_id: dealId || null,
            thread_id: threadId || null,
            order_id: orderData.order_id
          });
          if (statusData?.paid && !hasTriggeredSuccess) {
            if (!quiet) toast.success("Payment detected and confirmed in the secure payment hold!");
            // FIX #1: Use single persistence promise instead of direct call
            const result = await persistPaymentOnce(statusData.payment_id || orderData.order_id, "polling");
            triggerSuccessOnce(result.data);
          }
        } catch (e) {
          // ignore transient poll error
          console.warn("[Razorpay] Poll check error:", e?.message);
        }
      }, 3000);
    };

    startPolling();

    // 2. Configure and launch Razorpay Checkout modal
    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency || "INR",
      // v375 (Ravi, written OK in chat 23 Oct: "razorpay.js mein logo aur naam change"): the real Ybex logo in Razorpay's
      // header instead of the letter box, and no "Ybex" text next to it (the logo already says it).
      name: "",
      image: `${serverOrigin()}/pwa-512x512.png`,
      description: description || "Secure payment hold",
      order_id: orderData.order_id,
      // Session 56: the brand's real details only — no made-up email / phone (Razorpay sent
      // receipts and OTP prompts to them). Empty fields are asked for in the window.
      prefill: {
        name: orderData.user_name || user?.name || "",
        email: orderData.user_email || user?.email || "",
        contact: orderData.user_phone || user?.phone || "",
        ...(["upi", "card", "netbanking", "wallet"].includes(method) ? { method } : {})
      },
      ...(displayConfig ? { config: displayConfig } : {}), // v366
      // v375 (Ravi, written OK in chat 23 Oct: "razorpay.js mein webview_intent OK"): inside the Play Store app the
      // checkout runs in an Android WebView, where Razorpay hides the UPI apps (Paytm / PhonePe / GPay) unless this is
      // on. Ignored in a normal browser.
      webview_intent: true,
      retry: {
        enabled: true
      },
      handler: async function (response) {
        if (hasTriggeredSuccess) return;
        try {
          isCompleted = true;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (!quiet) toast.info("Verifying your payment…");
          
          // FIX #1: Use single persistence promise instead of direct API call
          // This ensures that even if handler and polling both fire (race condition),
          // only ONE backend call happens
          const { data: verifyData } = await persistPaymentOnce(
            response.razorpay_payment_id,
            "handler",
            response.razorpay_signature
          );

          if (verifyData?.verified) {
            if (verifyData?.state_sync_failed) {
              // The Razorpay payment itself genuinely succeeded, but the
              // backend couldn't persist the deal/thread as ACTIVE (e.g. a
              // database sync issue). Don't tell the user everything is
              // fine — their money was taken, but the app state may not
              // reflect it correctly yet. Ask them to refresh and contact
              // support if it doesn't resolve, instead of silently moving
              // on as if nothing went wrong.
              toast.error("Payment was received, but we hit an issue updating your deal status. Please refresh in a moment — if 'Payment pending' doesn't clear, contact support with payment ID " + (verifyData.payment_id || response.razorpay_payment_id) + " so we don't charge you again.", { duration: 12000 });
              console.error("[Razorpay] Payment verified but state sync failed:", verifyData.state_sync_error);
            } else {
              if (!quiet) toast.success("Payment verified! Funds are held safely in the secure payment hold.");
            }
            triggerSuccessOnce(verifyData);
          } else {
            toast.error("Razorpay signature verification failed.");
            if (onError) onError(new Error("Verification failed"));
            finish();
          }
        } catch (err) {
          const errMsg = err?.response?.data?.error || err.message || "Payment verification failed.";
          toast.error(errMsg);
          if (onError) onError(err);
          finish();
        }
      },
      modal: {
        ondismiss: async function () {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (hasTriggeredSuccess) return;

          // Check one last time in case user paid on UPI app and closed popup
          try {
            const { data: statusData } = await api.post("payments/razorpay/check-status", {
              deal_id: dealId || null,
              thread_id: threadId || null,
              order_id: orderData.order_id
            });
            if (statusData?.paid && !hasTriggeredSuccess) {
              if (!quiet) toast.success("Payment confirmed in the secure payment hold!");
              // FIX #1: Use single persistence promise for consistency
              const result = await persistPaymentOnce(statusData.payment_id || orderData.order_id, "ondismiss");
              triggerSuccessOnce(result.data);
              return;
            }
          } catch (e) {
            console.warn("[Razorpay ondismiss] Final status check error:", e?.message);
          }

          if (!hasTriggeredSuccess && !isCompleted) {
            if (isTestMode) {
              toast.info("Testing Mode: Complete test payment?", {
                action: {
                  label: "⚡ Complete Test Pay",
                  onClick: () => simulateTestComplete()
                },
                duration: 10000
              });
            } else {
              toast.info("Payment window closed");
            }
            if (onError) onError(new Error("Payment window closed"));
          }
          if (!hasTriggeredSuccess) finish();
        }
      },
      theme: {
        color: "#7C3AED" // Ybex purple (was a stray indigo)
      }
    };

    let rzp1;
    try { rzp1 = new window.Razorpay(options); } catch (e) {
      if (!options.config) throw e;
      // v366: an app / block Razorpay doesn't accept → the normal Razorpay sheet, nothing else changes
      console.warn("[Razorpay] display config refused, using the default sheet:", e?.message);
      delete options.config;
      rzp1 = new window.Razorpay(options);
    }
    rzp1.on("payment.failed", function (resp) {
      toast.error(resp.error?.description || "Payment failed");
      if (isTestMode) {
        toast.info("Testing on Desktop? Click to simulate successful test deposit:", {
          action: {
            label: "⚡ Simulate Test Pay",
            onClick: () => simulateTestComplete()
          },
          duration: 10000
        });
      }
      if (onError) onError(resp.error);
    });

    rzp1.open();
    if (onOpen) { try { onOpen(); } catch (e) { console.warn("[Razorpay] onOpen failed:", e?.message); } }

    if (isTestMode) {
      testToastId = toast.info("🧪 Test Mode Active: Pay in Razorpay popup or click below to simulate:", {
        action: {
          label: "⚡ Auto-Complete",
          onClick: () => simulateTestComplete()
        },
        duration: 15000
      });
    }

    return await finished;
  } catch (err) {
    // Session 56: the server refuses a second payment for a deal that is already paid (or finds
    // the earlier payment and records it). That is good news for the brand, not an error.
    const body = err?.response?.data || {};
    if (err?.response?.status === 409 && body?.code === "ALREADY_PAID") {
      toast.success(body.detail || "This deal is already paid.");
      try { if (onSuccess) await onSuccess({ verified: true, already_paid: true, order_id: body.order_id || null }); } catch (e) { console.warn("[Razorpay] onSuccess failed:", e?.message); }
      return;
    }
    const errMsg = body?.error || err.message || "Failed to initiate Razorpay payment";
    toast.error(errMsg);
    if (onError) onError(err);
  }
}
