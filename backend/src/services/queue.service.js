import { prisma } from '../prisma.js';
import { QueueStatus } from '@prisma/client';
import { config } from '../config.js';
import * as doctorService from './doctor.service.js';
import { sendWhatsAppMessage, normalizePhoneForStorage } from './twilio.service.js';
import { getOrderedWaitingEntriesForDoctor } from './queueOrder.util.js';
import {
  notifyUpcomingAfterQueueChange,
  clearDoctorDelayPingFlagsForDoctor,
} from './notification.service.js';
import { translateMessage, normalizeLanguage } from './translation.service.js';
import { calculateSmartWaitMinutes } from './waitTime.service.js';
import { classifyDepartment, normalizeDepartment } from './department.service.js';
import { isLikelyMedicalEmergency } from '../utils/whatsappUrgency.util.js';
const QUEUE_TYPE_WALKIN = 'walkin';
const QUEUE_TYPE_APPOINTMENT = 'appointment';

/**
 * Next global token number (monotonic; unique across all doctors).
 */
async function nextTokenNumber() {
  const agg = await prisma.queue.aggregate({ _max: { tokenNumber: true } });
  return (agg._max.tokenNumber ?? 0) + 1;
}

function clampPriority(v) {
  const n = Number.parseInt(String(v ?? '0'), 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(3, Math.max(0, n));
}

function normalizeQueueType(v) {
  const s = String(v ?? QUEUE_TYPE_WALKIN).toLowerCase();
  if (s === 'appointment') return QUEUE_TYPE_APPOINTMENT;
  return QUEUE_TYPE_WALKIN;
}

/**
 * Web/API registration must match WhatsApp: one active row per patient (WAITING or IN_PROGRESS).
 */
async function ensureNoActiveQueueForPatient(patientId) {
  const active = await prisma.queue.findFirst({
    where: {
      patientId,
      status: { in: [QueueStatus.WAITING, QueueStatus.IN_PROGRESS] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!active) return;
  const err = new Error(
    'This phone already has an active queue entry. Cancel or finish the current visit before joining again.'
  );
  err.statusCode = 409;
  err.existing = {
    queueEntryId: active.id,
    tokenNumber: active.tokenNumber,
    status: active.status,
    doctorId: active.doctorId,
  };
  throw err;
}

/** When a token is called, stamp consultation start on the open REGISTERED visit. */
async function markVisitConsultationStarted(patientId) {
  await prisma.visit.updateMany({
    where: { patientId, status: 'REGISTERED' },
    data: { startTime: new Date() },
  });
}

/**
 * WAITING rows for this doctor, ordered for serving:
 * priority DESC, then effective appointment slot (appointmentTime when set, else createdAt), then createdAt ASC.
 * Same rules as queueOrder.util.js.
 */
export async function getOrderedWaiting(doctorId, departmentFilter) {
  return getOrderedWaitingEntriesForDoctor(doctorId, departmentFilter);
}

function mapWaitingRow(q) {
  return {
    queueEntryId: q.id,
    token: q.tokenNumber,
    name: q.patient.name,
    phone: q.patient.phone,
    priority: q.priority,
    type: q.type,
    department: q.department ?? 'general',
    appointmentTime: q.appointmentTime ? q.appointmentTime.toISOString() : null,
  };
}

/** Fields from a Queue row for POST /patient/register and POST /queue/add JSON bodies. */
export function queueEntryToResponse(queueEntry) {
  return {
    queueEntryId: queueEntry.id,
    tokenNumber: queueEntry.tokenNumber,
    /** Tokens are unique across the whole clinic, not per doctor room. */
    tokenNumberScope: 'clinic_wide',
    status: queueEntry.status,
    priority: queueEntry.priority,
    type: queueEntry.type,
    department: queueEntry.department ?? 'general',
    appointmentTime: queueEntry.appointmentTime ? queueEntry.appointmentTime.toISOString() : null,
    doctorId: queueEntry.doctorId,
  };
}

/**
 * Snapshot for one doctor: who is in progress, ordered waiting list, counts.
 * @param {string} [doctorIdInput] optional; defaults to configured default doctor
 * @param {{ department?: string }} [filters] optional department=all|general|dental|skin filters waiting rows only
 */
export async function getQueueSnapshot(doctorIdInput, filters = {}) {
  const doctorId = await doctorService.resolveDoctorId(doctorIdInput);
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });

  const inProgress = await prisma.queue.findFirst({
    where: { doctorId, status: QueueStatus.IN_PROGRESS },
    orderBy: { createdAt: 'asc' },
    include: { patient: true },
  });

  const rawDept = filters.department != null ? String(filters.department).trim().toLowerCase() : 'all';
  const deptFilter = rawDept !== 'all' && rawDept !== '' ? normalizeDepartment(rawDept) : null;
  const waiting = await getOrderedWaiting(doctorId, deptFilter ?? 'all');

  const currentToken = inProgress?.tokenNumber ?? null;

  let currentVisitPayment = null;
  if (inProgress) {
    const openVisit = await prisma.visit.findFirst({
      where: { patientId: inProgress.patientId, status: 'REGISTERED' },
      select: { id: true, paymentStatus: true, amount: true },
    });
    if (openVisit) {
      currentVisitPayment = {
        visitId: openVisit.id,
        paymentStatus: openVisit.paymentStatus,
        amount: openVisit.amount,
      };
    }
  }

  return {
    doctorId,
    doctorName: doctor?.name ?? null,
    currentToken,
    currentPatient: inProgress
      ? {
          name: inProgress.patient.name,
          phone: inProgress.patient.phone,
          token: inProgress.tokenNumber,
          department: inProgress.department ?? 'general',
          patientId: inProgress.patientId,
          ...currentVisitPayment,
        }
      : null,
    waiting: waiting.map(mapWaitingRow),
    waitingCount: waiting.length,
    departmentFilter: deptFilter ?? 'all',
  };
}

/**
 * Position in queue for a phone (1-based among WAITING for that doctor, using same ordering as the desk).
 */
export async function getPositionByPhone(phone) {
  const normalized = normalizePhoneForStorage(String(phone).trim());
  let patient = await prisma.patient.findUnique({ where: { phone: normalized } });
  if (!patient) {
    patient = await prisma.patient.findFirst({ where: { phone: String(phone).trim() } });
  }
  if (!patient) return null;

  const entry = await prisma.queue.findFirst({
    where: {
      patientId: patient.id,
      status: QueueStatus.WAITING,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!entry) {
    const inProg = await prisma.queue.findFirst({
      where: { patientId: patient.id, status: QueueStatus.IN_PROGRESS },
    });
    if (inProg) {
      return {
        patient,
        queueEntry: inProg,
        position: 0,
        ahead: 0,
        estimatedWaitMinutes: 0,
      };
    }
    return null;
  }

  const laneDept = entry.department ?? 'general';
  const ordered = await getOrderedWaiting(entry.doctorId, laneDept);
  const idx = ordered.findIndex((q) => q.id === entry.id);
  const ahead = idx >= 0 ? idx : 0;
  const estimatedWaitMinutes = await calculateSmartWaitMinutes(ahead, entry.doctorId);

  return {
    patient,
    queueEntry: entry,
    position: ahead + 1,
    ahead,
    estimatedWaitMinutes,
  };
}

/**
 * Patient cancels their own WAITING slot (not IN_PROGRESS).
 */
export async function cancelQueueByPhone(io, { phone, doctorId: doctorIdIn }) {
  const normalized = normalizePhoneForStorage(String(phone || '').trim());
  if (!normalized) {
    const err = new Error('phone is required');
    err.statusCode = 400;
    throw err;
  }

  const patient = await prisma.patient.findUnique({ where: { phone: normalized } });
  if (!patient) {
    const err = new Error('No patient for this phone');
    err.statusCode = 404;
    throw err;
  }

  const entry = await prisma.queue.findFirst({
    where: { patientId: patient.id, status: QueueStatus.WAITING },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    const err = new Error('No active waiting entry to cancel');
    err.statusCode = 400;
    throw err;
  }

  if (doctorIdIn != null && String(doctorIdIn).trim() !== '') {
    const want = await doctorService.resolveDoctorId(doctorIdIn);
    if (entry.doctorId !== want) {
      const err = new Error('Queue entry is for a different doctor');
      err.statusCode = 403;
      throw err;
    }
  }

  await prisma.queue.update({
    where: { id: entry.id },
    data: { status: QueueStatus.CANCELLED },
  });

  await prisma.visit.updateMany({
    where: { patientId: patient.id, status: 'REGISTERED', doctorId: entry.doctorId },
    data: { status: 'CANCELLED' },
  });

  await broadcastQueue(io);
  return {
    ok: true,
    tokenNumber: entry.tokenNumber,
    queueEntryId: entry.id,
    patientId: patient.id,
    status: 'CANCELLED',
    /** Lowercase alias for API clients that expect a string "cancelled". */
    statusText: 'cancelled',
    message: 'Your slot was cancelled.',
  };
}

/**
 * Patient reschedules appointment time on their WAITING row (walk-in becomes appointment if needed).
 */
export async function rescheduleQueueByPhone(io, { phone, appointmentTime, doctorId: doctorIdIn }) {
  const normalized = normalizePhoneForStorage(String(phone || '').trim());
  if (!normalized) {
    const err = new Error('phone is required');
    err.statusCode = 400;
    throw err;
  }

  const d = appointmentTime != null ? new Date(appointmentTime) : null;
  if (!d || Number.isNaN(d.getTime())) {
    const err = new Error('Valid appointmentTime (ISO) is required');
    err.statusCode = 400;
    throw err;
  }

  const patient = await prisma.patient.findUnique({ where: { phone: normalized } });
  if (!patient) {
    const err = new Error('No patient for this phone');
    err.statusCode = 404;
    throw err;
  }

  const entry = await prisma.queue.findFirst({
    where: { patientId: patient.id, status: QueueStatus.WAITING },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    const err = new Error('No active waiting entry to reschedule');
    err.statusCode = 400;
    throw err;
  }

  if (doctorIdIn != null && String(doctorIdIn).trim() !== '') {
    const want = await doctorService.resolveDoctorId(doctorIdIn);
    if (entry.doctorId !== want) {
      const err = new Error('Queue entry is for a different doctor');
      err.statusCode = 403;
      throw err;
    }
  }

  await prisma.queue.update({
    where: { id: entry.id },
    data: {
      appointmentTime: d,
      type: QUEUE_TYPE_APPOINTMENT,
    },
  });

  await broadcastQueue(io);
  return { ok: true, appointmentTime: d.toISOString(), tokenNumber: entry.tokenNumber };
}

/**
 * Register or upsert patient and append to a doctor queue with priority and visit type.
 */
export async function registerPatient({
  name,
  phone,
  symptoms,
  doctorId: doctorIdIn,
  priority: priorityIn,
  type: typeIn,
  appointmentTime: appointmentTimeIn,
  language: languageIn,
  department: departmentOverrideIn,
}) {
  const doctorId = await doctorService.resolveDoctorId(doctorIdIn);
  const lang = normalizeLanguage(languageIn);
  const priority = clampPriority(priorityIn);
  const type = normalizeQueueType(typeIn);
  let appointmentTime = null;
  if (type === QUEUE_TYPE_APPOINTMENT && appointmentTimeIn != null && String(appointmentTimeIn).trim() !== '') {
    const d = new Date(appointmentTimeIn);
    if (Number.isNaN(d.getTime())) {
      const err = new Error('Invalid appointment time');
      err.statusCode = 400;
      throw err;
    }
    appointmentTime = d;
  }

  const symptomText = symptoms != null ? String(symptoms).trim() : '';
  const symptomsUrgentCare =
    symptomText.length >= 3 && isLikelyMedicalEmergency(symptomText);

  let department = 'general';
  let needsDepartmentClarification = false;
  const overrideRaw = departmentOverrideIn != null ? String(departmentOverrideIn).trim() : '';
  if (overrideRaw !== '') {
    department = normalizeDepartment(overrideRaw);
  } else {
    const classified = await classifyDepartment(symptoms);
    department = classified.department;
    needsDepartmentClarification = classified.needsClarification === true;
  }

  const tokenNumber = await nextTokenNumber();

  const patient = await prisma.patient.upsert({
    where: { phone },
    update: { name, symptoms: symptoms ?? undefined, language: lang, department },
    create: { name, phone, symptoms: symptoms ?? null, language: lang, department },
  });

  await ensureNoActiveQueueForPatient(patient.id);

  const queueEntry = await prisma.queue.create({
    data: {
      tokenNumber,
      status: QueueStatus.WAITING,
      patientId: patient.id,
      doctorId,
      priority,
      type,
      appointmentTime,
      department,
    },
    include: { patient: true },
  });

  const visitSymptoms =
    symptomText.length > 0 ? symptomText : patient.symptoms != null ? String(patient.symptoms) : null;

  await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId,
      status: 'REGISTERED',
      symptoms: visitSymptoms,
    },
  });

  const ordered = await getOrderedWaiting(doctorId, department);
  const idx = ordered.findIndex((q) => q.id === queueEntry.id);
  const ahead = idx >= 0 ? idx : 0;
  const estimatedWaitMinutes = await calculateSmartWaitMinutes(ahead, doctorId);

  return {
    patient,
    queueEntry,
    ahead,
    estimatedWaitMinutes,
    department,
    needsDepartmentClarification,
    symptomsUrgentCare,
  };
}

/** Alias for POST /queue/add (same behavior as patient register). */
export async function addToQueue(body) {
  return registerPatient(body);
}

/**
 * Doctor dashboard: update priority for a WAITING row (same doctor only). Does not move patients between doctors.
 */
export async function updateWaitingPriority(io, { queueEntryId, doctorId: doctorIdIn, priority: priorityIn }) {
  const doctorId = await doctorService.resolveDoctorId(doctorIdIn);
  const priority = clampPriority(priorityIn);
  const id = String(queueEntryId || '').trim();
  if (!id) {
    const err = new Error('queueEntryId is required');
    err.statusCode = 400;
    throw err;
  }
  const entry = await prisma.queue.findFirst({
    where: { id, doctorId, status: QueueStatus.WAITING },
  });
  if (!entry) {
    const err = new Error('Queue entry not found or not waiting for this doctor');
    err.statusCode = 400;
    throw err;
  }
  await prisma.queue.update({
    where: { id: entry.id },
    data: { priority },
  });
  await broadcastQueue(io);
  return { ok: true, queueEntryId: entry.id, priority };
}

/**
 * WhatsApp: one active queue row per phone. Uses default doctor and walk-in priority.
 */
export async function enqueueOrGetExistingForWhatsApp({ name, phone, symptoms }) {
  const phoneNorm = normalizePhoneForStorage(String(phone).trim());

  const existingPatient = await prisma.patient.findUnique({ where: { phone: phoneNorm } });
  if (existingPatient) {
    const waitingEntry = await prisma.queue.findFirst({
      where: { patientId: existingPatient.id, status: QueueStatus.WAITING },
      orderBy: { createdAt: 'desc' },
      include: { patient: true },
    });
    if (waitingEntry) {
      const lane = waitingEntry.department ?? 'general';
      const ordered = await getOrderedWaiting(waitingEntry.doctorId, lane);
      const idx = ordered.findIndex((q) => q.id === waitingEntry.id);
      const ahead = idx >= 0 ? idx : 0;
      const estimatedWaitMinutes = await calculateSmartWaitMinutes(ahead, waitingEntry.doctorId);
      return {
        patient: waitingEntry.patient,
        queueEntry: waitingEntry,
        ahead,
        estimatedWaitMinutes,
        kind: 'still_waiting',
      };
    }

    const inProg = await prisma.queue.findFirst({
      where: { patientId: existingPatient.id, status: QueueStatus.IN_PROGRESS },
      include: { patient: true },
    });
    if (inProg) {
      return {
        patient: inProg.patient,
        queueEntry: inProg,
        ahead: 0,
        estimatedWaitMinutes: 0,
        kind: 'now_serving',
      };
    }
  }

  const symptomText =
    symptoms != null && String(symptoms).trim() !== ''
      ? String(symptoms).trim()
      : undefined;

  const created = await registerPatient({
    name,
    phone: phoneNorm,
    symptoms: symptomText,
    doctorId: undefined,
    priority: 0,
    type: QUEUE_TYPE_WALKIN,
    appointmentTime: undefined,
    department: undefined,
  });
  return {
    ...created,
    kind: 'new',
  };
}

/** Notifies patients behind the next-up slot (see UPCOMING_NOTIFY_POSITIONS) after desk advances. */
async function notifyUpcomingWaitingSlots(doctorId) {
  await notifyUpcomingAfterQueueChange(doctorId);
}

function departmentLaneFromOptions(options) {
  const raw = options?.department;
  if (raw == null || String(raw).trim() === '') return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === 'all') return undefined;
  return normalizeDepartment(raw);
}

/**
 * Complete current IN_PROGRESS for this doctor, then promote the first WAITING in priority order.
 * @param {object} [options]
 * @param {string} [options.department] When set (not "all"), only this department lane is considered for the next patient.
 */
export async function advanceQueue(io, doctorIdInput, options = {}) {
  const doctorId = await doctorService.resolveDoctorId(doctorIdInput);
  const lane = departmentLaneFromOptions(options);

  const current = await prisma.queue.findFirst({
    where: { doctorId, status: QueueStatus.IN_PROGRESS },
    include: { patient: true },
  });

  if (current) {
    await prisma.queue.update({
      where: { id: current.id },
      data: { status: QueueStatus.COMPLETED },
    });
    // Follow-up WhatsApp runs via Prisma middleware on Queue status COMPLETED (see prisma.js).
    await clearDoctorDelayPingFlagsForDoctor(doctorId);
  }

  const ordered = await getOrderedWaiting(doctorId, lane);
  const next = ordered[0];

  if (!next) {
    await broadcastQueue(io);
    return { ok: true, current: null, message: 'Queue empty', doctorId };
  }

  const promoted = await prisma.queue.update({
    where: { id: next.id },
    data: {
      status: QueueStatus.IN_PROGRESS,
      summonedAt: new Date(),
      lastResponseAt: null,
    },
    include: { patient: true },
  });

  await markVisitConsultationStarted(promoted.patientId);

  const phone = promoted.patient.phone;
  const lang = normalizeLanguage(promoted.patient.language);
  await sendWhatsAppMessage(
    phone,
    translateMessage('tokenCalled', lang, { token: promoted.tokenNumber })
  );

  await notifyUpcomingWaitingSlots(doctorId);
  await broadcastQueue(io);
  return { ok: true, current: promoted, doctorId };
}

/**
 * @param {object} [options]
 * @param {string} [options.department] When set (not "all"), only this department lane for the next promotion.
 * @param {(phone: string, body: string) => Promise<unknown>} [options.sendTurnMessage] defaults to sendWhatsAppMessage (pass from no-show service for explicit wiring).
 */
export async function skipCurrent(io, doctorIdInput, options = {}) {
  const sendTurn = options.sendTurnMessage ?? sendWhatsAppMessage;
  const doctorId = await doctorService.resolveDoctorId(doctorIdInput);
  const lane = departmentLaneFromOptions(options);

  const current = await prisma.queue.findFirst({
    where: { doctorId, status: QueueStatus.IN_PROGRESS },
    include: { patient: true },
  });

  if (!current) {
    await broadcastQueue(io);
    return { ok: false, message: 'No active patient', doctorId };
  }

  await prisma.queue.update({
    where: { id: current.id },
    data: { status: QueueStatus.SKIPPED },
  });

  await prisma.visit.updateMany({
    where: {
      patientId: current.patientId,
      doctorId: current.doctorId,
      status: 'REGISTERED',
    },
    data: {
      status: 'SKIPPED',
      endTime: new Date(),
    },
  });

  await clearDoctorDelayPingFlagsForDoctor(doctorId);

  const ordered = await getOrderedWaiting(doctorId, lane);
  const next = ordered[0];

  let promoted = null;
  if (next) {
    promoted = await prisma.queue.update({
      where: { id: next.id },
      data: {
        status: QueueStatus.IN_PROGRESS,
        summonedAt: new Date(),
        lastResponseAt: null,
      },
      include: { patient: true },
    });
    await markVisitConsultationStarted(promoted.patientId);
    const lang = normalizeLanguage(promoted.patient.language);
    await sendTurn(
      promoted.patient.phone,
      translateMessage('tokenCalled', lang, { token: promoted.tokenNumber })
    );
  }

  await notifyUpcomingWaitingSlots(doctorId);
  await broadcastQueue(io);
  return { ok: true, skippedToken: current.tokenNumber, next: promoted, doctorId };
}

async function buildSnapshotsPayload() {
  await doctorService.ensureDefaultDoctor();
  const doctors = await prisma.doctor.findMany({ select: { id: true } });
  const snapshots = {};
  for (const d of doctors) {
    snapshots[d.id] = await getQueueSnapshot(d.id);
  }
  return snapshots;
}

/**
 * Broadcasts default doctor snapshot at top level for older clients, plus all per-doctor snapshots.
 */
export async function broadcastQueue(io) {
  const snapshots = await buildSnapshotsPayload();
  const def = snapshots[config.defaultDoctorId] ?? {
    doctorId: config.defaultDoctorId,
    doctorName: null,
    currentToken: null,
    waitingCount: 0,
    waiting: [],
    currentPatient: null,
  };
  if (!io) return;
  io.emit('queue:update', {
    ...def,
    snapshots,
    activeDoctorId: config.defaultDoctorId,
  });
}
