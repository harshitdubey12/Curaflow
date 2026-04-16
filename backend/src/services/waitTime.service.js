import { prisma } from '../prisma.js';
import { config } from '../config.js';

/**
 * Average consultation length from the last 5 completed visits with start and end timestamps.
 * Prefers `doctorId` when provided; falls back to all doctors if not enough rows.
 * @param {string | null | undefined} doctorId
 * @returns {Promise<number | null>} minutes or null if no usable data
 */
export async function getAverageConsultationMinutesLast5(doctorId) {
  async function meanFromVisits(whereExtra) {
    const visits = await prisma.visit.findMany({
      where: {
        status: 'COMPLETED',
        startTime: { not: null },
        endTime: { not: null },
        ...whereExtra,
      },
      orderBy: { endTime: 'desc' },
      take: 5,
      select: { startTime: true, endTime: true },
    });

    const durations = [];
    for (const v of visits) {
      if (!v.startTime || !v.endTime) continue;
      const mins =
        (new Date(v.endTime).getTime() - new Date(v.startTime).getTime()) / 60000;
      if (Number.isFinite(mins) && mins > 0 && mins < 24 * 60) {
        durations.push(mins);
      }
    }

    if (!durations.length) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  if (doctorId) {
    const forDoctor = await meanFromVisits({ doctorId });
    if (forDoctor != null) return forDoctor;
  }

  return meanFromVisits({});
}

/**
 * Smart wait estimate: avg consultation from recent visits × people ahead, fallback to config.
 * @param {number} peopleAhead
 * @param {string | null | undefined} doctorId
 */
export async function calculateSmartWaitMinutes(peopleAhead, doctorId) {
  const ahead = Math.max(0, Math.floor(Number(peopleAhead) || 0));
  let avg = await getAverageConsultationMinutesLast5(doctorId || null);
  if (avg == null) {
    avg = config.avgConsultationMinutes;
  }
  return Math.max(0, Math.round(ahead * avg));
}

/** Alias for QA / external docs (same as calculateSmartWaitMinutes). */
export const calculateSmartWaitTime = calculateSmartWaitMinutes;
