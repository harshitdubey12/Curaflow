import { prisma } from '../prisma.js';
import { QueueStatus } from '@prisma/client';
import { config } from '../config.js';
import { getOrderedWaitingEntriesForDoctor } from './queueOrder.util.js';
import { sendWhatsAppMessage } from './twilio.service.js';
import { translateMessage, normalizeLanguage } from './translation.service.js';

/**
 * Clears per-row "doctor is delayed" ping markers when the desk moves to the next consultation,
 * so waiting patients can receive at most one delay ping per doctor session (see maybeBroadcastDoctorDelay).
 */
export async function clearDoctorDelayPingFlagsForDoctor(doctorId) {
  await prisma.queue.updateMany({
    where: { doctorId, status: QueueStatus.WAITING },
    data: { doctorDelayPingAt: null },
  });
}

/**
 * Smart notification engine: after skipping the next-up patient (first in desk order), the next
 * N waiting patients get one "coming soon" ping. Uses Queue.notified / lastNotifiedAt. Failed
 * sends still set lastNotifiedAt; retries wait notificationFailedRetryCooldownMs so Twilio
 * quota errors do not hammer every minute.
 */
export async function checkQueueEvery1Minute() {
  const doctors = await prisma.doctor.findMany({ select: { id: true } });
  for (const d of doctors) {
    await notifyUpcomingAfterQueueChange(d.id);
  }
}

/** Called from queue.service after advance/skip and on the 1-minute timer. */
export async function notifyUpcomingAfterQueueChange(doctorId) {
  await runPositionNotificationsForDoctor(doctorId);
  await maybeBroadcastDoctorDelay(doctorId);
}

/** One queue lane per department so "next up" and "coming soon" match doctor UI filters. */
async function runPositionNotificationsForDoctor(doctorId) {
  const lanes = await prisma.queue.groupBy({
    by: ['department'],
    where: { doctorId, status: QueueStatus.WAITING },
  });
  for (const row of lanes) {
    const dept = row.department && String(row.department).trim() !== ''
      ? String(row.department).trim().toLowerCase()
      : 'general';
    await runPositionNotificationsForDoctorLane(doctorId, dept);
  }
}

async function runPositionNotificationsForDoctorLane(doctorId, department) {
  const ordered = await getOrderedWaitingEntriesForDoctor(doctorId, department);
  // Next in line (waiting position 1 in this lane) is about to be called; only positions 2+ get "coming soon".
  const candidates = ordered.slice(1);
  const max = config.upcomingNotifyPositions;
  const retryCooldownMs = config.notificationFailedRetryCooldownMs;

  for (let i = 0; i < candidates.length && i < max; i++) {
    const q = candidates[i];
    if (q.notified) continue;

    if (q.lastNotifiedAt) {
      const age = Date.now() - new Date(q.lastNotifiedAt).getTime();
      if (age < retryCooldownMs) continue;
    }

    const lang = normalizeLanguage(q.patient.language);
    const r = await sendWhatsAppMessage(
      q.patient.phone,
      translateMessage('comingSoon', lang, {})
    );

    await prisma.queue.update({
      where: { id: q.id },
      data: {
        lastNotifiedAt: new Date(),
        notified: r.sent === true,
      },
    });
  }
}

/**
 * If the current consultation runs longer than the configured average, notify the first N waiting
 * that the doctor is delayed. Cooldown is stored on Doctor.lastDelayBroadcastAt (multi-instance safe).
 */
async function maybeBroadcastDoctorDelay(doctorId) {
  const current = await prisma.queue.findFirst({
    where: { doctorId, status: QueueStatus.IN_PROGRESS },
    select: {
      id: true,
      summonedAt: true,
      department: true,
    },
  });
  if (!current) return;

  if (!current.summonedAt) {
    await prisma.queue.update({
      where: { id: current.id },
      data: { summonedAt: new Date() },
    });
    return;
  }

  const lane =
    current.department && String(current.department).trim() !== ''
      ? String(current.department).trim().toLowerCase()
      : 'general';

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { lastDelayBroadcastAt: true },
  });
  const cooldownMs = config.doctorDelayNotifyCooldownMs;
  if (doctor?.lastDelayBroadcastAt) {
    const age = Date.now() - new Date(doctor.lastDelayBroadcastAt).getTime();
    if (age < cooldownMs) return;
  }

  const elapsedMin = Math.floor(
    (Date.now() - new Date(current.summonedAt).getTime()) / 60000
  );
  const delayMin = Math.max(0, elapsedMin - config.avgConsultationMinutes);
  if (delayMin < 1) return;

  const ordered = await getOrderedWaitingEntriesForDoctor(doctorId, lane);
  const firstN = ordered.slice(0, config.upcomingNotifyPositions);
  if (firstN.length === 0) return;

  let anySent = false;
  for (const q of firstN) {
    if (q.doctorDelayPingAt != null) continue;

    const lang = normalizeLanguage(q.patient.language);
    const r = await sendWhatsAppMessage(
      q.patient.phone,
      translateMessage('doctorDelayed', lang, { minutes: delayMin })
    );
    if (r.sent === true) {
      anySent = true;
      await prisma.queue.update({
        where: { id: q.id },
        data: { doctorDelayPingAt: new Date() },
      });
    }
  }

  if (anySent) {
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { lastDelayBroadcastAt: new Date() },
    });
  }
}
