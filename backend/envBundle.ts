// v375 (Ravi: "bahut saari env keys daalni padti hain, pareshan ho jaata hoon"): ONE hosting secret instead of many.
// Put every setting in a secret called YBEX_ENV, one per line, exactly like a .env file:
//     SUPABASE_URL=https://xxxx.supabase.co
//     RAZORPAY_KEY_ID=rzp_live_xxx
//     # lines starting with # are ignored, blank lines too
// At start-up (before any other server file reads process.env) each KEY=VALUE fills process.env — but only when that
// key isn't already set on its own, so a secret set separately always wins. Values are never logged. Keys stay out of
// the code / GitHub (that is the point: anyone with the code must not get the session or payment secrets).
// Note: VITE_* values are read while the website is BUILT; set those as normal build settings if a build needs them.

/** v385 (Ravi 30 Oct: Google sign-in "didn't finish"): `GOOGLE_CLIENT_SECRET=GOCSPX-xxx  # ── Apple sign-in (iPhone) ──` was loaded
 *  WITH the trailing comment, so Google answered 401 invalid_client. An unquoted value ends at the first " #" (a # that
 *  follows a space / tab); a # inside a value (no space before it) stays. Quoted values keep everything inside the quotes.
 *  Also used on the sign-in keys themselves, in case they were set as separate secrets with a comment on the end. Pure. */
export function cleanEnvVal(raw: any): string {
  let v = String(raw ?? "").trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) return v.slice(1, -1);
  const q = /^(["'])(.*?)\1(?:\s+#.*)?$/.exec(v); // "value"  # comment
  if (q) return q[2];
  if (v.startsWith("#")) return ""; // KEY=# comment
  v = v.replace(/\s+#.*$/, "");
  return v.trim();
}

/** "KEY=VALUE" lines → object. Pure (tests). Keeps "=" inside values; strips matching quotes and an "export " prefix. */
export function parseEnvBundle(text: any): Record<string, string> {
  const out: Record<string, string> = {};
  let src = String(text || "");
  // v378 (live 28 Oct: "SUPABASE_SERVICE_ROLE_KEY daal diya phir bhi login unavailable"): some secret boxes save a
  // pasted multi-line value as ONE line (new lines become spaces or a literal "\n"), so only the first key was read.
  // No real new line → split before every "KEY=" that follows a space or a literal \n.
  if (!/[\r\n]/.test(src)) src = src.split(/(?:\s+|\\n)(?=(?:export\s+)?[A-Z_][A-Z0-9_]*\s*=)/).join("\n");
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let val = m[2];
    // v388 (QA: an APNS .p8 / FCM key pasted over several lines was cut after its first line — native push stayed off without a word):
    // a value that opens with a quote and does not close it on the same line continues on the following lines until the closing quote.
    const q = /^\s*(["'])/.exec(val);
    if (q && !new RegExp(`^\\s*${q[1]}[\\s\\S]*${q[1]}\\s*(?:\\s#.*)?$`).test(val)) {
      let j = i + 1; let acc = val;
      while (j < lines.length) {
        acc += "\n" + lines[j];
        if (new RegExp(`${q[1]}\\s*(?:\\s#.*)?$`).test(lines[j].trim())) break;
        j++;
      }
      if (j < lines.length) { val = acc; i = j; }
    }
    let v = cleanEnvVal(val); // v385: inline "# comment" no longer ends up inside the value
    // v388: KEY_B64=<base64> is an easy single-line way to give a multi-line secret: it is stored as KEY (decoded).
    const b64 = /^(.*)_B64$/.exec(m[1]);
    if (b64 && v) { try { out[b64[1]] = Buffer.from(v, "base64").toString("utf8"); } catch { /* keep the raw key below */ } }
    out[m[1]] = v;
  }
  return out;
}

/** Fill env from the bundle (only empty keys). Returns the key names it set (names only, never values). */
export function applyEnvBundle(env: NodeJS.ProcessEnv = process.env, bundleName = "YBEX_ENV"): string[] {
  const set: string[] = [];
  const parsed = parseEnvBundle(env[bundleName]);
  for (const [k, v] of Object.entries(parsed)) {
    if (k === bundleName || v === "") continue;
    if (env[k] === undefined || env[k] === "") { env[k] = v; set.push(k); }
    else { const c = cleanEnvVal(env[k]); if (c !== env[k]) env[k] = c; } // v387: a separately set secret with a "# comment" on the end
  }
  return set;
}

export let ENV_BUNDLE_COUNT = 0; // v378: how many settings YBEX_ENV filled (shown by /api/health, number only)
try {
  const names = applyEnvBundle();
  ENV_BUNDLE_COUNT = names.length;
  if (names.length) console.log(`[env] YBEX_ENV filled ${names.length} settings: ${names.join(", ")}`);
} catch (e: any) {
  console.warn("[env] YBEX_ENV could not be read:", e?.message || e);
}
