import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

const AI_MODEL_CHAIN = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

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

function isNotFoundModel(e) {
  const s = String(e?.message || e);
  return s.includes('404') && s.includes('not found');
}

const SYSTEM_PROMPT = `You are a helpful clinic assistant.
Answer patient questions clearly and briefly.
Help them with:
- clinic timings
- services
- appointment guidance
- basic health queries (non-medical advice only)
If question is medical emergency, tell them to contact doctor immediately.`;

/**
 * Offline FAQ when GEMINI_API_KEY is missing or every model fails.
 * Uses CLINIC_CHATBOT_CONTEXT when set. Does not set patient department (that is classifyDepartment in department.service).
 * @param {string} userMessage
 * @param {object} [options]
 */
export function buildOfflineFaqResponse(userMessage, options = {}) {
  const msg = String(userMessage ?? '').trim();
  const lang = String(options.language || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
  const ctx = (config.clinicChatbotContext || '').trim();

  const looksTiming =
    /\b(timings?|hours?|open|close|closed|when\s+do\s+you|what\s+time|schedule|how\s+late|how\s+early|working\s+days)\b/i.test(
      msg
    );

  const qc = options.queueContext;
  let queueHint = '';
  if (qc && qc.status === 'waiting' && qc.token != null) {
    queueHint =
      lang === 'hi'
        ? ` आपकी कतार में टोकन ${qc.token} है, लगभग ${qc.waitMinutes} मिनट अनुमानित प्रतीक्षा।`
        : ` You are in the queue with token ${qc.token}, about ${qc.waitMinutes} minutes estimated wait.`;
  } else if (qc && qc.status === 'serving' && qc.token != null) {
    queueHint =
      lang === 'hi'
        ? ` अब आपकी बारी है (टोकन ${qc.token})।`
        : ` It is your turn now (token ${qc.token}).`;
  }

  if (looksTiming) {
    if (ctx) {
      return lang === 'hi'
        ? `समय की जानकारी: ${ctx} सटीक विवरण के लिए रिसेप्शन से पुष्टि करें।${queueHint}`
        : `Hours and timings: ${ctx} Please confirm details with reception if needed.${queueHint}`;
    }
    const fallbackLine =
      lang === 'hi' ? config.defaultClinicHoursLineHi : config.defaultClinicHoursLineEn;
    return lang === 'hi'
      ? `समय: ${fallbackLine} आपातकाल में स्थानीय आपातकालीन सेवा डायल करें।${queueHint}`
      : `Hours: ${fallbackLine} For emergencies, use local emergency services (for example 112 or 108 in many parts of India).${queueHint}`;
  }

  if (ctx) {
    return lang === 'hi'
      ? `क्लिनिक की जानकारी: ${ctx} और सवालों के लिए रिसेप्शन से बात करें या JOIN से कतार में शामिल हों।${queueHint}`
      : `Clinic information: ${ctx} For more help, ask reception or say JOIN to join the queue.${queueHint}`;
  }

  if (!ctx) {
    if (/\b(fee|fees|cost|price|charges?|how much|payment|pay)\b/i.test(msg)) {
      return lang === 'hi'
        ? `शुल्क की सटीक जानकारी इस चैट में नहीं है। रिसेप्शन से पूछें। टोकन के लिए JOIN।${queueHint}`
        : `Fees and pricing are not stored in this chat. Ask reception for current rates. Say JOIN to get a queue token.${queueHint}`;
    }
    if (/\b(where|address|location|directions?|map|reach|find you)\b/i.test(msg)) {
      return lang === 'hi'
        ? `पता इस चैट में सहेजा नहीं है। रिसेप्शन से पूछें या वेबसाइट देखें। टोकन के लिए JOIN।${queueHint}`
        : `The address is not stored here. Ask reception or check the clinic website. Say JOIN to get a queue token.${queueHint}`;
    }
    if (/\b(parking|park|car)\b/i.test(msg)) {
      return lang === 'hi'
        ? `पार्किंग की जानकारी रिसेप्शन से पुष्टि करें। टोकन के लिए JOIN।${queueHint}`
        : `Ask reception about parking. Say JOIN to get a queue token.${queueHint}`;
    }
    if (/\b(emergency|ambulance|112|108|911|999)\b/i.test(msg)) {
      return lang === 'hi'
        ? `जानलेवा आपातकाल में तुरंत स्थानीय आपातकालीन नंबर डायल करें (उदाहरण 112 या 108)। चैट आपातकाल का विकल्प नहीं है।${queueHint}`
        : `For life-threatening emergencies, call local emergency services right away (for example 112 or 108 in many parts of India). Do not rely on chat for emergencies.${queueHint}`;
    }
    if (/\b(bring|document|id|insurance|report|test|lab)\b/i.test(msg)) {
      return lang === 'hi'
        ? `क्या लाना है, रिसेप्शन या डॉक्टर से पुष्टि करें। आम तौर पर पहचान पत्र लाएं। टोकन के लिए JOIN।${queueHint}`
        : `What to bring depends on your visit. Ask reception. Usually bring ID and any past reports you have. Say JOIN to get a queue token.${queueHint}`;
    }
    if (/\b(what services|services|treatment|specialist)\b/i.test(msg)) {
      return lang === 'hi'
        ? `सेवाओं की सूची इस चैट में पूरी नहीं है। रिसेप्शन से पूछें। टोकन के लिए JOIN।${queueHint}`
        : `Services are not fully listed here. Ask reception what the clinic offers. Say JOIN to get a queue token.${queueHint}`;
    }
  }

  return lang === 'hi'
    ? `मदद के लिए HELP, टोकन के लिए JOIN लिखें।${queueHint}`
    : `Say HELP for options or JOIN to get a queue token.${queueHint}`;
}

/**
 * FAQ and general guidance for WhatsApp. Uses Gemini (gemini-1.5-flash first).
 *
 * Supported call shapes:
 * - `generateAIResponse(message)` — same as `generateAIResponse(message, {})`
 * - `generateAIResponse(message, { queueContext, language, intent })`
 *
 * @param {string} userMessage
 * @param {object} [options]
 * @param {object} [options.queueContext] { status, token?, waitMinutes? }
 * @param {string} [options.language] en | hi
 * @param {string} [options.intent] help | status | assist
 *
 * If there is no API key, or every Gemini model fails, returns {@link buildOfflineFaqResponse}
 * instead of throwing so WhatsApp still gets timings from CLINIC_CHATBOT_CONTEXT when configured.
 */
export async function generateAIResponse(userMessage, options = {}) {
  const key = geminiKey();
  if (!key) {
    return buildOfflineFaqResponse(String(userMessage || ''), options);
  }

  const lang = String(options.language || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
  const langLine =
    lang === 'hi'
      ? 'Reply in Hindi (Devanagari is fine). Keep it short.'
      : 'Reply in English. Keep it short.';

  const clinic = (config.clinicChatbotContext || '').trim();
  const clinicBlock = clinic
    ? `Clinic facts you may use (only if relevant; otherwise say reception can confirm):\n${clinic}\n\n`
    : '';

  let qc = '';
  const q = options.queueContext;
  if (q && q.status && q.status !== 'none') {
    if (q.status === 'waiting') {
      qc = `Patient queue status: waiting, token ${q.token}, about ${q.waitMinutes} minutes estimated wait.\n`;
    } else if (q.status === 'serving') {
      qc = `Patient queue status: it is their turn now, token ${q.token}.\n`;
    }
  } else if (q && q.status === 'none') {
    qc = 'Patient is not currently in the queue.\n';
  }

  const intent = options.intent ? String(options.intent) : '';
  const intentBlock = intent
    ? `The user message type is roughly: ${intent}. Answer accordingly.\n`
    : '';

  const prompt = `${SYSTEM_PROMPT}

${langLine}

${clinicBlock}${qc}${intentBlock}Patient message:
${String(userMessage || '').trim()}

Your reply (plain text, no markdown, max about 8 short sentences):`;

  const genAI = new GoogleGenerativeAI(key);
  let lastErr;

  for (const modelName of AI_MODEL_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.6,
        },
      });
      const result = await model.generateContent(prompt);
      const text = extractTextFromResult(result);
      if (text) {
        return text.length > 1600 ? `${text.slice(0, 1597)}...` : text;
      }
      lastErr = new Error(`Empty response from ${modelName}`);
    } catch (e) {
      lastErr = e;
      if (isNotFoundModel(e)) {
        console.warn(`[aiService] model ${modelName} not available, trying next`);
      } else {
        console.warn(`[aiService] model ${modelName}:`, e?.message || e);
      }
    }
  }

  console.warn('[aiService] all Gemini models failed, using offline FAQ text:', lastErr?.message || lastErr);
  return buildOfflineFaqResponse(String(userMessage || ''), options);
}
