import { describe, it } from 'node:test';
import assert from 'node:assert';
import { faqReplyWithFallback } from './faqReply.service.js';

describe('faqReplyWithFallback', () => {
  it('returns urgent care copy without calling Gemini when urgency detector fires', async () => {
    let genCalled = false;
    const out = await faqReplyWithFallback(
      'severe chest pain and short of breath',
      { status: 'waiting', token: 3, waitMinutes: 10 },
      'assist',
      'en',
      {
        generateAIResponse: async () => {
          genCalled = true;
          return 'should not run';
        },
        buildAssistantReply: async () => 'legacy',
        translateMessage: (key) => (key === 'chatbotUrgentCare' ? 'URGENT_TEST' : key),
        isLikelyMedicalEmergency: () => true,
      }
    );
    assert.strictEqual(out, 'URGENT_TEST');
    assert.strictEqual(genCalled, false);
  });

  it('returns Gemini text when generateAIResponse succeeds', async () => {
    const out = await faqReplyWithFallback('What are your timings?', { status: 'none' }, 'assist', 'en', {
      generateAIResponse: async () => 'We open at nine.',
      buildAssistantReply: async () => {
        throw new Error('legacy should not run');
      },
      translateMessage: (key) => key,
      isLikelyMedicalEmergency: () => false,
    });
    assert.strictEqual(out, 'We open at nine.');
  });

  it('falls back to help_menu when intent is help and AI throws', async () => {
    const out = await faqReplyWithFallback('help', {}, 'help', 'en', {
      generateAIResponse: async () => {
        throw new Error('Missing GEMINI_API_KEY');
      },
      buildAssistantReply: async (_msg, _qc, mode) => `fallback:${mode}`,
      translateMessage: (key) => key,
      isLikelyMedicalEmergency: () => false,
    });
    assert.strictEqual(out, 'fallback:help_menu');
  });

  it('uses status none when intent is status and AI throws', async () => {
    const out = await faqReplyWithFallback('status', {}, 'status', 'en', {
      generateAIResponse: async () => {
        throw new Error('fail');
      },
      buildAssistantReply: async (_msg, qc, mode) => `${mode}:${qc.status}`,
      translateMessage: (key) => key,
      isLikelyMedicalEmergency: () => false,
    });
    assert.strictEqual(out, 'status_query:none');
  });

  it('falls back to assist mode when intent is assist and AI throws', async () => {
    const out = await faqReplyWithFallback('hello', { status: 'waiting', token: 1, waitMinutes: 5 }, 'assist', 'hi', {
      generateAIResponse: async () => {
        throw new Error('fail');
      },
      buildAssistantReply: async (_msg, qc, mode) => `${mode}:${qc.status}`,
      translateMessage: (key) => key,
      isLikelyMedicalEmergency: () => false,
    });
    assert.strictEqual(out, 'assist:waiting');
  });
});
