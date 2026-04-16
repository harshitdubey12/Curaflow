/**
 * Seeds 5 completed visits with known durations, checks average and smart wait math, then cleans up.
 * Run from backend: npm run verify:smart-wait
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
const { config } = await import('../src/config.js');
const {
  getAverageConsultationMinutesLast5,
  calculateSmartWaitMinutes,
} = await import('../src/services/waitTime.service.js');

const doctorId = config.defaultDoctorId;
const phones = [0, 1, 2, 3, 4].map((i) => `+1999111${String(i).padStart(4, '0')}`);
const durationsMin = [10, 15, 20, 25, 30];
const expectedAvg = durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length;

async function cleanup() {
  await prisma.patient.deleteMany({ where: { phone: { in: phones } } });
}

try {
  await cleanup();

  const t0 = Date.now();
  for (let i = 0; i < 5; i++) {
    const patient = await prisma.patient.create({
      data: {
        name: `SmartWait ${i}`,
        phone: phones[i],
        department: 'general',
      },
    });
    const endTime = new Date(t0 + i * 120_000);
    const startTime = new Date(endTime.getTime() - durationsMin[i] * 60_000);
    await prisma.visit.create({
      data: {
        patientId: patient.id,
        doctorId,
        status: 'COMPLETED',
        startTime,
        endTime,
      },
    });
  }

  const avg = await getAverageConsultationMinutesLast5(doctorId);
  if (avg == null) throw new Error('Expected average from 5 visits, got null');
  if (Math.abs(avg - expectedAvg) > 0.01) {
    throw new Error(`Expected avg ${expectedAvg}, got ${avg}`);
  }

  const wait3 = await calculateSmartWaitMinutes(3, doctorId);
  const expectedWait = Math.round(3 * expectedAvg);
  if (wait3 !== expectedWait) {
    throw new Error(`Expected wait ${expectedWait} for 3 ahead, got ${wait3}`);
  }

  await cleanup();
  console.log(
    `verify-smart-wait-durations: OK (avg=${avg.toFixed(2)} min, 3 ahead => ${wait3} min)`
  );
} catch (e) {
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
