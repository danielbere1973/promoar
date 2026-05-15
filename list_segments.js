const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const segments = await prisma.bankSegment.findMany({
    include: { bank: true }
  });
  console.log("=== SEGMENTOS DE BANCO EN DB ===");
  segments.forEach(s => {
    console.log(`ID: ${s.id} | Banco: ${s.bank.name} | Segmento: ${s.name}`);
  });
}

main().finally(() => prisma.$disconnect());
