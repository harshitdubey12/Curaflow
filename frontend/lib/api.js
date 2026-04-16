/**
 * REST + Socket.io base (backend runs on PORT, default 4000).
 * Override with NEXT_PUBLIC_API_URL (e.g. in .env.local). Use 127.0.0.1 to avoid IPv6 localhost quirks.
 */
export function getApiBase() {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (u != null && String(u).trim() !== '') {
    return String(u).replace(/\/$/, '');
  }
  return 'http://127.0.0.1:4000';
}

/** User-facing hint when /doctors or /queue calls fail (API down or wrong URL). */
export function getApiUnreachableHelp() {
  const base = getApiBase();
  return `Cannot reach the clinic API at ${base}. In the project root run: npm run dev (starts the backend on port 4000 and this app on 3000). For WhatsApp, Twilio must POST to /whatsapp-webhook on that same API; use a tunnel such as ngrok to port 4000 while testing. If you use frontend/.env.local, set NEXT_PUBLIC_API_URL=http://127.0.0.1:4000`;
}
