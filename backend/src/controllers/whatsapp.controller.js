import twilio from 'twilio';
import { QueueStatus } from '@prisma/client';
import { prisma } from '../prisma.js';
import * as queueService from '../services/queue.service.js';
import { buildAssistantReply } from '../services/gemini.service.js';
import { normalizeLanguage, translateMessage } from '../services/translation.service.js';
import { faqReplyWithFallback } from '../services/faqReply.service.js';
import {
  normalizePhoneForStorage,
  sendWhatsAppMessage,
  isTwilioWhatsAppQuotaOrCapError,
} from '../services/twilio.service.js';
import { detectWhatsAppIntent } from '../services/whatsapp-intent.js';
import { getIo } from '../socket.js';

/**
 * WHATSAPP FLOW (Twilio inbound webhook)
 * Incoming message hits POST /whatsapp-webhook.
 * New user (no active queue row): register patient, assign token, reply with token and estimated wait.
 * Reply is sent to the same WhatsApp number that sent the message (Twilio From on the request).
 */

/** Browser or Twilio console GET check: confirms route exists (inbound messages must use HTTP POST). */
export function webhookInfo(_req, res) {
  res.type('text/plain').send(
    'Curaflow WhatsApp webhook. Twilio must send inbound messages with HTTP POST to this path.'
  );
}

/**
 * Inbound WhatsApp: compute reply text, then deliver to the user's phone.
 * Primary: Twilio REST (messages.create) so text shows in the WhatsApp app.
 * Fallback: TwiML Message on the HTTP response if REST is unavailable or fails.
 * Server logs are only for debugging; patients see messages in WhatsApp, not in the terminal.
 */
export async function webhook(req, res) {
  const twiml = new twilio.twiml.MessagingResponse();
  const fromRaw = req.body?.From || '';
  const phone = normalizePhoneFromWhatsApp(fromRaw);

  res.on('finish', () => {
    console.log('[whatsapp-webhook] response sent http=', res.statusCode);
  });

  try {
    const body = normalizeIncomingBody(req.body?.Body ?? req.body?.body);
    const intent = detectWhatsAppIntent(body);

    const twilioInboundSid = req.body?.MessageSid || req.body?.SmsMessageSid || '';
    console.log(
      '[whatsapp-webhook] inbound',
      'from=',
      redactWhatsAppFrom(fromRaw),
      'intent=',
      intent,
      'body=',
      JSON.stringify(body.slice(0, 80)),
      twilioInboundSid ? `inboundSid=${twilioInboundSid}` : ''
    );

    const pos = await queueService.getPositionByPhone(phone);
    const queueContext = queueContextFromPosition(pos);
    let patientLang = await resolveLanguageForPhone(phone, pos);

    if (pos) {
      if (intent === 'help') {
        const reply = await faqReplyWithFallback(body, queueContext, 'help', patientLang);
        return respond(twiml, res, fromRaw, phone, reply);
      }
      if (intent === 'status') {
        const reply = await faqReplyWithFallback(body, queueContext, 'status', patientLang);
        return respond(twiml, res, fromRaw, phone, reply);
      }
      if (intent === 'assist') {
        const reply = await faqReplyWithFallback(body, queueContext, 'assist', patientLang);
        return respond(twiml, res, fromRaw, phone, reply);
      }

      const name =
        body.length > 0 ? body.slice(0, 120) : `Patient ${phone.slice(-4)}`;

      const result = await queueService.enqueueOrGetExistingForWhatsApp({
        name,
        phone,
        symptoms: body.length > 2 ? body.slice(0, 500) : null,
      });

      const io = getIo();
      if (io) await queueService.broadcastQueue(io);

      const token = result.queueEntry.tokenNumber;
      const wait = result.estimatedWaitMinutes;
      const qc = {
        status: result.kind === 'now_serving' ? 'serving' : 'waiting',
        token,
        waitMinutes: wait,
      };

      patientLang = normalizeLanguage(result.patient.language);
      let reply;
      if (result.kind === 'now_serving') {
        reply = await buildAssistantReply(body, qc, 'now_serving', undefined, patientLang);
      } else if (result.kind === 'still_waiting') {
        reply = await buildAssistantReply(body, qc, 'already_waiting', undefined, patientLang);
      } else {
        reply = await buildAssistantReply(
          body,
          qc,
          'welcome_new',
          result.patient.name,
          patientLang
        );
      }
      return respond(twiml, res, fromRaw, phone, reply);
    }

    if (intent === 'help') {
      const reply = await faqReplyWithFallback(body, queueContext, 'help', patientLang);
      return respond(twiml, res, fromRaw, phone, reply);
    }

    if (intent === 'status') {
      const reply = await faqReplyWithFallback(body, { status: 'none' }, 'status', patientLang);
      return respond(twiml, res, fromRaw, phone, reply);
    }

    if (intent === 'assist') {
      const reply = await faqReplyWithFallback(body, queueContext, 'assist', patientLang);
      return respond(twiml, res, fromRaw, phone, reply);
    }

    const name =
      body.length > 0 ? body.slice(0, 120) : `Patient ${phone.slice(-4)}`;

    const result = await queueService.enqueueOrGetExistingForWhatsApp({
      name,
      phone,
      symptoms: body.length > 2 ? body.slice(0, 500) : null,
    });

    const io = getIo();
    if (io) await queueService.broadcastQueue(io);

    const token = result.queueEntry.tokenNumber;
    const wait = result.estimatedWaitMinutes;
    const qc = {
      status: result.kind === 'now_serving' ? 'serving' : 'waiting',
      token,
      waitMinutes: wait,
    };

    patientLang = normalizeLanguage(result.patient.language);
    let reply;
    if (result.kind === 'now_serving') {
      reply = await buildAssistantReply(body, qc, 'now_serving', undefined, patientLang);
    } else if (result.kind === 'still_waiting') {
      reply = await buildAssistantReply(body, qc, 'already_waiting', undefined, patientLang);
    } else {
      reply = await buildAssistantReply(
        body,
        qc,
        'welcome_new',
        result.patient.name,
        patientLang
      );
    }
    return respond(twiml, res, fromRaw, phone, reply);
  } catch (e) {
    console.error('[whatsapp-webhook]', e);
    let errLang = 'en';
    try {
      const p = await prisma.patient.findUnique({
        where: { phone },
        select: { language: true },
      });
      errLang = normalizeLanguage(p?.language);
    } catch {
      /* ignore */
    }
    return respond(
      twiml,
      res,
      fromRaw,
      phone,
      translateMessage('chatbotError', errLang, {})
    );
  }
}

