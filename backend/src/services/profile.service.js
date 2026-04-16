import { prisma } from '../prisma.js';
import { normalizePhoneForStorage } from './twilio.service.js';

/**
 * Resolve patient id + name by phone (for staff lookup before history).
 */
export async function lookupPatientByPhone(phoneRaw) {
  const phone = normalizePhoneForStorage(String(phoneRaw || '').trim());
  if (!phone) {
    const err = new Error('phone required');
    err.statusCode = 400;
    throw err;
  }
  const patient = await prisma.patient.findUnique({
    where: { phone },
    select: { id: true, name: true, phone: true },
  });
  if (!patient) {
    const err = new Error('No patient with this phone');
    err.statusCode = 404;
    throw err;
  }
  return { patientId: patient.id, name: patient.name, phone: patient.phone };
}

/**
 * Patient profile + visit history. Caller must prove phone ownership (same as queue status).
 * @param {string} patientId
 * @param {string} phoneRaw
 */
export async function getPatientHistory(patientId, phoneRaw) {
  const id = String(patientId || '').trim();
  if (!id) {
    const err = new Error('patient id required');
    err.statusCode = 400;
    throw err;
  }

  const phone = normalizePhoneForStorage(String(phoneRaw || '').trim());
  if (!phone) {
    const err = new Error('phone query required for verification');
    err.statusCode = 400;
    throw err;
  }

  const patient = await prisma.patient.findUnique({
    where: { id },
  });
  if (!patient) {
    const err = new Error('Patient not found');
    err.statusCode = 404;
    throw err;
  }

  if (normalizePhoneForStorage(patient.phone) !== phone) {
    const err = new Error('Phone does not match this patient');
    err.statusCode = 403;
    throw err;
  }

  const visits = await prisma.visit.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  });

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      symptoms: patient.symptoms,
      department: patient.department,
      language: patient.language,
      createdAt: patient.createdAt,
    },
    visits: visits.map((v) => ({
      id: v.id,
      status: v.status,
      createdAt: v.createdAt,
      startTime: v.startTime,
      endTime: v.endTime,
      waitTime: v.waitTime,
      paymentStatus: v.paymentStatus,
      amount: v.amount,
      symptoms: v.symptoms,
      doctor: v.doctor,
    })),
  };
}
