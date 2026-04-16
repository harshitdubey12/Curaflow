/**
 * Route WhatsApp text: queue actions vs general chatbot assistance.
 * Explicit join phrases enqueue; greetings and questions go to the AI assistant.
 */

export function detectWhatsAppIntent(body) {
  const t = (body || '').trim();
  if (t.length === 0) return 'assist';

  const lower = t.toLowerCase();

  if (
    /^(help|menu|commands)(\s|$|!|\.)/i.test(t) ||
    /^what can you do/i.test(t)
  ) {
    return 'help';
  }

  if (
    /\b(my\s+token|my\s+wait|wait\s*time|how\s+long|how\s+much\s+time|my\s+position|my\s+turn|queue\s+status|where\s+am\s+i|what('?s)?\s+my\s+(number|token|place))\b/i.test(
      t
    )
  ) {
    return 'status';
  }

  const looksLikeQuestion =
    /\?/.test(t) ||
    /\b(what|how|when|where|why|who|which|can you|do you|is there|are you|will you|fee|cost|price|timing|hours|address|open|close|parking|doctor|fever|pain|symptom|insurance|bring|documents|test|report)\b/i.test(
      lower
    );

  /** Queue signup: explicit phrases plus natural "I want a token" style (otherwise Gemini FAQ may refuse tokens). */
  const joinIntent =
    /(\b(join|register|book|appointment|enqueue)\b)|(\bget\s+(a\s+)?token\b)|(\badd\s+me(\s+to)?\s*(the\s+)?queue\b)|(\bsee\s+(the\s+)?doctor\b)|(\bgive\s+me\s+(the\s+)?(token|queue\s+(number|no|place))\b)|(\b(need|want)\s+(a\s+)?(queue\s+)?token\b)|(\bqueue\s+me\b)|(\bi\s+want\s+(to\s+)?(join|register|a\s+token)\b)/i.test(
      t
    );

  const shortGreeting =
    t.length <= 36 &&
    /^(hi|hello|hey|hii|namaste|good\s+(morning|afternoon|evening))\b/i.test(
      t
    ) &&
    !looksLikeQuestion;

  if (joinIntent) return 'join';

  if (shortGreeting) return 'assist';

  if (looksLikeQuestion) return 'assist';

  return 'assist';
}
