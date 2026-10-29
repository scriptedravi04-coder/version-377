// v332: message time in IST ("04:35 pm"); an unreadable or missing date gives "" instead of
// "Invalid Date" on the card.
export function istTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

// v332: date + time in IST for admin lists ("16 Oct 2026, 04:35 pm"); "" when unreadable.
export function istDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default istTime;
