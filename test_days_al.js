const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({ select: { title: true, sourceText: true, validDays: true } });
  let found = 0;
  for (const p of promos) {
    const t = p.sourceText ? p.sourceText.toLowerCase() : '';
    // Look for "lunes al viernes", etc
    if (t.match(/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+al\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i)) {
      console.log(`\nTitle: ${p.title}`);
      console.log(`ValidDays mask: ${p.validDays}`);
      console.log(`Match: ${t.match(/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+al\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i)[0]}`);
      found++;
      if (found > 5) break;
    }
  }
}

main().finally(() => prisma.$disconnect());
