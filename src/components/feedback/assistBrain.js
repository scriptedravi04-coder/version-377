// v293 (Ravi): "Ybex Assist" was a dummy — it answered every message the same way and saved everything
// as one kind of ticket. This is its small conversation brain: plain rules, no AI call, no server call.
// It understands hi / thanks / "what can you do" / bug / suggestion / "I'm confused", asks one short
// follow-up question, and tells the bot WHEN to send something to the Ybex team and as which kind.
// English and Roman Hinglish both work (replies follow the language the person wrote in).

import { knowledge, BUDGET_ASK } from "./assistKnowledge";

export const FIRST_REPLY = "Got it — this just went to the Ybex team. Thanks for helping us build this.";
export const NEXT_REPLY = "Added to your report. Anything else on your mind?";

const HI_WORDS = new Set(["kya", "hai", "hain", "nahi", "nahin", "kaise", "kaisa", "kahan", "kyun", "kyu", "karo", "kar", "karna", "mujhe", "mera", "meri", "aap", "tum", "tumhare", "bhai", "chahiye", "raha", "rahi", "sakte", "sakta", "bas", "haan", "ji", "namaste", "dikkat", "samajh", "paise", "dikh", "aaya", "hota", "wala", "wali", "abhi", "thoda", "bahut", "accha", "acha", "theek", "shukriya", "dhanyavad", "kaun", "kaam", "yaar", "yar", "mein", "ka", "ki", "ke", "ko", "aur", "toh", "kitna", "kitne", "rakhu", "rakhna", "badhau", "badhao", "badhana", "kamau", "kamana", "banu", "banna", "batao", "bolo"]);
const DEVANAGARI = /[\u0900-\u097F]/;

export const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
const wordsOf = (t) => norm(t).split(" ").filter(Boolean);

/** "hi" = the person writes Hindi / Hinglish → the bot answers in Roman Hinglish. */
export function detectLang(text) {
  if (DEVANAGARI.test(String(text || ""))) return "hi";
  const w = wordsOf(text);
  const hits = w.filter((x) => HI_WORDS.has(x)).length;
  return hits >= 2 || (hits >= 1 && w.length <= 3) ? "hi" : "en";
}

