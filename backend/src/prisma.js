import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return base.$extends({
    query: {
      queue: {
        async updateMany({ args, query }) {
          if (args.data?.status === 'COMPLETED') {
            const rows = await base.queue.findMany({
              where: args.where,
              select: { patientId: true },
            });
            const result = await query(args);
            for (const row of rows) {
              try {
                const { processCompletedQueueVisit } = await import('./services/followUp.service.js');
                await processCompletedQueueVisit(row.patientId);
              } catch (e) {
                console.error(
                  '[prisma] follow-up after queue updateMany COMPLETED failed:',
                  e?.message || e
                );
              }
            }
            return result;
          }
          return query(args);
        },
        async update({ args, query }) {
          const result = await query(args);
          if (
            result &&
            typeof result === 'object' &&
            args.data?.status === 'COMPLETED' &&
            result.patientId
          ) {
            try {
              const { processCompletedQueueVisit } = await import('./services/followUp.service.js');
              await processCompletedQueueVisit(result.patientId);
            } catch (e) {
              console.error('[prisma] follow-up after Queue COMPLETED failed:', e?.message || e);
            }
          }
          return result;
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
