/**
 * Doctor dashboard: same secret as backend CLINIC_STAFF_API_KEY via NEXT_PUBLIC_CLINIC_STAFF_KEY.
 * When unset, lookup stays open (dev only); set both env vars in production.
 */
export function getStaffHeaders() {
  const k =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CLINIC_STAFF_KEY != null
      ? String(process.env.NEXT_PUBLIC_CLINIC_STAFF_KEY).trim()
      : '';
  if (k === '') return {};
  return { 'X-Clinic-Key': k };
}
