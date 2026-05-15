import { prisma } from '../lib/prisma';
async function main() {
  // Marcar como DRAFT las promos de "Ciudadanía Porteña" y "Tarjeta Naranja X" 
  // (que tienen requirements sin banco/red específica)
  const ciudadana = await prisma.promo.updateMany({
    where: { title: { contains: 'CIUDADAN', mode: 'insensitive' } },
    data: { status: 'DRAFT' }
  });
  console.log('Ciudadanía → DRAFT:', ciudadana.count);
}
main().catch(console.error).finally(() => process.exit(0));
