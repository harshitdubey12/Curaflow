import { getStaffHeaders } from './staffHeaders';

/**
 * Socket.io client options. When NEXT_PUBLIC_CLINIC_STAFF_KEY is set and the API uses
 * SOCKET_IO_REQUIRE_STAFF=true, the handshake sends auth.clinicKey so the connection is allowed.
 */
export function getSocketClientOptions() {
  const h = getStaffHeaders();
  const clinicKey = h['X-Clinic-Key'];
  return {
    transports: ['websocket', 'polling'],
    ...(clinicKey ? { auth: { clinicKey } } : {}),
  };
}
