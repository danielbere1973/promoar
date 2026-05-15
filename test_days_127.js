const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({ 
    where: { validDays: 127 },
    select: { title: true, sourceText: true, specificDates: true } 
  });
  
  let issues = 0;
  for (const p of promos) {
    if (!p.sourceText) continue;
    const t = p.sourceText.toLowerCase();
    const hasDays = /lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo/.test(t);
    // If it has days mentioned, but validDays is 127 and specificDates is missing, it might be a bug
    if (hasDays && !p.specificDates && !t.includes('todos los d')) {
      console.log(`\nIssue detected: ${p.title}`);
      console.log(`Text preview: ${t.substring(0, 150)}`);
      issues++;
      if (issues > 5) break;
    }
  }
}

main().finally(() => prisma.$disconnect());
