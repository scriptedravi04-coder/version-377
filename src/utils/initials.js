// v346: avatar initials that never cut an emoji in half ("Glow 🌿 Cosmetics" showed "G�").
// Characters are read with Array.from (whole code points) and words with no letter or digit (an emoji,
// "&", "-") are skipped, so "Glow 🌿 Cosmetics" → "GC".

const LETTER = /[\p{L}\p{N}]/u;

const lettersOf = (word) => Array.from(word).filter((ch) => LETTER.test(ch));

/**
 * initials("Glow 🌿 Cosmetics") → "GC"
 * options: fallback ("?" when there is no letter), lastWord (first + last word instead of first two),
 * oneWordLetters (how many letters a one-word name gives, default 1).
 */
export function initials(name, { fallback = "?", lastWord = false, oneWordLetters = 1 } = {}) {
  const words = String(name ?? "").trim().split(/\s+/).map(lettersOf).filter((w) => w.length > 0);
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, Math.max(1, oneWordLetters)).join("").toUpperCase();
  const second = lastWord ? words[words.length - 1] : words[1];
  return (words[0][0] + second[0]).toUpperCase();
}

/** First letter only (for one-letter logos). */
export const firstLetter = (name, fallback = "?") => {
  const w = lettersOf(String(name ?? "").trim());
  return w.length ? w[0].toUpperCase() : fallback;
};

export default initials;
