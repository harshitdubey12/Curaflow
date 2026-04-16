import { prisma } from '../prisma.js';
import { QueueStatus } from '@prisma/client';
import { sendWhatsAppMessage } from './twilio.service.js';
import { config } from '../config.js';
import { translateMessage, normalizeLanguage } from './translation.service.js';

/**
 * After a Queue row is marked COMPLETED, close the open REGISTERED visit and send follow-up WhatsApp.
 */
export async function processCompletedQueueVisit(patientId) {
  const visit = await prisma.visit.findFirst({
    where: { patientId, status: 'REGISTERED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!visit) return;

  const completedQueue = await prisma.queue.findFirst({
    where: { patientId, status: QueueStatus.COMPLETED },
    orderBy: { updatedAt: 'desc' },
  });
  const waitMins =
    completedQueue != null
      ? Math.max(
          0,
          Math.round((Date.now() - new Date(completedQueue.createdAt).getTime()) / 60000)
        )
      : null;

  await prisma.visit.update({
    where: { id: visit.id },
    data: { status: 'COMPLETED', waitTime: waitMins, endTime: new Date() },
  });

  if (visit.followUpSent) return;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return;

  const text = translateMessage('followUp', patient.language, {});
  const r = await sendWhatsAppMessage(patient.phone, text);
  if (r.sent === true) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { followUpSent: true },
    });
  } else {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { followUpLastAttemptAt: new Date() },
    });
  }
}

/**
 * Retries visits that are COMPLETED but follow-up WhatsApp never succeeded (Twilio quota, network, etc.).
 */
export async function retryPendingFollowUps() {
  const cooldownMs = config.followUpRetryCooldownMs;

  const pending = await prisma.visit.findMany({
    where: {
      followUpSent: false,
      status: 'COMPLETED',
    },
    include: { patient: true },
    take: 50,
    orderBy: [{ followUpLastAttemptAt: 'asc' }, { createdAt: 'asc' }],
  });

  for (const v of pending) {
    if (v.followUpLastAttemptAt) {
      const age = Date.now() - new Date(v.followUpLastAttemptAt).getTime();
      if (age < cooldownMs) continue;
    }

    await prisma.visit.update({
      where: { id: v.id },
      data: { followUpLastAttemptAt: new Date() },
    });

    const text = translateMessage('followUp', normalizeLanguage(v.patient.language), {});
    const r = await sendWhatsAppMessage(v.patient.phone, text);
    if (r.sent === true) {
      await prisma.visit.update({
        where: { id: v.id },
        data: { followUpSent: true },
      });
    }
  }
}
