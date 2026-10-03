const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Solo toca runs "running" que llevan colgados más de STALE_HOURS:
// evita pisar corridas que en realidad terminaron bien pero cuyo
// request final no llegó a actualizar la DB (ver nota en el admin).
const STALE_HOURS = 2;

async function main() {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
  const updated = await prisma.scraperRun.updateMany({
    where: {
      status: 'running',
      startedAt: { lt: cutoff },
    },
    data: {
      status: 'error',
      message: `Interrumpido: sin actualizar hace más de ${STALE_HOURS}h`,
      finishedAt: new Date()
    }
  });
  console.log(`Updated ${updated.count} stuck scraper runs (started before ${cutoff.toISOString()}).`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