async function resolveLanguageForPhone(phone, pos) {
  if (pos?.patient?.language != null && String(pos.patient.language).trim() !== '') {
    return normalizeLanguage(pos.patient.language);
  }
  const p = await prisma.patient.findUnique({
    where: { phone },
    select: { language: true },
  });
  return normalizeLanguage(p?.language);
}

async function recordInboundWhatsAppForPhone(phoneNorm) {
  const normalized = normalizePhoneForStorage(String(phoneNorm).trim());
  const patient = await prisma.patient.findUnique({ where: { phone: normalized } });
  if (!patient) return;
  await prisma.queue.updateMany({
    where: {
      patientId: patient.id,
      status: { in: [QueueStatus.WAITING, QueueStatus.IN_PROGRESS] },
    },
    data: { lastResponseAt: new Date() },
  });
}

async function respond(twiml, res, fromRaw, phoneNorm, maybeText) {
  await recordInboundWhatsAppForPhone(phoneNorm);
  return deliverReply(twiml, res, fromRaw, maybeText);
}

/**
 * Send the text to the user's WhatsApp using Twilio REST (what shows in the app).
 * If that succeeds, HTTP response is empty TwiML so Twilio does not send twice.
 */
async function deliverReply(twiml, res, fromRaw, maybeText) {
  const safe = ensureTwiMLBody(maybeText);
  const r = await sendWhatsAppMessage(fromRaw, safe);

  if (r.sent === true) {
    console.log(
      '[whatsapp-webhook] reply path=rest',
      'to=',
      redactWhatsAppFrom(fromRaw),
      r.sid ? `outboundSid=${r.sid}` : '',
      'chars=',
      safe.length
    );
    res.type('text/xml; charset=utf-8');
    return res.send(twiml.toString());
  }

  if (r.skipped || r.sent === false) {
    const quota =
      r.quotaExceeded === true ||
      (r.error && isTwilioWhatsAppQuotaOrCapError(String(r.error)));
    if (quota) {
      console.error(
        '[whatsapp-webhook] Twilio WhatsApp daily cap reached. REST send failed; using TwiML in response. If the phone still gets no reply, the cap likely blocks outbound replies too until it resets (often midnight UTC) or you upgrade the account. Check Twilio Console → Messaging / Errors.'
      );
    }
    console.warn(
      '[whatsapp-webhook] reply path=twiml_fallback',
      'to=',
      redactWhatsAppFrom(fromRaw),
      'chars=',
      safe.length,
      r.error ? String(r.error).slice(0, 120) : r.skipped ? 'outbound_disabled_or_not_configured' : ''
    );
  }

  twiml.message(safe);
  res.type('text/xml; charset=utf-8');
  return res.send(twiml.toString());
}

/** Last 4 digits only; no full phone in logs. */
function redactWhatsAppFrom(from) {
  const s = String(from).replace(/^whatsapp:/i, '');
  const digits = s.replace(/\D/g, '');
  const tail = digits.slice(-4);
  return tail ? `***${tail}` : '(unknown)';
}

function queueContextFromPosition(pos) {
  if (!pos) return { status: 'none' };
  if (pos.queueEntry.status === QueueStatus.IN_PROGRESS) {
    return { status: 'serving', token: pos.queueEntry.tokenNumber };
  }
  return {
    status: 'waiting',
    token: pos.queueEntry.tokenNumber,
    waitMinutes: pos.estimatedWaitMinutes,
  };
}

function normalizePhoneFromWhatsApp(from) {
  const cleaned = from.replace('whatsapp:', '').trim();
  return normalizePhoneForStorage(cleaned);
}

function normalizeIncomingBody(raw) {
  return String(raw ?? '')
    .replace(/\u200B|\uFEFF/g, '')
    .trim();
}

function ensureTwiMLBody(maybeText) {
  const s = typeof maybeText === 'string' ? maybeText.trim() : String(maybeText ?? '').trim();
  return s.length > 0
    ? s
    : 'Thanks for your message. Please try again in a moment or say hi.';
}
