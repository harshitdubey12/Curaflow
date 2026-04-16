import { generateAIResponse } from './aiService.js';
import { buildAssistantReply } from './gemini.service.js';
import { translateMessage } from './translation.service.js';
import { isLikelyMedicalEmergency } from '../utils/whatsappUrgency.util.js';

/**
 * FAQ and guidance via Gemini; offline text from generateAIResponse when no key or all models fail;
 * legacy gemini.service templates only if generateAIResponse throws.
 * Department routing for patients is classifyDepartment (queue lane), not this module.
 * Optional `deps` overrides are for unit tests (mock Gemini).
 *
 * @param {string} body
 * @param {object} queueContext
 * @param {'help'|'status'|'assist'} intent
 * @param {string} patientLang
 * @param {Partial<{
 *   generateAIResponse: typeof generateAIResponse,
 *   buildAssistantReply: typeof buildAssistantReply,
 *   translateMessage: typeof translateMessage,
 *   isLikelyMedicalEmergency: typeof isLikelyMedicalEmergency
 * }>} [deps]
 */
export async function faqReplyWithFallback(body, queueContext, intent, patientLang, deps = {}) {
  const genAI = deps.generateAIResponse ?? generateAIResponse;
  const build = deps.buildAssistantReply ?? buildAssistantReply;
  const tr = deps.translateMessage ?? translateMessage;
  const urgent = deps.isLikelyMedicalEmergency ?? isLikelyMedicalEmergency;

  if (urgent(body)) {
    return tr('chatbotUrgentCare', patientLang, {});
  }
  try {
    return await genAI(body, {
      queueContext,
      language: patientLang,
      intent,
    });
  } catch (e) {
    console.warn('[whatsapp] FAQ AI failed, legacy assistant:', e?.message || e);
    if (intent === 'help') {
      return build(body, queueContext, 'help_menu', undefined, patientLang);
    }
    if (intent === 'status') {
      const qc =
        queueContext && queueContext.status !== undefined ? queueContext : { status: 'none' };
      return build(body, qc, 'status_query', undefined, patientLang);
    }
    return build(body, queueContext, 'assist', undefined, patientLang);
  }
}
