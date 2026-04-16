import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { normalizeLanguage, translateMessage } from './translation.service.js';

/**
 * Tried in order (override with GEMINI_MODEL=comma,separated,list).
 * gemini-1.5-flash without a version often 404s on v1beta; 2.0-flash free tier can hit 429 — try 2.5 first.
 * @see https://ai.google.dev/gemini-api/docs/models
 */
const DEFAULT_MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
];

function cleanGeminiKey(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function geminiKey() {
  return cleanGeminiKey(config.geminiApiKey);
}

function modelChain() {
  const fromEnv = (process.env.GEMINI_MODEL || '').trim();
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_MODEL_CHAIN;
}

function extractTextFromResult(result) {
  try {
    const t = result.response?.text?.();
    if (t && String(t).trim()) return String(t).trim();
  } catch {
    /* fall through */
  }
  const parts = result.response?.candidates?.[0]?.content?.parts;
  if (parts?.length) {
    const joined = parts.map((p) => p.text || '').join('');
    if (joined.trim()) return joined.trim();
  }
  return '';
}

function isRateLimited(e) {
  const s = String(e?.message || e);
  return s.includes('429') || s.includes('Too Many Requests') || s.includes('quota');
}

function isNotFoundModel(e) {
  const s = String(e?.message || e);
  return s.includes('404') && s.includes('not found');
}

/**
 * Run prompt through first model that succeeds.
 * Does not long-pause on 429 (Twilio webhooks timeout ~15s); tries the next model instead.
 */
async function generateWithGemini(prompt) {
  const key = geminiKey();
  if (!key) throw new Error('Missing GEMINI_API_KEY');

  const genAI = new GoogleGenerativeAI(key);
  const models = modelChain();
  let lastErr;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      });
      const result = await model.generateContent(prompt);
      const text = extractTextFromResult(result);
      if (text) {
        return text;
      }
      lastErr = new Error(`Empty response from ${modelName}`);
    } catch (e) {
      lastErr = e;
      const msg = e?.message || e;
      if (isRateLimited(e)) {
        console.warn(
          `[gemini] model ${modelName}: rate limit / quota — trying next model (do not wait; Twilio webhook would time out). Enable billing or wait for free-tier reset.`
        );
      } else if (isNotFoundModel(e)) {
        console.warn(`[gemini] model ${modelName}: model id not available for this API — trying next`);
      } else {
        console.warn(`[gemini] model ${modelName}:`, msg);
      }
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

/**
 * Optional short helper text for WhatsApp using Gemini (falls back if API missing).
 */
export async function buildWaitTimeMessage(patientName, tokenNumber, waitMinutes) {
  if (!geminiKey()) {
    return `Hi ${patientName}, your token is ${tokenNumber}. Estimated wait: about ${waitMinutes} minutes.`;
  }
  try {
    const prompt = `Write one short friendly WhatsApp message (max 2 sentences) for a clinic patient: name ${patientName}, token ${tokenNumber}, estimated wait ${waitMinutes} minutes. No emojis. Plain text only.`;
    const text = await generateWithGemini(prompt);
    return text || fallback(patientName, tokenNumber, waitMinutes);
  } catch {
    return fallback(patientName, tokenNumber, waitMinutes);
  }
}

function fallback(patientName, tokenNumber, waitMinutes) {
  return `Hi ${patientName}, your token is ${tokenNumber}. Estimated wait: about ${waitMinutes} minutes.`;
}

/**
 * Modes: assist (default), help_menu, status_query, already_waiting, now_serving, welcome_new
 * @param {object} queueContext { status: 'waiting'|'serving'|'none', token?: number, waitMinutes?: number }
 * @param {string} [patientName] for welcome_new
 * @param {string} [language] patient language code (en or hi); drives fallbacks and Gemini reply language
 */
export async function buildAssistantReply(
  userMessage,
  queueContext,
  mode = 'assist',
  patientName,
  language = 'en'
) {
  const lang = normalizeLanguage(language);
  const replyLangLine =
    lang === 'hi'
      ? 'Write your entire reply in Hindi only (Devanagari script is fine). Do not use English except for token numbers or proper nouns if needed.'
      : 'Write your entire reply in English.';

  const clinicBlock =
    (config.clinicChatbotContext || '').trim() ||
    'Walk-in clinic. Patients join the queue on WhatsApp and are seen in token order.';

  const queueStateForModel = describeQueueStateForModel(queueContext);

  if (!geminiKey()) {
    return assistantReplyFallbackMinimal(queueContext, mode, userMessage, patientName, lang);
  }

  // Hi / hii / join while already in queue: avoid Gemini latency or stalls (Twilio webhook ~15s).
  if (useInstantTemplateForQueueMode(mode, userMessage)) {
    return assistantReplyFallbackMinimal(queueContext, mode, userMessage, patientName, lang);
  }

  const modeBlock = modeInstructions(mode, queueStateForModel, patientName);

  try {
    const prompt = `You are the WhatsApp reception assistant for a clinic.

Clinic information (only state facts you can support from this; if something is not mentioned, say reception can confirm):
${clinicBlock}

This patient's current queue situation:
${queueStateForModel}

${modeBlock}

Language: ${replyLangLine}

Patient message:
${userMessage}

Your reply (plain text only, no markdown, at most 6 short sentences. Address the patient as "you"):`;
    const textRaw = await withGeminiTimeout(() => generateWithGemini(prompt), 12_000);
    const text = String(textRaw ?? '').trim();
    if (text.length > 1500) return `${text.slice(0, 1497)}...`;
    return text || assistantReplyFallbackMinimal(queueContext, mode, userMessage, patientName, lang);
  } catch (e) {
    console.error('[gemini] buildAssistantReply failed:', e?.message || e);
    return assistantReplyFallbackMinimal(queueContext, mode, userMessage, patientName, lang);
  }
}

function useInstantTemplateForQueueMode(_mode, _userMessage) {
  // Disabled: instant templates skip Gemini and feel robotic. Twilio + Gemini stay under ~12s timeout.
  return false;
}

function withGeminiTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), ms)
    ),
  ]);
}

