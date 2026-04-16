import { prisma } from '../prisma.js';
import { sendWhatsAppMessage } from './twilio.service.js';
import { config } from '../config.js';
import { broadcastTextForPatient } from './translation.service.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Send one WhatsApp text to every patient. Small delay between sends to reduce Twilio rate limits.
 * @param {string} messageEn primary message (English or default for all)
 * @param {string} [messageHi] optional Hindi body; used for patients with Hindi preference when non-empty
 */
export async function sendBroadcastMessage(messageEn, messageHi) {
  const primary = String(messageEn ?? '').trim();
  if (!primary) {
    const err = new Error('message is required');
    err.statusCode = 400;
    throw err;
  }

  const patients = await prisma.patient.findMany({
    select: { id: true, phone: true, language: true },
  });

  const delayMs = config.broadcastMessageDelayMs;
  const results = {
    total: patients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: /** @type {{ phone: string, error: string }[]} */ ([]),
  };

  for (const p of patients) {
    try {
      const body = broadcastTextForPatient(primary, messageHi, p.language);
      const r = await sendWhatsAppMessage(p.phone, body);
      if (r.sent === true) results.sent += 1;
      else if (r.skipped) results.skipped += 1;
      else {
        results.failed += 1;
        results.errors.push({
          phone: p.phone,
          error: r.error != null ? String(r.error) : 'send failed',
        });
      }
    } catch (e) {
      results.failed += 1;
      results.errors.push({
        phone: p.phone,
        error: e?.message != null ? String(e.message) : String(e),
      });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  return results;
}
