const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.promo.findFirst({ 
    where: { title: 'JUBILADOS' },
    select: { sourceText: true } 
  });
  
  if (p && p.sourceText) {
    const text = p.sourceText;
    const match = text.match(/.{0,50}(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo).{0,50}/gi);
    if (match) {
      console.log('Matches encontrados:');
      match.forEach(m => console.log(' -> ' + m.replace(/\s+/g, ' ')));
    } else {
      console.log('No days found in text');
    }
  }
}

main().finally(() => prisma.$disconnect());
