import { prisma } from '../prisma.js';
import { QueueStatus } from '@prisma/client';
import { config } from '../config.js';
import { calendarDateInTimezone, hourInTimezone } from './analyticsTime.util.js';

const DAY_MS = 86400000;

/**
 * Infer minutes from queue join to completion when Visit.waitTime was never stored (legacy rows).
 */
async function inferWaitMinutesFromQueue(visit) {
  const q = await prisma.queue.findFirst({
    where: { patientId: visit.patientId, status: QueueStatus.COMPLETED },
    orderBy: { updatedAt: 'desc' },
  });
  if (!q) return null;
  return Math.max(
    0,
    Math.round((new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime()) / 60000)
  );
}

/**
 * Last `days` calendar days in clinic timezone: visit counts by local date (YYYY-MM-DD).
 * @param {number} [days=14]
 */
export async function getPatientsPerDay(days = 14) {
  const tz = config.clinicTimezone;
  const cutoff = new Date(Date.now() - (days + 2) * DAY_MS);
  const visits = await prisma.visit.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { createdAt: true },
  });

  const counts = new Map();
  for (const v of visits) {
    const d = calendarDateInTimezone(v.createdAt, tz);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(Date.now() - i * DAY_MS);
    keys.push(calendarDateInTimezone(t, tz));
  }
  const ordered = [...new Set(keys)];

  return ordered.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

/**
 * Average wait in minutes: uses Visit.waitTime when set; otherwise infers from latest completed Queue row.
 */
export async function getAverageWaitTime() {
  const visits = await prisma.visit.findMany({
    where: { status: 'COMPLETED' },
    select: { id: true, patientId: true, waitTime: true },
  });
  if (visits.length === 0) return 0;

  const minutes = [];
  for (const v of visits) {
    let w = v.waitTime;
    if (w == null) {
      w = await inferWaitMinutesFromQueue(v);
    }
    if (w != null) minutes.push(w);
  }
  if (minutes.length === 0) return 0;
  const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Hours 0–23 in clinic timezone with highest visit counts (top 3).
 */
export async function getPeakHours() {
  const tz = config.clinicTimezone;
  const visits = await prisma.visit.findMany({
    select: { createdAt: true },
  });
  const byHour = new Map();
  for (const v of visits) {
    const h = hourInTimezone(v.createdAt, tz);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const list = [...byHour.entries()].map(([hour, count]) => ({ hour, count }));
  list.sort((a, b) => b.count - a.count);
  return list.slice(0, 3);
}

/**
 * Top hours by consultation start (Visit.startTime) when set; excludes visits not yet called.
 */
export async function getPeakHoursByConsultationStart() {
  const tz = config.clinicTimezone;
  const visits = await prisma.visit.findMany({
    where: { startTime: { not: null } },
    select: { startTime: true },
  });
  if (visits.length === 0) return [];
  const byHour = new Map();
  for (const v of visits) {
    const h = hourInTimezone(v.startTime, tz);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const list = [...byHour.entries()].map(([hour, count]) => ({ hour, count }));
  list.sort((a, b) => b.count - a.count);
  return list.slice(0, 3);
}

export async function getAnalyticsSummary() {
  const tz = config.clinicTimezone;
  const [patientsPerDay, avgWaitTime, peakHours, peakHoursConsultation] = await Promise.all([
    getPatientsPerDay(14),
    getAverageWaitTime(),
    getPeakHours(),
    getPeakHoursByConsultationStart(),
  ]);
  return {
    patientsPerDay,
    avgWaitTime,
    peakHours,
    peakHoursConsultation,
    timezone: tz,
    /** Peak hours use Visit.createdAt (check-in / registration), not consultation startTime. */
    peakHoursBasis: 'visit_created_at',
    /** When Visit.startTime exists; empty until patients have been called in. */
    peakHoursConsultationBasis: 'visit_start_time',
  };
}
