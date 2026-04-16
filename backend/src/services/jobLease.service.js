import { prisma } from '../prisma.js';
import { config } from '../config.js';

const LEASE_ID = 'clinic-jobs';

/**
 * When several Node processes share one database, only one should run interval jobs.
 * Opt in with CLINIC_JOBS_USE_DB_LEASE=true. Uses a DB row as a lease (works with Postgres or SQLite).
 */
export async function tryAcquireClinicJobsLease(holder) {
  if (!config.clinicJobsUseDbLease) {
    return true;
  }

  const ttlMs = config.clinicJobLeaseTtlMs;
  const now = new Date();
  const until = new Date(Date.now() + ttlMs);

  return prisma.$transaction(async (tx) => {
    const row = await tx.jobLease.findUnique({ where: { id: LEASE_ID } });
    if (!row) {
      await tx.jobLease.create({
        data: { id: LEASE_ID, leaseUntil: until, leaseHolder: holder },
      });
      return true;
    }

    const expired = new Date(row.leaseUntil).getTime() <= now.getTime();
    const sameHolder = row.leaseHolder === holder;

    if (expired || sameHolder) {
      await tx.jobLease.update({
        where: { id: LEASE_ID },
        data: { leaseUntil: until, leaseHolder: holder },
      });
      return true;
    }

    return false;
  });
}
