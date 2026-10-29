// v332: one calm, plain-English message for a failed chat / deal action.
// The server's own sentence is kept when it is a short, readable one ("Minimum offer is ₹3,000",
// "The code has expired"). Technical text — "Network Error", "Request failed with status code 500",
// "timeout of 45000ms exceeded", database errors — is replaced by the fallback the screen passes in.
const TECH = /request failed|status code|network error|timeout|timed out|internal server|exception|stack|supabase|postgres|pgrst|sql|syntax|undefined|null|cannot read|econn|fetch failed|<html/i;

export function calmError(err, fallback = "Something went wrong. Please try again.") {
  const d = err?.response?.data;
  const server = [d?.error, d?.detail, d?.message].find((v) => typeof v === "string" && v.trim()) || "";
  if (server && server.length <= 160 && !TECH.test(server)) return server;
  return fallback;
}

export default calmError;
