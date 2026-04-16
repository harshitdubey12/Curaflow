/**
 * Key-based copy for outbound WhatsApp (English + Hindi).
 * Use translateMessage(key, language, vars) — vars replace {{name}} style tokens.
 */

const CATALOG = {
  en: {
    registrationWait:
      'You are registered, {{name}}. Your token is {{token}}. Estimated wait: about {{wait}} minutes.',
    tokenCalled: 'Please arrive. Token {{token}} is being called now.',
    comingSoon: 'Your turn is coming soon. Please be ready.',
    doctorDelayed:
      'Doctor is delayed by approximately {{minutes}} minutes. Thank you for your patience.',
    followUp:
      'Hope you are feeling better. Reply YES to book a follow-up appointment.',
    broadcastFallbackEnglish:
      'Staff did not provide a Hindi version of this message, so you are seeing the English text below.',
    chatbotWelcomeGreetNamed: 'Hi {{firstName}}! Welcome to the clinic.',
    chatbotWelcomeGreet: 'Hi! Welcome to the clinic.',
    chatbotWelcomeRest:
      'Your token number is {{token}} and your estimated wait is about {{wait}} minutes. We will call you when it is your turn.',
    chatbotHelpMenu:
      'Say JOIN or REGISTER to get a token. Say STATUS for your wait. You can also ask timings, fees, emergency numbers, or what to bring.',
    chatbotStatusWaiting:
      "You're in line with token {{token}}. Estimated wait about {{wait}} minutes.",
    chatbotStatusServing: "It's your turn. Please come in (token {{token}}).",
    chatbotStatusNone: "You're not in the queue. Say JOIN to get a token, or HELP.",
    chatbotEmergency:
      "You're in line (token {{token}}). For emergencies in India many people dial 112 or 108 for ambulance in several states. Confirm at reception. Estimated wait about {{wait}} minutes.",
    chatbotSmallTalk:
      "Hello, thanks for writing in. You're still in the queue with token {{token}}, about {{wait}} minutes estimated. Ask me anything about the clinic.",
    chatbotWaitingShort:
      "You're in line with token {{token}}. Estimated wait about {{wait}} minutes.",
    chatbotSayHiJoin: 'Say JOIN to get a token, or HELP.',
    chatbotUrgentCare:
      'This could be serious. Please contact a doctor immediately. If it is an emergency, use emergency services (for example 112 or 108 in many parts of India). Do not rely on chat for emergencies.',
    chatbotError: 'Sorry, something went wrong. Please try again or use the web form.',
  },
  hi: {
    registrationWait:
      '{{name}}, आपका पंजीकरण हो गया है। आपका टोकन नंबर {{token}} है। अनुमानित प्रतीक्षा लगभग {{wait}} मिनट है।',
    tokenCalled: 'कृपया आ जाएं। टोकन {{token}} अब बुलाया जा रहा है।',
    comingSoon: 'आपकी बारी जल्दी है। कृपया तैयार रहें।',
    doctorDelayed:
      'डॉक्टर लगभग {{minutes}} मिनट देरी से हैं। धैर्य के लिए धन्यवाद।',
    followUp:
      'उम्मीद है आप अब बेहतर महसूस कर रहे हैं। फॉलो-अप बुक करने के लिए YES जवाब दें।',
    broadcastFallbackEnglish:
      'हिंदी संदेश उपलब्ध नहीं है, इसलिए नीचे अंग्रेज़ी संदेश भेजा जा रहा है।',
    chatbotWelcomeGreetNamed: 'नमस्ते {{firstName}}! क्लिनिक में आपका स्वागत है।',
    chatbotWelcomeGreet: 'नमस्ते! क्लिनिक में आपका स्वागत है।',
    chatbotWelcomeRest:
      'आपका टोकन नंबर {{token}} है और अनुमानित प्रतीक्षा लगभग {{wait}} मिनट है। आपकी बारी आने पर हम बुलाएंगे।',
    chatbotHelpMenu:
      'टोकन के लिए JOIN या REGISTER लिखें। स्थिति के लिए STATUS। समय, शुल्क, आपातकालीन नंबर या क्या लाना है, यह भी पूछ सकते हैं।',
    chatbotStatusWaiting:
      'आप लाइन में हैं, टोकन {{token}}। अनुमानित प्रतीक्षा लगभग {{wait}} मिनट।',
    chatbotStatusServing: 'अब आपकी बारी है। कृपया अंदर आएं (टोकन {{token}})।',
    chatbotStatusNone: 'अभी आप कतार में नहीं हैं। टोकन के लिए JOIN लिखें या HELP।',
    chatbotEmergency:
      'आप कतार में हैं (टोकन {{token}})। आपातकाल में भारत में अक्सर 112 या कई राज्यों में एम्बुलेंस के लिए 108 डायल करते हैं। रिसेप्शन पर पुष्टि करें। अनुमानित प्रतीक्षा लगभग {{wait}} मिनट।',
    chatbotSmallTalk:
      'नमस्ते, संदेश के लिए धन्यवाद। आप अभी भी कतार में हैं, टोकन {{token}}, लगभग {{wait}} मिनट। क्लिनिक के बारे में कुछ भी पूछ सकते हैं।',
    chatbotWaitingShort:
      'आप लाइन में हैं, टोकन {{token}}। अनुमानित प्रतीक्षा लगभग {{wait}} मिनट।',
    chatbotSayHiJoin: 'टोकन के लिए JOIN लिखें, या HELP।',
    chatbotUrgentCare:
      'यह गंभीर हो सकता है। कृपया तुरंत डॉक्टर से संपर्क करें। आपातकाल में आपातकालीन सेवा (उदाहरण 112 या 108) डायल करें। चैट पर भरोसा न करें।',
    chatbotError:
      'क्षमा करें, कुछ गलत हो गया। कृपया दोबारा कोशिश करें या वेब फॉर्म उपयोग करें।',
  },
};

/**
 * Staff broadcast: patients with Hindi preference receive `messageHi` when it is non-empty; otherwise `messageEn`.
 * Appends a short note when falling back to English for Hindi patients so it is not silent.
 */
export function broadcastTextForPatient(messageEn, messageHi, patientLanguage) {
  const lang = normalizeLanguage(patientLanguage);
  const primary = String(messageEn ?? '').trim();
  const hi = String(messageHi ?? '').trim();
  if (lang === 'hi' && hi.length > 0) {
    return hi;
  }
  if (lang === 'hi' && hi.length === 0 && primary.length > 0) {
    const note = translateMessage('broadcastFallbackEnglish', 'hi', {});
    return `${note}\n\n${primary}`;
  }
  return primary;
}

/**
 * @param {string | null | undefined} raw
 * @returns {'en' | 'hi'}
 */
export function normalizeLanguage(raw) {
  const s = String(raw ?? 'en').trim().toLowerCase();
  if (s === 'hi' || s === 'hindi' || s === 'hin') return 'hi';
  return 'en';
}

/**
 * @param {string} messageKey
 * @param {string | null | undefined} language
 * @param {Record<string, string | number>} [vars]
 */
export function translateMessage(messageKey, language, vars = {}) {
  const lang = normalizeLanguage(language);
  const table = CATALOG[lang] ?? CATALOG.en;
  let template = table[messageKey] ?? CATALOG.en[messageKey] ?? messageKey;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    return v != null ? String(v) : '';
  });
}
