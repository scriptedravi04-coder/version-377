// Session 43 (v284) — Supabase free-plan quota (egress, log ingestion) ran out with no real users.
//
// The inbox (/chat/v2/threads, polled by several screens) was the heaviest reader:
//   - users / brand_profiles / creator_profiles were read with select('*') only to show a name and
//     a picture (rows can hold large JSON and even multi-MB `data:` images);
//   - for EVERY thread two requests ran: the last 60 messages with every column, and a count.
//     20 threads = 40 requests (and 40 log lines) per inbox load.
//
// This file keeps the SAME results with less data:
//   - profiles: only the columns the inbox uses;
//   - messages: one request per thread (window + exact count together), light columns for the
//     window, and ONE batched request for the full last message of every thread.
// A column that does not exist in this database is dropped once and remembered (no repeat errors);
// anything else unexpected falls back to the old full read, so the inbox never gets worse.

type Client = any;

const MISSING_COL_RE = /column\s+(?:[\w"]+\.)?"?([\w]+)"?\s+does not exist|Could not find the '([\w]+)' column/i;

function missingColumn(error: any): string | null {
  if (!error) return null;
  const code = String(error.code || "");
  if (code !== "42703" && code !== "PGRST204" && !MISSING_COL_RE.test(String(error.message || ""))) return null;
  const m = String(error.message || "").match(MISSING_COL_RE);
  return m ? (m[1] || m[2] || null) : null;
}

// table -> columns known to work here (after dropping missing ones). Module-level on purpose.
const learned: Record<string, string[]> = {};
export function __resetLearnedColumns() { for (const k of Object.keys(learned)) delete learned[k]; }

/**
 * Run `build(columns)` with the wanted columns. A missing column is removed and the call retried
 * (at most a few times); the trimmed list is remembered for this table. If the error is anything
 * else, or every column is gone, the query runs once with '*'.
 */
export async function selectColumns(table: string, wanted: string[], build: (cols: string) => any): Promise<any> {
  let cols = (learned[table] || wanted).slice();
  for (let attempt = 0; attempt < 6 && cols.length; attempt++) {
    const res = await build(cols.join(","));
    if (!res?.error) { learned[table] = cols; return res; }
    const gone = missingColumn(res.error);
    if (!gone) break;
    const next = cols.filter((c) => c !== gone && !c.endsWith(`:${gone}`) && !c.startsWith(`${gone}->`) && !c.includes(`:${gone}->`));
    if (next.length === cols.length) break;
    cols = next;
  }
  return build("*");
}

// Exactly what populateThreadData reads from each profile table.
export const INBOX_PROFILE_COLUMNS: Record<string, string[]> = {
  users: ["user_id", "name", "picture"],
  brand_profiles: ["user_id", "company_name", "logo"],
  creator_profiles: ["user_id", "name", "full_name", "picture", "photo", "avatar_url", "profile_picture_url"],
};

export function fetchInboxProfiles(client: Client, userIds: string[]) {
  return Promise.all(
    (["users", "brand_profiles", "creator_profiles"] as const).map((table) =>
      selectColumns(`inbox:${table}`, INBOX_PROFILE_COLUMNS[table], (cols) =>
        client.from(table).select(cols).in("user_id", userIds)
      )
    )
  );
}

// What the inbox needs from older window messages: dedupe (message_id, created_at), order, and the
// latest live-link action (message_type / type / metadata.action). The LAST message goes out whole.
export const LIGHT_MESSAGE_COLUMNS = [
  "message_id", "thread_id", "created_at", "sender_user_id", "read", "message_type", "type",
  "meta_action:metadata->>action",
];

function lightToMessage(row: any) {
  const { meta_action, ...rest } = row || {};
  return meta_action ? { ...rest, metadata: { action: meta_action } } : rest;
}

/**
 * Same return shape as the old fetchThreadMessageWindows in server.ts:
 * { windows: {tid: oldest→newest}, totals: {tid: n}, unread: {tid: n}, allIds: Set }.
 * Returns null when the lean path is not possible, so the caller can use the old path.
 */
export async function fetchLeanMessageWindows(client: Client, threadIds: string[], currentUserId: string, windowSize: number) {
  const windows: Record<string, any[]> = {};
  const totals: Record<string, number> = {};
  const unread: Record<string, number> = {};
  const allIds = new Set<string>();
  let failed = false;

  const unreadP = client
    .from("chat_messages")
    .select("thread_id, sender_user_id, message_id")
    .in("thread_id", threadIds)
    // v348: only read = false counts. Opening a chat marks read ONLY rows with read = false (chat_routes),
    // so a row saved with no `read` value (e.g. the admin "Payout Disbursed" card) stayed unread for ever:
    // a stuck "1" on completed deals. Same rule as the nav badge (/chat/v2/threads/count).
    .eq("read", false);

  let next = 0;
  const worker = async () => {
    while (next < threadIds.length && !failed) {
      const tid = threadIds[next++];
      const res: any = await selectColumns("inbox:chat_messages", LIGHT_MESSAGE_COLUMNS, (cols) =>
        client.from("chat_messages").select(cols, { count: "exact" }).eq("thread_id", tid)
          .order("created_at", { ascending: false }).limit(windowSize)
      );
      if (res?.error) { failed = true; return; }
      const list = (res?.data || []).map(lightToMessage).reverse();
      windows[tid] = list;
      totals[tid] = typeof res?.count === "number" ? res.count : list.length;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, threadIds.length) }, worker));
  if (failed) return null;

  // The newest message of each thread goes to the screen as `last_message` → read it whole.
  const lastIds = Object.values(windows).map((l) => l[l.length - 1]?.message_id).filter(Boolean).map(String);
  if (lastIds.length) {
    const { data: full, error } = await client.from("chat_messages").select("*").in("message_id", lastIds);
    if (error) return null;
    const byId = new Map<string, any>((full || []).map((m: any) => [String(m.message_id), m]));
    for (const tid of Object.keys(windows)) {
      const l = windows[tid];
      const last = l[l.length - 1];
      if (!last) continue;
      const whole = byId.get(String(last.message_id));
      if (!whole) return null; // should not happen; play safe
      l[l.length - 1] = whole;
    }
  }

  const { data: unreadRows } = await unreadP;
  (unreadRows || []).forEach((m: any) => {
    if (m.message_id) allIds.add(String(m.message_id));
    // v348: same rule as "open chat → mark read" (chat_routes: sender_user_id <> me, which never matches a
    // NULL sender in SQL). Cards saved with no sender (admin "Payout Disbursed") could never be cleared → stuck "1".
    if (m.sender_user_id && m.sender_user_id !== currentUserId) unread[m.thread_id] = (unread[m.thread_id] || 0) + 1;
  });
  return { windows, totals, unread, allIds };
}
