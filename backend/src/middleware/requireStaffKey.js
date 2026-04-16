import { config } from '../config.js';

/**
 * When CLINIC_STAFF_API_KEY is set, requires matching X-Clinic-Key header.
 * When unset (local dev), allows the request (same pattern as patient lookup).
 */
export function requireStaffKey(req, res, next) {
  const required = config.clinicStaffApiKey;
  if (required === '') {
    return next();
  }
  const sent = String(req.headers['x-clinic-key'] ?? '').trim();
  if (sent !== required) {
    return res.status(401).json({
      error:
        'Staff key required. Set CLINIC_STAFF_API_KEY on the API and NEXT_PUBLIC_CLINIC_STAFF_KEY on the frontend to the same value.',
    });
  }
  return next();
}
