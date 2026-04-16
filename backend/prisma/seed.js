import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.doctor.upsert({
    where: { id: 'clinic-default-doctor' },
    update: {},
    create: {
      id: 'clinic-default-doctor',
      name: 'General Clinic',
      specialization: null,
    },
  });
  await prisma.doctor.upsert({
    where: { id: 'clinic-doctor-2' },
    update: { name: 'Dr. Smith', specialization: 'Cardiology' },
    create: {
      id: 'clinic-doctor-2',
      name: 'Dr. Smith',
      specialization: 'Cardiology',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
