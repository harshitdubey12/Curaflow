import { describe, it } from 'node:test';
import assert from 'node:assert';
import { config } from '../config.js';
import { buildOfflineFaqResponse } from './aiService.js';

describe('buildOfflineFaqResponse', () => {
  it('answers timing questions with clinicChatbotContext when set', () => {
    const prev = config.clinicChatbotContext;
    config.clinicChatbotContext = 'Mon-Fri 9-5, Sat 9-1.';
    try {
      const text = buildOfflineFaqResponse('What are your timings?', { language: 'en' });
      assert.ok(/Mon-Fri 9-5/i.test(text), 'should echo configured hours');
      assert.ok(/Hours and timings/i.test(text) || /timings/i.test(text));
    } finally {
      config.clinicChatbotContext = prev;
    }
  });

  it('uses default hours line when no CLINIC_CHATBOT_CONTEXT and user asks hours', () => {
    const prev = config.clinicChatbotContext;
    const prevDef = config.defaultClinicHoursLineEn;
    config.clinicChatbotContext = '';
    config.defaultClinicHoursLineEn = 'Custom default hours line for tests.';
    try {
      const text = buildOfflineFaqResponse('When are you open?', { language: 'en' });
      assert.ok(/Custom default hours line/i.test(text));
      assert.ok(/Hours:/i.test(text));
      assert.ok(/emergency|112|108/i.test(text));
    } finally {
      config.clinicChatbotContext = prev;
      config.defaultClinicHoursLineEn = prevDef;
    }
  });

  it('answers fee question without ctx using offline template', () => {
    const prev = config.clinicChatbotContext;
    config.clinicChatbotContext = '';
    try {
      const text = buildOfflineFaqResponse('What are your fees?', { language: 'en' });
      assert.ok(/Fees and pricing|reception/i.test(text));
      assert.ok(/JOIN/i.test(text));
    } finally {
      config.clinicChatbotContext = prev;
    }
  });

  it('includes queue context when waiting', () => {
    const prev = config.clinicChatbotContext;
    config.clinicChatbotContext = 'Hours 9-5.';
    try {
      const text = buildOfflineFaqResponse('timings?', {
        language: 'en',
        queueContext: { status: 'waiting', token: 4, waitMinutes: 12 },
      });
      assert.ok(String(text).includes('4'));
      assert.ok(/12|token|wait/i.test(text));
    } finally {
      config.clinicChatbotContext = prev;
    }
  });
});
