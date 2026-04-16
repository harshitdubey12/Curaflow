/**
 * Queue logic smoke test (no HTTP). Requires DATABASE_URL in backend/.env
 * Run: node scripts/smoke-queue.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in backend/.env (see docker-compose.yml in repo root).');
  process.exit(1);
}

const { prisma } = await import('../src/prisma.js');
const queueService = await import('../src/services/queue.service.js');

const mockIo = {
  emit: () => {},
};

async function reset() {
  await prisma.visit.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.patient.deleteMany();
}

try {
  await reset();

  const p1 = await queueService.registerPatient({
    name: 'Patient One',
    phone: '+15550000001',
    symptoms: 'cough',
  });
  const p2 = await queueService.registerPatient({
    name: 'Patient Two',
    phone: '+15550000002',
    symptoms: null,
  });
  const p3 = await queueService.registerPatient({
    name: 'Patient Three',
    phone: '+15550000003',
    symptoms: null,
  });

  const tokens = [p1.queueEntry.tokenNumber, p2.queueEntry.tokenNumber, p3.queueEntry.tokenNumber];
  if (tokens[0] !== 1 || tokens[1] !== 2 || tokens[2] !== 3) {
    throw new Error(`Expected tokens 1,2,3 got ${tokens.join(',')}`);
  }

  let snap = await queueService.getQueueSnapshot();
  if (snap.currentToken !== null) throw new Error('Expected no current token before Next');
  if (snap.waitingCount !== 3) throw new Error(`Expected 3 waiting, got ${snap.waitingCount}`);

  await queueService.advanceQueue(mockIo);
  snap = await queueService.getQueueSnapshot();
  if (snap.currentToken !== 1) throw new Error(`After first Next, current should be 1, got ${snap.currentToken}`);
  if (snap.waitingCount !== 2) throw new Error(`Expected 2 waiting, got ${snap.waitingCount}`);

  const pos2 = await queueService.getPositionByPhone('+15550000002');
  if (pos2.position !== 1) throw new Error(`P2 should be position 1, got ${pos2.position}`);
  if (pos2.ahead !== 0) throw new Error(`P2 should have 0 ahead, got ${pos2.ahead}`);

  await queueService.advanceQueue(mockIo);
  snap = await queueService.getQueueSnapshot();
  if (snap.currentToken !== 2) throw new Error(`Second Next: current token should be 2, got ${snap.currentToken}`);

  await queueService.skipCurrent(mockIo);
  snap = await queueService.getQueueSnapshot();
  if (snap.currentToken !== 3) throw new Error(`After skip, current should be token 3, got ${snap.currentToken}`);

  const p2Row = await prisma.patient.findUnique({ where: { phone: '+15550000002' } });
  const p2Visit = await prisma.visit.findFirst({
    where: { patientId: p2Row.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!p2Visit || p2Visit.status !== 'SKIPPED') {
    throw new Error(
      `Skip should close the open visit as SKIPPED, got ${p2Visit?.status ?? 'no visit'}`
    );
  }

  const done = await prisma.queue.findMany({ orderBy: { tokenNumber: 'asc' } });
  const statuses = done.map((q) => q.status);
  console.log('Token statuses:', done.map((q) => `${q.tokenNumber}:${q.status}`).join(', '));

  await prisma.visit.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.patient.deleteMany();
  await queueService.registerPatient({
    name: 'Dup Guard',
    phone: '+15550000999',
    symptoms: 'test',
  });
  try {
    await queueService.registerPatient({
      name: 'Dup Guard',
      phone: '+15550000999',
      symptoms: 'again',
    });
    throw new Error('expected duplicate registration to be rejected');
  } catch (e) {
    if (e.statusCode !== 409) throw e;
  }

  await reset();
  console.log('smoke-queue: OK');
} catch (e) {
  console.error('smoke-queue: FAIL', e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
