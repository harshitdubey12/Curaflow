import { getQueueSnapshot } from './queue.service.js';

/**
 * TV display board: current token and next N waiting entries.
 * Uses the same department filter as GET /queue/snapshot so the TV matches the doctor desk
 * (e.g. department=dental shows only that lane’s “next” order; omit or all = whole clinic queue).
 * @param {string | undefined} doctorIdInput
 * @param {{ nextCount?: number, department?: string }} [opts]
 */
export async function getDisplayBoard(doctorIdInput, opts = {}) {
  const nextCount = Math.min(10, Math.max(3, Number(opts.nextCount) || 5));
  const dept =
    opts.department != null && String(opts.department).trim() !== ''
      ? String(opts.department).trim().toLowerCase()
      : 'all';
  const snap = await getQueueSnapshot(doctorIdInput, { department: dept });
  const rows = (snap.waiting || []).slice(0, nextCount);
  const nextQueue = rows.map((w) => ({
    token: w.token,
    department: w.department ?? 'general',
  }));
  const waitingTokens = nextQueue.map((x) => x.token);
  return {
    doctorId: snap.doctorId,
    doctorName: snap.doctorName,
    currentToken: snap.currentToken,
    currentPatientName: snap.currentPatient?.name ?? null,
    /** Department lane for the patient currently in consultation (from queue row). */
    currentDepartment: snap.currentPatient?.department ?? null,
    /** Same filter as the doctor dashboard: all | general | dental | skin */
    departmentFilter: snap.departmentFilter ?? 'all',
    nextTokens: waitingTokens,
    nextQueue,
    waitingCount: snap.waitingCount,
    updatedAt: new Date().toISOString(),
  };
}
