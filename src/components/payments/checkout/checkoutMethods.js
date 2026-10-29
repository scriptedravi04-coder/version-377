// v366 (Ravi's Checkout.dc.html: "Review & pay" with UPI app tiles → Razorpay opens on the app the brand picked).
// The choice travels to src/lib/razorpay.js as ONE string, so every existing caller / server call stays the same:
//   "upi"            any UPI app (Razorpay's own UPI list / QR)
//   "upi:phonepe"    a specific app (intent on phones, QR on desktop) — also gpay, paytm, bhim, amazonpay
//   "upi:collect"    "Enter UPI ID" — Razorpay asks for the VPA and sends the collect request
//   "card" | "netbanking"
// The money still moves only inside Razorpay's window; nothing about cards or PINs reaches Ybex.

export const UPI_APPS = [
  { id: "gpay", label: "Google Pay", razorpay: "google_pay", logoH: 15 },
  { id: "phonepe", label: "PhonePe", razorpay: "phonepe", logoH: 20 },
  { id: "paytm", label: "Paytm", razorpay: "paytm", logoH: 16 },
  { id: "bhim", label: "BHIM", razorpay: "bhim", logoH: 17 },
  { id: "amazonpay", label: "Amazon Pay", razorpay: "amazon_pay", logoH: 15 },
];

export const OTHER_METHODS = [
  { id: "card", title: "Debit / credit card", sub: "", marks: ["visa", "mastercard", "rupay", "amex"] },
  { id: "netbanking", title: "Net banking", sub: "SBI, HDFC, ICICI, Axis + 50 banks", marks: [] },
];

/** "upi:phonepe" → { method: "upi", app: "phonepe", flow: "intent" }. Unknown → { method: "", app: null }. Pure. */
export function parseMethodChoice(choice) {
  const [m, extra] = String(choice || "").toLowerCase().split(":");
  if (m === "upi") {
    if (extra === "collect") return { method: "upi", app: null, flow: "collect" };
    const app = UPI_APPS.find((a) => a.id === extra) || null;
    return { method: "upi", app: app ? app.id : null, flow: app ? "intent" : null };
  }
  if (m === "card" || m === "netbanking" || m === "wallet") return { method: m, app: null, flow: null };
  return { method: "", app: null, flow: null };
}

/** Short label for the Pay button ("via PhonePe") and the success screen. Pure. */
export function choiceLabel(choice) {
  const c = parseMethodChoice(choice);
  if (c.method === "upi") return c.app ? UPI_APPS.find((a) => a.id === c.app).label : c.flow === "collect" ? "UPI ID" : "UPI";
  if (c.method === "card") return "card";
  if (c.method === "netbanking") return "net banking";
  return "Razorpay";
}

/** Razorpay Standard Checkout `config.display` that opens on the picked app / method, with Razorpay's normal list still
 *  below it (show_default_blocks) — so if an app isn't on this phone, the brand just picks another. null = no change. Pure. */
export function razorpayDisplayConfig(choice) {
  const c = parseMethodChoice(choice);
  let name = "";
  let instruments = null;
  if (c.method === "upi" && c.app) {
    const app = UPI_APPS.find((a) => a.id === c.app);
    name = `Pay with ${app.label}`;
    instruments = [{ method: "upi", flows: ["intent", "qr", "collect"], apps: [app.razorpay] }];
  } else if (c.method === "upi" && c.flow === "collect") {
    name = "Pay with your UPI ID";
    instruments = [{ method: "upi", flows: ["collect"] }];
  } else if (c.method === "card") {
    name = "Pay by card";
    instruments = [{ method: "card" }];
  } else if (c.method === "netbanking") {
    name = "Pay by net banking";
    instruments = [{ method: "netbanking" }];
  }
  if (!instruments) return null;
  return {
    display: {
      blocks: { ybex: { name, instruments } },
      sequence: ["block.ybex"],
      preferences: { show_default_blocks: true },
    },
  };
}
