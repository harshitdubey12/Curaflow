import os from 'node:os';
import { config } from '../config.js';
import { checkQueueEvery1Minute } from './notification.service.js';
import { checkNoShowsEvery1Minute } from './noShow.service.js';
import { retryPendingFollowUps } from './followUp.service.js';
import { tryAcquireClinicJobsLease } from './jobLease.service.js';

const workerId = `${process.env.CLINIC_JOBS_WORKER_ID || os.hostname()}-${process.pid}`;

/**
 * Background interval: no-show detection runs before notifications so legacy summonedAt backfill
 * and skips apply before "coming soon" / doctor-delay logic. Then follow-up retries.
 * Default 60s; does not replace real cron in multi-instance production (use one worker or external scheduler).
 * Set CLINIC_JOBS_USE_DB_LEASE=true when several Node processes share one database so only one runs this loop.
 */
export function startClinicJobs(getIo) {
  if (!config.clinicJobsEnabled) {
    console.log('[clinic-jobs] disabled (set CLINIC_JOBS_ENABLED=false)');
    return () => {};
  }

  const tick = async () => {
    try {
      const leased = await tryAcquireClinicJobsLease(workerId);
      if (!leased) {
        return;
      }
      await checkNoShowsEvery1Minute(getIo());
      await checkQueueEvery1Minute();
      await retryPendingFollowUps();
    } catch (e) {
      console.error('[clinic-jobs]', e);
    }
  };

  const ms = config.clinicJobsIntervalMs;
  const id = setInterval(tick, ms);
  void tick();

  console.log(
    `[clinic-jobs] worker=${workerId} every ${ms}ms (no-show then notifications + follow-up retry; NO_SHOW_TIMEOUT_MINUTES=${config.noShowTimeoutMinutes}; DB_LEASE=${config.clinicJobsUseDbLease})`
  );

  return () => clearInterval(id);
}
