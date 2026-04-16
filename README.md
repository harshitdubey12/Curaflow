# Clinic Patient Flow and Queue Management (MVP)

Node.js (Express) + Socket.io backend, Next.js frontend, **SQLite** with Prisma (no Docker or Postgres required for local dev), Twilio WhatsApp webhook, optional Google Gemini for friendlier SMS copy.

## Project layout

```
curaflow/
  package.json          # workspaces + dev script
  backend/              # Express API, Socket.io, Prisma, Twilio, Gemini
    prisma/
      schema.prisma
      migrations/
    src/
      index.js
      routes/
      controllers/
      services/
  frontend/             # Next.js pages
    pages/
```

## Prerequisites

- Node.js 18+
- Nothing else for the database: Prisma uses **SQLite** at `backend/prisma/dev.db` by default
- (Optional) Twilio account with WhatsApp sandbox or sender
- (Optional) Google AI Studio key for Gemini

## Setup

1. **Install dependencies**

   ```bash
   cd curaflow
   npm install
   ```

2. **Environment**

   Copy examples and edit:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

   Default `backend/.env` uses `DATABASE_URL="file:./dev.db"` (SQLite file under `backend/prisma/`).

   Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (default `http://localhost:4000`).

3. **Database**

   Apply migrations once (creates `prisma/dev.db`):

   ```bash
   cd backend && npx prisma migrate deploy
   ```

   Or from repo root:

   ```bash
   npm run prisma:migrate
   ```

   Sanity check (optional):

   ```bash
   npm run smoke:queue
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   - API and Socket.io: http://localhost:4000  
   - Next.js: http://localhost:3000  

   Pages: `/` (links), `/doctor` (dashboard), `/patient` (register + status).

## API routes (backend)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/patient/register` | JSON: `name`, `phone`, optional `symptoms` |
| GET | `/queue/status/:phone` | Queue position and wait estimate |
| GET | `/queue/snapshot` | Full queue snapshot for dashboard |
| POST | `/queue/next` | Complete current (if any), call next token |
| POST | `/queue/skip` | Skip current, call next |
| POST | `/whatsapp-webhook` | Twilio incoming WhatsApp (form body) |

## Twilio WhatsApp

1. Configure your Twilio WhatsApp sender (sandbox or approved number).
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` in `backend/.env`.
3. Point the Twilio webhook URL to `https://your-host/whatsapp-webhook` (use ngrok for local testing).

Incoming messages enqueue the sender: message body is used as the patient name (or a default). The reply includes token and estimated wait.

## Verification

See **`VERIFY_CHECKLIST.md`** for a full step-by-step checklist, what was verified in code, and commands (including `docker compose` + `npm run smoke:queue` in `backend`).

## Notes

- No auth in this MVP.
- Twilio and Gemini are optional; registration and queue still work without them (WhatsApp sends are skipped with a console warning).
- Wait time uses `AVG_CONSULTATION_MINUTES` (default 10) times people ahead of you in the waiting list.
