import { prisma } from '../prisma.js';

/**
 * Staff marks consultation payment on the open REGISTERED visit for the active patient.
 * @param {{ visitId: string, doctorId?: string, paymentStatus: 'pending'|'paid', amount?: number | null }}
 */
export async function updateVisitPayment({ visitId, doctorId, paymentStatus, amount }) {
  const id = String(visitId || '').trim();
  if (!id) {
    const err = new Error('visitId is required');
    err.statusCode = 400;
    throw err;
  }

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!visit) {
    const err = new Error('Visit not found');
    err.statusCode = 404;
    throw err;
  }

  if (doctorId && visit.doctorId && visit.doctorId !== doctorId) {
    const err = new Error('Visit does not belong to this doctor');
    err.statusCode = 403;
    throw err;
  }

  const ps = paymentStatus === 'paid' ? 'paid' : 'pending';
  const amt = amount != null && amount !== '' ? Number(amount) : undefined;

  return prisma.visit.update({
    where: { id },
    data: {
      paymentStatus: ps,
      ...(amt != null && Number.isFinite(amt) ? { amount: amt } : {}),
    },
  });
}
