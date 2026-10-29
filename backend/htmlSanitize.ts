// Session 58: blog HTML is cleaned before it is saved (a post with <img onerror=…> ran script for every reader —
// login tokens live in browser storage). Same rules as src/utils/sanitizeHtml.js (the reader cleans it again).
export function sanitizeHtml(input: any): string {
  let s = String(input ?? "");
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|frame|frameset|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|frame|frameset|svg|math)\b[^>]*>/gi, "");
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\s+(href|src|xlink:href|action|formaction|srcset)\s*=\s*("|')?\s*(javascript|vbscript|data)\s*:[^"'>\s]*("|')?/gi, "");
  s = s.replace(/\s+style\s*=\s*("[^"]*expression\([^"]*"|'[^']*expression\([^']*')/gi, "");
  return s;
}
