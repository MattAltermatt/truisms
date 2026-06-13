export const SHUFFLE_K = 97; // prime, coprime to 132 — bijective shuffle, no freeze

export function pickIndex(epochSeconds, size) {
  return (epochSeconds * SHUFFLE_K) % size;
}

// Auto-fit by total character count. Starting points; tuned in Chrome (Task 7).
export function fontSizePx(text) {
  const n = text.length;
  if (n <= 25) return 46;
  if (n <= 40) return 36;
  if (n <= 55) return 29;
  return 24;
}
