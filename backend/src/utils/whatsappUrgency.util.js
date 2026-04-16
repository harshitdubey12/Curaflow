/**
 * Detect messages that need an immediate urgent-care response (before generic AI).
 * Conservative list; does not diagnose.
 */
export function isLikelyMedicalEmergency(text) {
  const t = String(text ?? '').toLowerCase();
  if (t.length < 3) return false;
  return (
    /\b(chest\s+pain|heart\s+attack|cardiac\s+arrest)\b/i.test(t) ||
    /\b(can't breathe|cannot breathe|difficulty breathing|choking|gasping)\b/i.test(t) ||
    /\b(severe\s+bleed|bleeding\s+heavily|hemorrhag)\b/i.test(t) ||
    /\b(stroke|facial\s+droop|slurred\s+speech|one\s+side\s+weak)\b/i.test(t) ||
    /\b(unconscious|passed\s+out|not\s+waking|seizure)\b/i.test(t) ||
    /\b(suicide|kill\s+myself|end\s+my\s+life)\b/i.test(t) ||
    /\b(overdose|poisoned)\b/i.test(t)
  );
}
