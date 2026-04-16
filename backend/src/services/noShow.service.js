import { prisma } from '../prisma.js';
import { QueueStatus } from '@prisma/client';
import { config } from '../config.js';
import * as queueService from './queue.service.js';
import { sendWhatsAppMessage } from './twilio.service.js';

/**
 * IN_PROGRESS patients who never replied on WhatsApp after being summoned are auto-skipped.
 * lastResponseAt is cleared when promoted; inbound webhook sets it when they write back.
 * Rows missing summonedAt (legacy) get one batch backfill to "now" so they get a full timeout window
 * and downstream doctor-delay timing uses a real summon time, not a stale updatedAt.
 * Turn-call SMS/WhatsApp uses the same sendWhatsAppMessage helper as advanceQueue (passed into skipCurrent).
 */
export async function checkNoShowsEvery1Minute(io) {
  const thresholdMs = config.noShowTimeoutMinutes * 60 * 1000;
  const now = Date.now();

  await prisma.queue.updateMany({
    where: { status: QueueStatus.IN_PROGRESS, summonedAt: null },
    data: { summonedAt: new Date() },
  });

  const inProgress = await prisma.queue.findMany({
    where: { status: QueueStatus.IN_PROGRESS },
    select: {
      id: true,
      doctorId: true,
      lastResponseAt: true,
      summonedAt: true,
      department: true,
    },
  });

  for (const row of inProgress) {
    if (row.lastResponseAt != null) continue;

    if (!row.summonedAt) continue;

    if (now - new Date(row.summonedAt).getTime() < thresholdMs) continue;

    const deptRaw =
      row.department != null && String(row.department).trim() !== ''
        ? String(row.department).trim().toLowerCase()
        : 'general';

    try {
      await queueService.skipCurrent(io, row.doctorId, {
        sendTurnMessage: sendWhatsAppMessage,
        department: deptRaw,
      });
    } catch (e) {
      console.error('[no-show] skip failed for queue', row.id, e?.message || e);
    }
  }
}