const RX = {
  greeting: /^(hi+|hii+|hello+|helo|hey+|heyy+|hlo|hola|yo|sup|namaste|namaskar|good (morning|afternoon|evening|night)|gm|kaise ho|kya haal|kya hal|howdy)\b/,
  thanks: /\b(thanks|thank you|thankyou|thx|ty|shukriya|dhanyavad|dhanyawad|great|awesome|nice one|cool)\b/,
  bye: /^(bye|byee|good ?bye|see you|cya|tata|ok bye|alvida)\b/,
  done: /^(no|nope|nah|nothing|nothing else|no thanks|no thank you|that'?s all|thats all|that is all|that'?s it|thats it|all good|done|nahi|nahin|bas|bas itna|bas itna hi|kuch nahi|kuch nahin|ho gaya|theek hai bas|nahi bas|nope thanks)$/,
  how: /\b(how are you|how r u|how are u|kaise ho|kya haal|kaisa hai)\b/,
  who: /\b(who are you|who r u|what are you|your name|tum kaun|aap kaun|tera naam|tumhara naam|kaun ho)\b/,
  caps: /\b(what can you do|what can u do|what do you do|what all can you|how can you help|how do you help|what are you for|what is this bot|what is ybex assist|kya kar sakte|kya kar sakta|kya karte ho|kya kaam|kis liye|kis kaam|features|help me|help|madad)\b/,
};
const BUG = /\b(bug|bugs|error|errors|crash|crashes|crashed|crashing|not working|doesn'?t work|does not work|didn'?t work|not opening|not loading|won'?t (open|load)|stuck|freeze|frozen|hang|hangs|hanging|freezes|slow|lag|laggy|broken|breaks|fail|fails|failed|failing|blank|white screen|glitch|issue|problem|wrong|can'?t|cannot|unable|nahi chal|nahi khul|nahi ho raha|nahi aa raha|dikkat|kharab|atak|hang ho|problem hai|issue hai|bug hai|error aa|not received|didn'?t receive|did not receive|not showing|not visible|missing|disappeared|not coming|nothing happens|does nothing|doesn'?t show|not appearing|not sending|not sent|nahi mila|nahi dikh|nahi aaya|gayab|no (money|payment|response|reply|otp|code|email|notification)s?)\b/;
const FEATURE = /\b(suggest|suggestion|suggestions|idea|ideas|add|should have|should add|wish|would be (great|nice|good)|it would be|please add|can you add|could you add|feature|option to|i want|i'd like|i would like|improve|better if|dark mode|chahiye|hona chahiye|add karo|add kar do|kar do|rakho|bana do|banao)\b/;
const CONFUSING = /\b(confus|confusing|confused|don'?t understand|do not understand|didn'?t understand|not clear|unclear|how do i|how to|how can i|where is|where can i|where do i|what is|what does|what happens|samajh nahi|samajh nahin|samjha nahi|kaise|kahan|kahaan|kya hai|kya hota)\b/;

/** What is this message? → { type, category? } — type: greeting | thanks | bye | done | how | who | caps | feedback | other */
export function classify(text) {
  const n = norm(text);
  const w = n ? n.split(" ") : [];
  if (!w.length) return { type: "other" };
  const hasBug = BUG.test(n), hasFeat = FEATURE.test(n), hasConf = CONFUSING.test(n) || /\?\s*$/.test(String(text).trim());
  const strong = hasBug || hasFeat || CONFUSING.test(n);
  if (w.length <= 6 && RX.how.test(n)) return { type: "how" };
  if (w.length <= 8 && RX.who.test(n)) return { type: "who" };
  // v294: chat-only kinds (never saved). A real bug / "please add" always wins over these.
  if (!hasBug && !FEATURE_STRICT.test(n)) {
    if (w.length <= 10 && WANTS_PERSON.test(n)) return { type: "human" };
    if (w.length <= 10 && (BOT_Q.test(n) || MODEL_Q.test(n))) return { type: "botinfo" };
    if (WHEN_Q.test(n) || OFFTOPIC.test(n) || (ASK_FORM.test(String(text).trim().toLowerCase()) && ADVICE.test(n))) return { type: "train" };
  }
  if (!strong && w.length <= 8 && LANGQ.test(n)) return { type: "langq" };
  if (!strong && w.length <= 4 && SORRY.test(n)) return { type: "sorry" };
  if (!strong && w.length <= 8 && PRAISE.test(n)) return { type: "praise" };
  if (w.length <= 8 && RX.caps.test(n) && !strong || n === "help") return { type: "caps" };
  if (RX.bye.test(n) && w.length <= 4) return { type: "bye" };
  if (RX.done.test(n) && !strong) return { type: "done" };
  if ((RX.greeting.test(n) || /^(नमस्ते|नमस्कार|हेलो|हाय|हैलो)$/.test(n)) && w.length <= 5 && !strong) return { type: "greeting" };
  if (RX.thanks.test(n) && w.length <= 5 && !strong) return { type: "thanks" };
  if (ACK.test(n) && !strong) return { type: "ack" };
  if (!strong && !hasConf) return { type: "other" };
  // Score: a clear problem word beats a suggestion word beats a question mark.
  const score = { bug: hasBug ? 2 : 0, feature: hasFeat ? 2 : 0, confusing: CONFUSING.test(n) ? 2 : hasConf ? 1 : 0 };
  if (/(crash|not working|doesn'?t work|nahi chal|error)/.test(n)) score.bug += 1;
  if (/(suggest|idea|please add|should have|chahiye)/.test(n)) score.feature += 1;
  const order = ["bug", "confusing", "feature"];
  const category = order.reduce((best, k) => (score[k] > score[best] ? k : best), "bug");
  return { type: "feedback", category };
}

// v294 (Ravi): the bot is still small. Anything it cannot really answer (creator-economy advice, "which AI are
// you", "when are you live", off-topic) gets the "training mode" answer, in the person's language, and is
// never saved as a ticket. A few more small-talk kinds (ok, sorry, praise, language, "I want a person").
const ASK_FORM = /\?\s*$|^(how|what|why|which|when|can|could|should|is|are|do|does|kya|kaise|kaun|kyun|kyu|kitna|kitne|batao|bata do|tell me|explain|suggest me|help me|mujhe batao)\b/;
const ADVICE = /\b(grow|growth|followers|viral|engagement|algorithm|brand deals?|sponsor(ship|ships)?|rate card|how much (should|to|do)|kitna charge|charge|earn|earning|earnings|income|monetize|monetise|negotiat\w*|pitch|niche|strategy|tips|advice|best time to post|hashtags?|captions?|content ideas?|script|reels?|shorts|tax|itr|legal|career|loan|invest\w*|marketing|influencer|creator economy|kamayi|kamau|kamana|paise kaise|kaise banu|kaise bane)\b/;
const MODEL_Q = /\b(chatgpt|gpt|gemini|claude|openai|llm|which (ai|model)|what model|who (made|built|created|trained|owns) you|kisne banaya|kaun sa (ai|model)|powered by|kaun si ai)\b/;
const WHEN_Q = /\b((when|kab).*(live|launch|ready|available|aayega|aayegi|milega)|kab tak|coming soon|full version|pura model)\b/;
const OFFTOPIC = /\b(weather|latest news|news today|cricket|ipl|joke|jokes|poem|song|movie|recipe|python|javascript|write (a )?(code|program)|math|translate|essay|homework|capital of|prime minister|bitcoin|stock price|horoscope|girlfriend|boyfriend)\b/;
const FEATURE_STRICT = /\b(please add|can you add|could you add|should add|should have|add karo|add kar do|suggestion|i suggest)\b/;
const WANTS_PERSON = /\b(talk to|speak to|connect me|real person|human agent|customer care|customer support|kisi se baat|insaan se|agent se)\b/;
const BOT_Q = /\b(are you (a |an )?(human|real|person|bot|robot|ai|machine)|is this (a )?(bot|ai|human|real)|bot hai|ai hai|robot hai|insaan ho|asli ho)\b/;
const ACK = /^(ok|okay|okk|hmm+|k|kk|accha|acha|achha|theek hai|thik hai|got it|alright|fine|sure|haan|han|ha|yes|yep|yeah|ji|hmm ok|ok ok)$/;
const PRAISE = /\b(good (job|bot|work)|well done|love (it|you|this|ybex|the app)|best app|nice app|great app|awesome app|badhiya|zabardast|mast hai|bahut accha|bahut badhiya|amazing)\b/;
const SORRY = /^(sorry|my bad|oops|maaf karna|sorry yaar|galti se)\b/;
const LANGQ = /\b((speak|talk|reply|bolo|bol sakte|baat kar sakte).*(hindi|hinglish|english|angrezi)|(hindi|hinglish|english) (me|mein|main|please))\b/;

const MONEY = /\b(payment|pay|paid|refund|money|payout|withdraw|wallet|invoice|upi|bank|paise|escrow)\b/;

const R = {
  en: {
    greeting: "Hey! 👋 I'm Ybex Eva. Tell me if something's broken, confusing or missing — or ask me what I can do.",
    how: "Doing great, thanks for asking! 😄 Anything on Ybex I can note down for you — a bug, an idea, something confusing?",
    who: "I'm Ybex Eva — the little helper inside the Ybex app. I collect bugs, ideas and \"huh?\" moments and hand them straight to the Ybex team.",
    caps: "Here's what I do for now:\n• Take bug reports — add a screenshot with 📎\n• Collect your ideas for Ybex\n• Note anything that feels confusing\n• Answer questions about Ybex — campaigns, UGC, fees, KYC, payouts — and plan a budget (try \"I have ₹50,000, what can I do?\")\nBug reports and ideas go straight to the Ybex team. More features are coming soon — what would you like me to help you with?",
    capsMore: "Nothing wrong with that! Whenever you spot a bug, an idea or something confusing, just tell me.",
    botIdea: "Love that — I've passed it to the team as an idea. Anything else you'd like me to do?",
    thanks: "Anytime! 🙌 If you spot anything else, I'm right here.",
    bye: "Bye! 👋 I'm here whenever you find a bug or have an idea.",
    done: "Okay! Thanks for helping us build Ybex. 💜 I'm here if anything comes up.",
    bug: "Oh no, sorry about that — it's with the Ybex team as a bug now. 🛠️ What were you doing right before it happened? A screenshot (📎) helps a lot.",
    feature: "Nice idea — saved for the team. 💡 Who would it help most: creators, brands, or both? Add more if you like.",
    confusing: "Thanks for telling us — that's really useful, and it's noted for the team. What did you expect to happen there?",
    gotBug: "Thanks, that helps — it's with the Ybex team as a bug now. 🛠️ Add a screenshot (📎) if you have one, or tell me anything else.",
    gotFeature: "Love it — saved as an idea for the team. 💡 Anything else?",
    gotConfusing: "Thanks — noted for the team so we can make it clearer. Anything else?",
    train: [
      "Good question! 🙂 Right now I'm in training mode — I'm learning the creator economy and understanding creators' problems, and I'm being trained around them. My full version goes live in a few days. Until then ask me about the Ybex app (fees, KYC, payouts, campaigns, UGC, budgets), or I can note down bugs and ideas for the team.",
      "That's a bit beyond me for now — I'm still in training mode, learning from creators' real problems. The full me goes live in a few days! Meanwhile, if you hit a bug or have an idea, tell me and it goes straight to the team.",
      "Still in training mode here 😅 — I'll be able to answer questions like this once my full version is live in a few days. For now, bugs, ideas and \"huh?\" moments are what I can take.",
    ],
    botinfo: "I'm Ybex Eva — Ybex's own automated helper, not a person. I'm in training mode right now: learning the creator economy and creators' problems, and my full version goes live in a few days. For now I take bugs, ideas and confusing moments.",
    human: "I'm an automated helper, so I can't connect you to a person here. Please raise a ticket in Support and the Ybex team will pick it up. If it's a bug or an idea, I can take that right now.",
    ack: "👍 Tell me whenever you spot a bug, have an idea, or something feels confusing.",
    sorry: "No worries at all! 🙂 What can I note down for the team?",
    praise: "That means a lot, thank you! 💜 If anything feels off or you have an idea to make Ybex better, I'm here.",
    langq: "Yes — English, Hindi and Hinglish all work. Write in whichever you like and I'll reply the same way.",
    general: FIRST_REPLY,
    follow: NEXT_REPLY,
    newBug: "That sounds like a separate bug, so I've filed it on its own. 🛠️ What were you doing when it happened?",
    newFeature: "That's a separate idea, so I've saved it on its own. 💡 Tell me more if you like!",
    newConfusing: "I've noted that as its own \"confusing\" report. What did you expect to happen there?",
    money: " Since money is involved, please also raise a ticket in Support so we can check your order.",
    short: "Could you tell me a little more? Is it a bug, an idea, or something that feels confusing?",
    ok: "Okay! Anything else you'd like to tell us?",
    chipBug: "Oh no — what happened, and on which screen?",
    chipFeature: "Love that. What should Ybex do for you?",
    chipConfusing: "Tell me where you got stuck — we'll fix it.",
  },
  hi: {
    greeting: "Hey! 👋 Main Ybex Eva hoon. Kuch kharab, confusing ya missing lage to bata do — ya poocho main kya kar sakta hoon.",
    how: "Bilkul mast, poochne ke liye thanks! 😄 Ybex mein koi bug, idea ya confusion ho to bata do, main note kar leta hoon.",
    who: "Main Ybex Eva hoon — Ybex app ka chhota helper. Bugs, ideas aur confusion collect karke seedha Ybex team ko deta hoon.",
    caps: "Abhi main ye kar sakta hoon:\n• Bug report lena — 📎 se screenshot bhi laga sakte ho\n• Ybex ke liye aapke ideas collect karna\n• Jo cheez confusing lage wo note karna\n• Ybex ke sawalon ke jawab — campaigns, UGC, fees, KYC, payout — aur budget plan (poocho: \"₹50,000 mein kya ho jayega?\")\nBug report aur ideas seedha Ybex team ko jaate hain. Aur features jaldi aa rahe hain — aap chahte ho main kis cheez mein help karun?",
    capsMore: "Koi baat nahi! Jab bhi bug, idea ya confusion dikhe, bas mujhe bata dena.",
    botIdea: "Badhiya idea — team ko idea ke roop mein bhej diya. Aur kuch chahte ho ki main karun?",
    thanks: "Kabhi bhi! 🙌 Aur kuch dikhe to main yahin hoon.",
    bye: "Bye! 👋 Bug ya idea ho to main yahin hoon.",
    done: "Theek hai! Ybex banane mein help karne ke liye thanks. 💜 Kuch aur ho to bata dena.",
    bug: "Arre, sorry yaar — ab ye bug ke roop mein Ybex team ke paas hai. 🛠️ Ye hone se pehle aap kya kar rahe the? Screenshot (📎) ho to bahut help hogi.",
    feature: "Accha idea hai — team ke liye save kar liya. 💡 Ye kiske liye zyada kaam ka hai: creators, brands ya dono? Aur kuch add karna ho to bata do.",
    confusing: "Batane ke liye thanks — ye kaam ki baat hai, team ko note kar diya. Wahan aap kya hone ki umeed kar rahe the?",
    gotBug: "Thanks, isse help milegi — ab ye bug ke roop mein Ybex team ke paas hai. 🛠️ Screenshot (📎) ho to laga do, ya aur kuch batana ho to bata do.",
    gotFeature: "Badhiya — team ke liye idea ke roop mein save kar liya. 💡 Aur kuch?",
    gotConfusing: "Thanks — team ko note kar diya taaki hum ise aur clear bana sakein. Aur kuch?",
    train: [
      "Accha sawal hai! 🙂 Abhi main training mode mein hoon — creators economy seekh raha hoon aur creators ki problems ko samajh raha hoon, unhi ke hisaab se train ho raha hoon. Mera poora model kuch din mein live hoga. Tab tak Ybex app ke baare mein poochh lo (fees, KYC, payout, campaigns, UGC, budget), ya bug aur ideas main team ke liye note kar sakta hoon.",
      "Ye abhi mere bas se thoda bahar hai — main abhi training mode mein hoon aur creators ki asli problems se seekh raha hoon. Poora model kuch din mein live hoga! Tab tak koi bug ya idea ho to bata do, seedha team ko jaayega.",
      "Abhi bhi training mode mein hoon 😅 — aise sawalon ke jawab tab de paunga jab mera poora model kuch din mein live hoga. Abhi ke liye bug, idea aur confusion main le sakta hoon.",
    ],
    botinfo: "Main Ybex Eva hoon — Ybex ka apna automated helper, insaan nahi. Abhi training mode mein hoon: creators economy aur creators ki problems seekh raha hoon, poora model kuch din mein live hoga. Abhi main bug, idea aur confusion note karta hoon.",
    human: "Main automated helper hoon, isliye yahan se kisi insaan se connect nahi kar sakta. Support mein ek ticket raise kar do, Ybex team dekh legi. Bug ya idea ho to wo main abhi le leta hoon.",
    ack: "👍 Jab bhi bug dikhe, idea aaye ya kuch confusing lage, bata dena.",
    sorry: "Arre koi baat nahi! 🙂 Team ke liye kya note karun?",
    praise: "Thanks yaar, bahut accha laga! 💜 Kuch galat lage ya Ybex ko better banane ka idea ho to main yahin hoon.",
    langq: "Haan — English, Hindi aur Hinglish teeno chalte hain. Jis mein likhoge, main usi mein jawab dunga.",
    general: "Mil gaya — ye abhi Ybex team ko bhej diya. Ybex banane mein help ke liye thanks.",
    follow: "Aapki report mein add kar diya. Aur kuch kehna hai?",
    newBug: "Ye alag bug lag raha hai, isliye alag se file kar diya. 🛠️ Ye hote waqt aap kya kar rahe the?",
    newFeature: "Ye alag idea hai, isliye alag se save kar diya. 💡 Aur batana ho to bata do!",
    newConfusing: "Isse alag \"confusing\" report ke roop mein note kar liya. Wahan aap kya hone ki umeed kar rahe the?",
    money: " Paise ka maamla hai, isliye Support mein ek ticket bhi raise kar do taaki hum aapka order check kar sakein.",
    short: "Thoda aur bataoge? Ye bug hai, idea hai, ya kuch confusing lag raha hai?",
    ok: "Theek hai! Aur kuch batana hai?",
    chipBug: "Arre — kya hua, aur kaunsi screen par?",
    chipFeature: "Badhiya. Ybex aapke liye kya kare?",
    chipConfusing: "Bataiye kahan atak gaye — hum theek kar denge.",
  },
};
const say = (lang, key, n = 0) => {
  const v = (R[lang] || R.en)[key] || R.en[key];
  return Array.isArray(v) ? v[n % v.length] : v;
};

export const initialState = () => ({ awaiting: null, category: "general", ticketKind: null, sent: 0, lang: "en", lastBot: "", trainN: 0, kbN: 0, role: null });

/**
 * What should the bot do with this message?
 *   plan(text, state) → { reply, send, next }
 *   send = null (just chat) | { category, message, newTicket, prefix? }
 */
export function plan(text, state = initialState(), ctx = {}) {
  const raw = String(text || "").trim();
  const st = { ...initialState(), ...state };
  const wc = wordsOf(raw).length;
  const lang = detectLang(raw) === "hi" || (st.lang === "hi" && wc <= 3) ? "hi" : "en";
  const c = classify(raw);
  const next = { ...st, lang };

  // v295 (Ravi): questions about the Ybex app itself (brand / creator / fees / KYC / payout / budget) are
  // ANSWERED here, chat only (never saved). A real bug or a "please add" still goes to the team, and so does
  // anything said while the person is describing a bug the bot just asked about.
  if (!["botinfo", "human"].includes(c.type)) {
    const n = norm(raw);
    const reportingBug = st.awaiting === "detail" && st.category === "bug";
    // "I don't understand X" is a confusing-screen REPORT for the team, not a question to answer.
    const confused = /\b(don'?t understand|do not understand|didn'?t understand|not clear|unclear|confus\w*|samajh nahi|samjha nahi|samajh nahin)\b/.test(n)
      || /\bwhere (is|are|can i find|do i find)\b.*\b(button|option|screen|page|tab|icon|menu)\b/.test(n); // "can't find the button" = a screen the team should fix
    if (!reportingBug && !confused && !BUG.test(n) && !FEATURE_STRICT.test(n)) {
      const kb = knowledge(raw, lang, { awaitingBudget: st.awaiting === "budget", role: ctx.role || st.role });
      if (kb) {
        const keep = kb.topic === "budget-ask" ? "budget" : (st.awaiting === "budget" ? null : st.awaiting);
        return { reply: kb.reply, send: null, next: { ...next, awaiting: keep, kbN: st.kbN + 1 } };
      }
    }
  }
  // Waiting for a budget but got something else: ask once more, then stop waiting (never trap the person).
  if (st.awaiting === "budget" && ["other", "train"].includes(c.type)) {
    return { reply: BUDGET_ASK[lang], send: null, next: { ...next, awaiting: null } };
  }

  // v294: chat-only answers — never saved, and the conversation (chip question / open report) is not forgotten.
  if (c.type === "train") return { reply: say(lang, "train", st.trainN), send: null, next: { ...next, trainN: st.trainN + 1 } };
  if (["botinfo", "human", "langq", "sorry", "praise", "ack"].includes(c.type)) return { reply: say(lang, c.type), send: null, next };

  // The bot asked "what would you like me to help with?" → a plain answer is an idea for the bot.
  if (st.awaiting === "botIdea" && !(c.type === "feedback" && c.category !== "feature") && !["done", "bye", "thanks", "greeting"].includes(c.type)) {
    if (wc >= 2) return { reply: say(lang, "botIdea"), send: { category: "feature", message: raw, newTicket: true, prefix: "[Ybex Eva idea] " }, next: { ...next, awaiting: "followup", ticketKind: "feature", sent: st.sent + 1 } };
  }

  switch (c.type) {
    case "greeting": return { reply: say(lang, "greeting"), send: null, next: { ...next, awaiting: st.awaiting === "detail" ? "detail" : null } };
    case "how": return { reply: say(lang, "how"), send: null, next };
    case "who": return { reply: say(lang, "who"), send: null, next };
    case "caps": return { reply: say(lang, "caps"), send: null, next: { ...next, awaiting: "botIdea" } };
    case "thanks": return { reply: say(lang, "thanks"), send: null, next: { ...next, awaiting: st.awaiting === "detail" ? "detail" : null } };
    case "bye": return { reply: say(lang, "bye"), send: null, next: { ...next, awaiting: null } };
    case "done":
      if (st.awaiting === "botIdea") return { reply: say(lang, "capsMore"), send: null, next: { ...next, awaiting: null } };
      return { reply: say(lang, "done"), send: null, next: { ...next, awaiting: null } };
    default: break;
  }

  const hasTicket = st.sent > 0 && st.ticketKind;
  const money = MONEY.test(norm(raw));

  // They tapped a chip and are now answering its question — the chip they chose decides the kind.
  if (st.awaiting === "detail" && wc >= 1 && st.category && st.category !== "general") {
    const category = st.category;
    return { reply: say(lang, `got${category[0].toUpperCase()}${category.slice(1)}`) + (category === "bug" && money ? say(lang, "money") : ""), send: { category, message: raw, newTicket: true }, next: { ...next, awaiting: "followup", ticketKind: category, sent: st.sent + 1 } };
  }

  // A clear bug / idea / question.
  if (c.type === "feedback") {
    // The chip is only a hint — what the person actually wrote decides, unless they are answering the chip's question.
    const category = c.category;
    const sameKind = hasTicket && st.ticketKind === category;
    const followUp = hasTicket && st.awaiting === "followup" && sameKind;
    if (followUp) return { reply: say(lang, "follow"), send: { category: st.ticketKind, message: raw, newTicket: false }, next: { ...next, awaiting: "followup", sent: st.sent + 1 } };
    const fresh = !hasTicket;
    const key = fresh ? category : `new${category[0].toUpperCase()}${category.slice(1)}`;
    return {
      reply: say(lang, key) + (category === "bug" && money ? say(lang, "money") : ""),
      send: { category, message: raw, newTicket: true },
      next: { ...next, awaiting: "followup", ticketKind: category, category, sent: st.sent + 1 },
    };
  }

  // Not a clear signal.
  if (hasTicket && st.awaiting === "followup") {
    if (wc >= 3) return { reply: say(lang, "follow"), send: { category: st.ticketKind, message: raw, newTicket: false }, next: { ...next, sent: st.sent + 1 } };
    return { reply: say(lang, "ok"), send: null, next };
  }
  if (wc >= 4) return { reply: say(lang, "general"), send: { category: "general", message: raw, newTicket: true }, next: { ...next, awaiting: "followup", ticketKind: "general", sent: st.sent + 1 } };
  return { reply: say(lang, "short"), send: null, next };
}

/** A quick-start chip was tapped: the bot asks its question and waits for the answer. */
export function chipPlan(kind, state = initialState()) {
  const st = { ...initialState(), ...state };
  const key = kind === "bug" ? "chipBug" : kind === "feature" ? "chipFeature" : "chipConfusing";
  return { reply: say(st.lang, key), next: { ...st, awaiting: "detail", category: kind, ticketKind: st.sent > 0 ? st.ticketKind : null } };
}
/** Chip: "What can you do?" */
export function capsPlan(state = initialState()) {
  const st = { ...initialState(), ...state };
  return { reply: say(st.lang, "caps"), next: { ...st, awaiting: "botIdea" } };
}
/** Chip: "Plan my budget" — the bot asks for the amount and waits for it. */
export function budgetChipPlan(state = initialState()) {
  const st = { ...initialState(), ...state };
  return { reply: BUDGET_ASK[st.lang === "hi" ? "hi" : "en"], next: { ...st, awaiting: "budget" } };
}
