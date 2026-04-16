# Step-by-step verification results

The project defaults to **SQLite** (`DATABASE_URL="file:./dev.db"` in `backend/.env`). No Docker and no local Postgres install is required.

Optional: `docker-compose.yml` is only if you switch Prisma to PostgreSQL yourself.

## 1. Project setup

| Check | Result |
|--------|--------|
| `npm install` at repo root | **PASS** (postinstall runs `prisma generate`) |
| `.env` present and keys set | **PASS** after adding `backend/.env` and `frontend/.env.local` (adjust `DATABASE_URL` for your machine) |
| `npm run dev` or backend only | **PASS** backend starts; `GET /health` returns `{"ok":true}` |
| No crash on startup | **PASS** (API does not connect to DB until the first Prisma query) |

## 2. Database (Prisma)

| Check | Result |
|--------|--------|
| `cd backend && npx prisma migrate deploy` | **PASS** with SQLite (`file:./dev.db`). No server process required. |
| Tables: Patient, Queue, Doctor, Visit | **Defined in schema**; created by the SQLite migration under `backend/prisma/migrations/` |
| Prisma Studio | **Manual:** `cd backend && npx prisma studio` |

**First-time local setup (no Docker):**

```bash
cd backend && npx prisma migrate deploy && npm run smoke:queue
```

## 3. Patient registration

| Check | Result |
|--------|--------|
| Web form → `POST /patient/register` | **Code path:** `patient.controller.js` → `registerPatient` → DB + optional Twilio |
| Patient saved | **Yes** (`Patient` upsert + `Queue` row + `Visit`) |
| WhatsApp webhook | **Code path:** `POST /whatsapp-webhook` TwiML reply with token + wait text |

**Manual Twilio test:** point sandbox webhook to your public URL + `/whatsapp-webhook`, send a message; requires valid Twilio env vars.

## 4. Queue system

| Check | Result |
|--------|--------|
| Auto token | **`nextTokenNumber()`** uses `max(tokenNumber)+1` |
| Increments 1,2,3 | **Yes** (unique `tokenNumber` in DB) |
| Patient linked | **`Queue.patientId`** |
| Status waiting | **`QueueStatus.WAITING`** (Prisma enum) |

## 5. Queue logic

| Check | Result |
|--------|--------|
| Current running token | **`IN_PROGRESS`** row with lowest `tokenNumber` in `getQueueSnapshot` |
| Order | **Waiting** ordered by `tokenNumber` ascending |
| Next | **`advanceQueue`** completes current `IN_PROGRESS`, promotes first `WAITING` |
| Skip | **`skipCurrent`** marks `IN_PROGRESS` as `SKIPPED`, then promotes next |

## 6. Real-time (Socket.io)

| Check | Result |
|--------|--------|
| Broadcast on change | **`broadcastQueue(io)`** emits `queue:update` after register/next/skip and on socket connect |
| Doctor + patient UIs | **Doctor:** `pages/doctor.js` subscribes. **Patient:** `pages/patient.js` subscribes after status is loaded |

**Manual:** open `/doctor` and `/patient`, trigger Next; both should refresh without full page reload.

## 7. Wait time

| Check | Result |
|--------|--------|
| Formula | **`ahead * AVG_CONSULTATION_MINUTES`** (see `queue.service.js` and `config.js`) |

## 8. WhatsApp integration

| Check | Result |
|--------|--------|
| Message hits server | **POST `/whatsapp-webhook`** with `express.urlencoded` |
| Auto reply | **TwiML `<Message>`** from `whatsapp.controller.js` |
| Token + wait in reply | **Yes** (`You are number …` + Gemini or fallback text) |

**Requires** `TWILIO_*` in `backend/.env`. Without Twilio, outbound API WhatsApp is skipped with a console warning; inbound TwiML reply still returns if the webhook is called.

## 9. Notifications

| Check | Result |
|--------|--------|
| “You are number X” | **Webhook TwiML** + optional outbound in `patient.controller` when Twilio is set |
| “Your turn is near” | **`notifyFirstTwoWaiting`** after Next/Skip (first two `WAITING`) |

## 10. Doctor dashboard

| Check | Result |
|--------|--------|
| Current patient + list | **`GET /queue/snapshot` + socket** |
| Next / Skip | **`POST /queue/next`**, **`POST /queue/skip`** |

## 11. Patient status page

| Check | Result |
|--------|--------|
| Phone → status | **`GET /queue/status/:phone`** |
| Token, current token, est. wait | **Returned as JSON**; UI in `pages/patient.js` |

## 12. Full flow (three patients)

Automated **without HTTP** (needs DB):

```bash
cd backend && npm run smoke:queue
```

This asserts: tokens 1–3, waiting count, first Next → current 1, positions, second Next → current 2, skip → current 3, then cleans up.

**Manual with UI:** register three phones on `/patient`, open `/doctor`, click Next twice, Skip once; confirm tokens and queue list match expectations.

---

## Quick commands

```bash
cd backend && npx prisma migrate deploy && npm run smoke:queue
cd .. && npm run dev
```

Then open http://localhost:3000/doctor and http://localhost:3000/patient.
