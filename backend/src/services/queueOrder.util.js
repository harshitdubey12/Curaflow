import { prisma } from '../prisma.js';
import { QueueStatus } from '@prisma/client';

/**
 * Same ordering as queue.service getOrderedWaiting:
 * priority DESC, then effective slot time ASC (appointmentTime when set, else createdAt), then createdAt ASC.
 * Extracted so notification / no-show services avoid circular imports with queue.service.
 */
function effectiveSlotTimeMs(q) {
  if (q.appointmentTime != null) {
    return new Date(q.appointmentTime).getTime();
  }
  return new Date(q.createdAt).getTime();
}

function compareQueueOrder(a, b) {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const ta = effectiveSlotTimeMs(a);
  const tb = effectiveSlotTimeMs(b);
  if (ta !== tb) return ta - tb;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/**
 * @param {string} doctorId
 * @param {string | undefined} departmentFilter When set (not "all"), only that department lane.
 */
export async function getOrderedWaitingEntriesForDoctor(doctorId, departmentFilter) {
  const where = { doctorId, status: QueueStatus.WAITING };
  const d = departmentFilter != null ? String(departmentFilter).trim().toLowerCase() : '';
  if (d && d !== 'all') {
    where.department = d;
  }
  const rows = await prisma.queue.findMany({
    where,
    include: { patient: true },
  });
  return [...rows].sort(compareQueueOrder);
}
