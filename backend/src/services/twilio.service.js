import twilio from 'twilio';
import { config } from '../config.js';

function getClient() {
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    return null;
  }
  return twilio(config.twilioAccountSid, config.twilioAuthToken);
}

/**
 * Preferred entry for outbound automation (notifications, skip/promote, follow-up, patient register).
 * Delegates to sendWhatsApp (same behaviour, Twilio REST + env flags).
 */
export async function sendWhatsAppMessage(phone, message) {
  return sendWhatsApp(phone, message);
}

/**
 * Send WhatsApp message. `to` should be whatsapp:+E164 without duplication of prefix if already present.
 * Never throws: Twilio network/API failures are logged and returned as { sent: false } so queue logic can still commit.
 */
export async function sendWhatsApp(to, body) {
  if (config.disableOutboundWhatsApp) {
    return { skipped: true, sent: false };
  }
  const client = getClient();
  if (!client || !config.twilioWhatsAppFrom) {
    console.warn('[Twilio] Not configured; skipping WhatsApp send:', body.slice(0, 80));
    return { skipped: true, sent: false };
  }
  const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const fromAddr = config.twilioWhatsAppFrom.startsWith('whatsapp:')
    ? config.twilioWhatsAppFrom
    : `whatsapp:${config.twilioWhatsAppFrom}`;

  try {
    const msg = await client.messages.create({
      from: fromAddr,
      to: toAddr,
      body,
    });
    return { sent: true, sid: msg.sid };
  } catch (err) {
    const message = err?.message != null ? String(err.message) : String(err);
    const quotaExceeded = isTwilioWhatsAppQuotaOrCapError(message);
    console.error(
      '[Twilio] WhatsApp send failed:',
      message,
      quotaExceeded ? '(daily limit / trial cap — outbound replies may fail until reset or upgrade)' : ''
    );
    return { sent: false, error: message, quotaExceeded };
  }
}

/** Trial/sandbox often allows ~50 WhatsApp messages per day; same cap can block REST and TwiML replies. */
export function isTwilioWhatsAppQuotaOrCapError(message) {
  const s = String(message).toLowerCase();
  if (s.includes('50') && s.includes('daily')) return true;
  if (s.includes('daily') && (s.includes('limit') || s.includes('exceeded'))) return true;
  if (s.includes('63016') || s.includes('63018')) return true;
  return false;
}

export function normalizePhoneForStorage(raw) {
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return trimmed;
}
