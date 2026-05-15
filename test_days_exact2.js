const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    where: {
      OR: [
        { title: { contains: 'CIUDADANIA PORTEÑA' } },
        { title: { contains: 'CREDICOOP – MODO' } }
      ]
    },
    select: { title: true, validDays: true, specificDates: true, sourceText: true }
  });

  for (const p of promos) {
    console.log(`\n========== ${p.title} ==========`);
    console.log(`ValidDays: ${p.validDays}, specificDates: ${p.specificDates}`);
    
    // Buscar la palabra VÁLIDO, VIGENCIA o similar y tomar unos 100 caracteres
    const match = p.sourceText.match(/(?:V[AÁ]LID[OA]|VIGENCIA|PROGRAMA)[^.]{0,200}/i);
    if (match) {
      console.log(`Contexto detectado:\n${match[0]}`);
    } else {
      console.log(`Primeros 200 chars:\n${p.sourceText.substring(0,200)}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
