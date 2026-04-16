import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import routes from './routes/index.js';
import { config } from './config.js';
import { setIo, getIo } from './socket.js';
import * as queueService from './services/queue.service.js';
import { startClinicJobs } from './services/clinicJobs.service.js';

const app = express();

const corsOptions =
  config.nodeEnv === 'development'
    ? { origin: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Key'] }
    : { origin: config.corsOrigin, allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Key'] };

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** Use through any tunnel (ngrok, cloudflared, localtunnel) to confirm traffic reaches this process. */
app.get('/tunnel-check', (_req, res) => {
  res.json({
    ok: true,
    service: 'curaflow-backend',
    port: config.port,
    hint: 'If you see this JSON through your public URL, forwarding works. Set Twilio webhook to POST .../whatsapp-webhook',
    ts: new Date().toISOString(),
  });
});

// Root URL (browsers often open / with no path; avoids confusing 404 on ngrok tests)
app.get('/', (_req, res) => {
  res.type('text/plain').send('Curaflow API. Use GET /health, GET /tunnel-check, or POST /whatsapp-webhook.');
});

app.use(routes);

const httpServer = createServer(app);

const devFrontendOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const io = new Server(httpServer, {
  cors:
    config.nodeEnv === 'development'
      ? { origin: devFrontendOrigins, methods: ['GET', 'POST'] }
      : { origin: config.corsOrigin, methods: ['GET', 'POST'] },
});

setIo(io);

io.use((socket, next) => {
  if (!config.socketIoRequireStaff || !config.clinicStaffApiKey) {
    return next();
  }
  const fromAuth = socket.handshake.auth && socket.handshake.auth.clinicKey;
  const fromHeader = socket.handshake.headers['x-clinic-key'];
  const sent = String(fromAuth ?? fromHeader ?? '').trim();
  if (sent !== config.clinicStaffApiKey) {
    const err = new Error('Socket.io: staff key required (set auth.clinicKey or X-Clinic-Key)');
    err.data = { code: 'STAFF_KEY_REQUIRED' };
    return next(err);
  }
  return next();
});

/** When SOCKET_IO_REQUIRE_STAFF is false (default), queue:update is open like a public display board feed. */
io.on('connection', async (socket) => {
  await queueService.broadcastQueue(io);
  socket.on('disconnect', () => {});
});

httpServer.listen(config.port, '0.0.0.0', () => {
  const p = config.port;
  console.log(`API and Socket.io on http://127.0.0.1:${p}`);
  console.log(
    `Tunnel test: GET http://127.0.0.1:${p}/tunnel-check  then open the same path on your public URL`
  );
  console.log(
    `Twilio WhatsApp webhook: POST http://127.0.0.1:${p}/whatsapp-webhook  (forward port ${p} with ngrok, cloudflared, or localtunnel)`
  );
  console.log(
    `  cloudflared:  cloudflared tunnel --url http://127.0.0.1:${p}`
  );
  console.log(
    `  localtunnel:  npx localtunnel --port ${p}`
  );
  startClinicJobs(getIo);
});
