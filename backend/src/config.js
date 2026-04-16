import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const repoRootEnv = path.join(backendRoot, '..', '.env');
const backendEnv = path.join(backendRoot, '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return dotenv.parse(fs.readFileSync(filePath));
  } catch {
    return {};
  }
}

/**
 * Merge root .env then backend/.env. Backend wins only when its value is non-empty.
 * Stops an empty GEMINI_API_KEY= in one file from wiping a key pasted in the other file.
 */
function mergeEnvFiles() {
  const root = parseEnvFile(repoRootEnv);
  const back = parseEnvFile(backendEnv);
  const merged = { ...root };
  for (const [k, v] of Object.entries(back)) {
    const trimmed = String(v ?? '').trim();
    const prev = merged[k];
    const prevTrim = prev != null ? String(prev).trim() : '';
    if (trimmed !== '') {
      merged[k] = v;
    } else if (prevTrim !== '') {
      /* keep previous (e.g. GEMINI only in root, empty line in backend) */
    } else {
      merged[k] = v;
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
}

mergeEnvFiles();

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_NUMBER,
  /** When true, queue/patient code skips Twilio REST sends (saves daily quota; replies still use webhook TwiML). */
  disableOutboundWhatsApp:
    process.env.TWILIO_DISABLE_OUTBOUND_WHATSAPP === '1' ||
    process.env.TWILIO_DISABLE_OUTBOUND_WHATSAPP === 'true',
  geminiApiKey: process.env.GEMINI_API_KEY,
  /** Optional. Shown to the WhatsApp chatbot (Gemini) so it can answer about your clinic. */
  clinicChatbotContext: process.env.CLINIC_CHATBOT_CONTEXT || '',
  /**
   * Offline FAQ when the user asks for hours but CLINIC_CHATBOT_CONTEXT is empty.
   * Set DEFAULT_CLINIC_HOURS (English) and optionally DEFAULT_CLINIC_HOURS_HI (Hindi).
   */
  defaultClinicHoursLineEn:
    (process.env.DEFAULT_CLINIC_HOURS || '').trim() ||
    'Hours are not stored in this app. Check reception or the clinic website for today\'s schedule. Say JOIN to get a queue token.',
  defaultClinicHoursLineHi:
    (process.env.DEFAULT_CLINIC_HOURS_HI || '').trim() ||
    'ऐप में घंटों की पूरी सूची नहीं है। आज का समय रिसेप्शन या वेबसाइट से जानें। टोकन के लिए JOIN लिखें।',
  avgConsultationMinutes: Number(process.env.AVG_CONSULTATION_MINUTES) || 10,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  /** Matches seeded row in migration; used when API omits doctorId. */
  defaultDoctorId: process.env.DEFAULT_DOCTOR_ID || 'clinic-default-doctor',
  /** set CLINIC_JOBS_ENABLED=false to disable interval (notifications + no-show). */
  clinicJobsEnabled: process.env.CLINIC_JOBS_ENABLED !== 'false',
  clinicJobsIntervalMs: Number(process.env.CLINIC_JOBS_INTERVAL_MS) || 60_000,
  /** Minutes without WhatsApp reply after being called (IN_PROGRESS) before auto skip (typical 5–10). */
  noShowTimeoutMinutes: Number(process.env.NO_SHOW_TIMEOUT_MINUTES) || 10,
  /** Minimum gap between "doctor is delayed" broadcasts per doctor (default 10 minutes). */
  doctorDelayNotifyCooldownMs: Number(process.env.DOCTOR_DELAY_NOTIFY_COOLDOWN_MS) || 600_000,
  /** After the next-up patient, first N patients behind them get the "coming soon" ping (default 2: waiting positions 2–3). */
  upcomingNotifyPositions: Math.min(
    20,
    Math.max(1, Number(process.env.UPCOMING_NOTIFY_POSITIONS) || 2)
  ),
  /** After a failed "coming soon" send, wait this long before retrying the same row (reduces quota spam). */
  notificationFailedRetryCooldownMs:
    Number(process.env.NOTIFICATION_FAILED_RETRY_COOLDOWN_MS) || 900_000,
  /** Gap between follow-up WhatsApp retries when the first send failed (default 5 minutes). */
  followUpRetryCooldownMs: Number(process.env.FOLLOW_UP_RETRY_COOLDOWN_MS) || 300_000,
  /**
   * When multiple API processes share one DB, set CLINIC_JOBS_USE_DB_LEASE=true so only one runs
   * notifications, no-show checks, and follow-up retries (uses JobLease table).
   */
  clinicJobsUseDbLease: process.env.CLINIC_JOBS_USE_DB_LEASE === 'true',
  /** How long a process holds the clinic-jobs lease (renewed each tick). Default 90s. */
  clinicJobLeaseTtlMs: Number(process.env.CLINIC_JOB_LEASE_TTL_MS) || 90_000,
  /** Pause between each recipient in POST /broadcast (ms). Default 400. */
  broadcastMessageDelayMs: Math.max(0, Number(process.env.BROADCAST_MESSAGE_DELAY_MS) || 400),
  /** IANA timezone for analytics (patients per day buckets, peak hours). Default India Standard Time. */
  clinicTimezone: process.env.CLINIC_TIMEZONE || 'Asia/Kolkata',
  /**
   * When non-empty, GET /patient/lookup requires header X-Clinic-Key to match exactly.
   * Set the same value in the frontend as NEXT_PUBLIC_CLINIC_STAFF_KEY for the doctor dashboard.
   */
  clinicStaffApiKey: String(process.env.CLINIC_STAFF_API_KEY || '').trim(),
  /**
   * When true and CLINIC_STAFF_API_KEY is set, Socket.io handshakes must send auth.clinicKey matching the staff key.
   * Set NEXT_PUBLIC_CLINIC_STAFF_KEY on every client that should receive queue:update (doctor, patient, display).
   * Default false so public TV and kiosks work without embedding a secret.
   */
  socketIoRequireStaff:
    process.env.SOCKET_IO_REQUIRE_STAFF === '1' ||
    process.env.SOCKET_IO_REQUIRE_STAFF === 'true',
};

if (config.nodeEnv === 'development' && !String(config.geminiApiKey || '').trim()) {
  console.warn(
    '[config] GEMINI_API_KEY is empty after merging .env files. Set it in backend/.env or repo root .env, then restart.'
  );
}
