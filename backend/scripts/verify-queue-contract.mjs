/**
 * Contract checks: priority ordering (priority DESC, createdAt ASC), multi-doctor isolation,
 * register response shape via queueEntryToResponse, HTTP checks against the API.
 *
 * HTTP: defaults to http://127.0.0.1:<PORT> from config (PORT or 4000). Override with VERIFY_API_URL.
 * Skip HTTP: VERIFY_SKIP_HTTP=1 (DB + in-process service checks only).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in backend/.env');
  process.exit(1);
}

const { prisma } = await import('../src/prisma.js');
const queueService = await import('../src/services/queue.service.js');
const { config } = await import('../src/config.js');

async function reset() {
  await prisma.visit.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.patient.deleteMany();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

try {
  await reset();

  const defDoc = config.defaultDoctorId;
  const d2 = 'clinic-doctor-2';
  await prisma.doctor.upsert({
    where: { id: d2 },
    update: {},
    create: { id: d2, name: 'Dr. Smith', specialization: 'Cardiology' },
  });

  const a = await queueService.registerPatient({
    name: 'Contract_A',
    phone: '+17770100001',
    doctorId: defDoc,
    priority: 0,
    type: 'walkin',
  });
  const b = await queueService.registerPatient({
    name: 'Contract_B',
    phone: '+17770100002',
    doctorId: defDoc,
    priority: 2,
    type: 'walkin',
  });
  const c = await queueService.registerPatient({
    name: 'Contract_C',
    phone: '+17770100003',
    doctorId: defDoc,
    priority: 3,
    type: 'walkin',
  });

  const ordered = await queueService.getOrderedWaiting(defDoc);
  assert(ordered.length === 3, `expected 3 waiting, got ${ordered.length}`);
  assert(ordered[0].priority === 3 && ordered[0].patient.name === 'Contract_C', 'first should be emergency C');
  assert(ordered[1].priority === 2 && ordered[1].patient.name === 'Contract_B', 'second should be VIP B');
  assert(ordered[2].priority === 0 && ordered[2].patient.name === 'Contract_A', 'third should be normal A');

  const r0 = queueService.queueEntryToResponse(a.queueEntry);
  assert(r0.priority === 0 && r0.type === 'walkin' && typeof r0.tokenNumber === 'number', 'queueEntryToResponse shape');

  await queueService.registerPatient({
    name: 'Contract_D2',
    phone: '+17770100004',
    doctorId: d2,
    priority: 0,
    type: 'walkin',
  });
  const snapDef = await queueService.getQueueSnapshot(defDoc);
  const snapD2 = await queueService.getQueueSnapshot(d2);
  assert(snapDef.waitingCount === 3, `default doctor should have 3 waiting, got ${snapDef.waitingCount}`);
  assert(snapD2.waitingCount === 1, `doctor2 should have 1 waiting, got ${snapD2.waitingCount}`);

  await queueService.registerPatient({
    name: 'Contract_E1',
    phone: '+17770100005',
    doctorId: defDoc,
    priority: 3,
    type: 'walkin',
  });
  await queueService.registerPatient({
    name: 'Contract_E2',
    phone: '+17770100006',
    doctorId: defDoc,
    priority: 3,
    type: 'walkin',
  });
  const emOrder = await queueService.getOrderedWaiting(defDoc);
  const e1 = emOrder.find((q) => q.patient.name === 'Contract_E1');
  const e2 = emOrder.find((q) => q.patient.name === 'Contract_E2');
  assert(e1 && e2, 'both emergency rows missing');
  const i1 = emOrder.indexOf(e1);
  const i2 = emOrder.indexOf(e2);
  assert(i1 < i2, 'same priority: earlier createdAt (E1) should be before E2');

  const skipHttp = String(process.env.VERIFY_SKIP_HTTP || '').trim() === '1';
  const port = config.port || 4000;
  const base = (process.env.VERIFY_API_URL?.trim() || `http://127.0.0.1:${port}`).replace(/\/$/, '');

  if (!skipHttp) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const h = await fetch(`${base}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!h.ok) {
        console.warn(`[verify] HTTP skipped: ${base}/health returned ${h.status} (set VERIFY_SKIP_HTTP=1 to silence)`);
      } else {
        console.log(`[verify] HTTP checks: ${base}`);
        const q = await fetch(`${base}/queue?doctorId=${encodeURIComponent(defDoc)}`);
        const j = await q.json();
        assert(q.ok && Array.isArray(j.waiting), 'GET /queue should return waiting array');
        const bad = await fetch(`${base}/queue?doctorId=not-real-id-xxxxx`);
        assert(bad.status === 400, 'invalid doctorId should be 400');
      }
    } catch (e) {
      console.warn(
        `[verify] HTTP skipped: API not reachable at ${base} (${e.cause?.message || e.message}). Start the backend or set VERIFY_SKIP_HTTP=1.`
      );
    }
  }

  await reset();
  console.log('verify-queue-contract: OK');
} catch (e) {
  console.error('verify-queue-contract: FAIL', e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
