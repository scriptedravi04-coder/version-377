// v375 (Ravi: "bahut saari env keys daalni padti hain, pareshan ho jaata hoon"): ONE hosting secret instead of many.
// Put every setting in a secret called YBEX_ENV, one per line, exactly like a .env file:
//     SUPABASE_URL=https://xxxx.supabase.co
//     RAZORPAY_KEY_ID=rzp_live_xxx
//     # lines starting with # are ignored, blank lines too
// At start-up (before any other server file reads process.env) each KEY=VALUE fills process.env — but only when that
// key isn't already set on its own, so a secret set separately always wins. Values are never logged. Keys stay out of
// the code / GitHub (that is the point: anyone with the code must not get the session or payment secrets).
// Note: VITE_* values are read while the website is BUILT; set those as normal build settings if a build needs them.

/** "KEY=VALUE" lines → object. Pure (tests). Keeps "=" inside values; strips matching quotes and an "export " prefix. */
export function parseEnvBundle(text: any): Record<string, string> {
  const out: Record<string, string> = {};
  let src = String(text || "");
  // v378 (live 28 Oct: "SUPABASE_SERVICE_ROLE_KEY daal diya phir bhi login unavailable"): some secret boxes save a
  // pasted multi-line value as ONE line (new lines become spaces or a literal "\n"), so only the first key was read.
  // No real new line → split before every "KEY=" that follows a space or a literal \n.
  if (!/[\r\n]/.test(src)) src = src.split(/(?:\s+|\\n)(?=(?:export\s+)?[A-Z_][A-Z0-9_]*\s*=)/).join("\n");
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
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