function modeInstructions(mode, queueStateForModel, patientName) {
  const common =
    'Do not diagnose or prescribe. For medical concerns they should see the doctor or use emergency services if urgent.';

  switch (mode) {
    case 'help_menu':
      return `Task: They asked for HELP or the menu. Explain in warm short lines (no markdown bullets with asterisks): they can say hi or JOIN for a queue token, STATUS for token and wait, and they can ask any question (timings, fees, emergency numbers, what to bring). ${common}`;
    case 'status_query':
      return `Task: They asked about status, wait time, token, or place in line. Answer using the queue situation above. If not in queue, say they can say hi or JOIN. ${common}`;
    case 'already_waiting':
      return `Task: They sent hi or join again but are already waiting. Reassure them, give token and estimated wait, and invite them to ask anything (not only queue info). ${common}`;
    case 'now_serving':
      return `Task: It is their turn to be seen. Tell them to come in promptly and mention the token. ${common}`;
    case 'welcome_new':
      return `Task: They just joined the queue. Welcome them by first name if provided (${patientName || 'patient'}), give token and estimated wait, one friendly line. ${common}`;
    default:
      return `Task: Answer their actual message. Do NOT reply with only token and wait unless they only asked for queue status.

If they say hi, thanks, or small talk, respond naturally in one or two sentences, then you may briefly mention they are still in line if relevant.

If they ask for emergency numbers, give common public numbers for their region (e.g. India 112, 108 ambulance in many states; US 911; UK 999 or 112) and say to confirm locally.

You may discuss: clinic hours, location, fees if in clinic info, documents, parking, queue, emergencies. ${common}`;
  }
}

/** Internal summary for the model only. */
function describeQueueStateForModel(queueContext) {
  if (!queueContext || queueContext.status === 'none') {
    return 'Not currently in the queue (no active token).';
  }
  if (queueContext.status === 'waiting') {
    return `Waiting in queue. Token number ${queueContext.token}. Estimated wait about ${queueContext.waitMinutes} minutes.`;
  }
  if (queueContext.status === 'serving') {
    return `It is their turn now. Token ${queueContext.token}. They should come in.`;
  }
  return 'Not currently in the queue.';
}

function looksEmergencyAsk(t) {
  return /\b(emergency|ambulance|112|911|108|999|local\s+no|give\s+me.*number)\b/i.test(
    t
  );
}

function looksSmallTalk(t) {
  return /^(hi|hii|hello|hey|how\s+are\s+you|thanks|thank\s+you|ok|okay|bye)\b/i.test(
    t.trim()
  );
}

/** When GEMINI_API_KEY is missing or every model failed. */
function assistantReplyFallbackMinimal(
  queueContext,
  mode = 'assist',
  userMessage = '',
  patientName,
  language = 'en'
) {
  const lang = normalizeLanguage(language);
  const t = (userMessage || '').trim();
  const first =
    typeof patientName === 'string' && patientName.trim()
      ? patientName.trim().split(/\s+/)[0]
      : '';

  if (mode === 'welcome_new' && queueContext?.status === 'waiting') {
    const token = queueContext.token;
    const wait = queueContext.waitMinutes;
    const greet = first
      ? translateMessage('chatbotWelcomeGreetNamed', lang, { firstName: first })
      : translateMessage('chatbotWelcomeGreet', lang, {});
    const rest = translateMessage('chatbotWelcomeRest', lang, {
      token,
      wait,
    });
    return `${greet} ${rest}`;
  }

  if (mode === 'help_menu') {
    return translateMessage('chatbotHelpMenu', lang, {});
  }
  if (mode === 'status_query' || mode === 'already_waiting') {
    if (queueContext?.status === 'waiting') {
      return translateMessage('chatbotStatusWaiting', lang, {
        token: queueContext.token,
        wait: queueContext.waitMinutes,
      });
    }
    if (queueContext?.status === 'serving') {
      return translateMessage('chatbotStatusServing', lang, {
        token: queueContext.token,
      });
    }
    return translateMessage('chatbotStatusNone', lang, {});
  }

  if (queueContext?.status === 'waiting') {
    if (mode === 'assist') {
      if (looksEmergencyAsk(t)) {
        return translateMessage('chatbotEmergency', lang, {
          token: queueContext.token,
          wait: queueContext.waitMinutes,
        });
      }
      if (looksSmallTalk(t)) {
        return translateMessage('chatbotSmallTalk', lang, {
          token: queueContext.token,
          wait: queueContext.waitMinutes,
        });
      }
    }
    return translateMessage('chatbotWaitingShort', lang, {
      token: queueContext.token,
      wait: queueContext.waitMinutes,
    });
  }
  if (queueContext?.status === 'serving') {
    return translateMessage('chatbotStatusServing', lang, {
      token: queueContext.token,
    });
  }
  return translateMessage('chatbotSayHiJoin', lang, {});
}
