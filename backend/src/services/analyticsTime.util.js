/**
 * Clinic-local calendar date (YYYY-MM-DD) and hour (0–23) using IANA time zone.
 * Default aligns with CLINIC_TIMEZONE (see config).
 */

/**
 * @param {Date} date
 * @param {string} timeZone IANA, e.g. Asia/Kolkata
 * @returns {string} YYYY-MM-DD
 */
export function calendarDateInTimezone(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Hour 0–23 in the given time zone (h23).
 * @param {Date} date
 * @param {string} timeZone
 */
export function hourInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour');
  return h ? parseInt(h.value, 10) : 0;
}
