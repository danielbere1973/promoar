const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMacroRequirement() {
  const req = await prisma.promoRequirement.findFirst({
    where: { bank: { name: { contains: 'Macro', mode: 'insensitive' } } },
    include: { bank: true }
  });
  console.log('Requirement + Bank:', JSON.stringify(req, null, 2));
  await prisma.$disconnect();
}

checkMacroRequirement();
