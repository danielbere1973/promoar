const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.promoRequirement.findMany({
    where: { paymentChannel: 'NFC' },
    include: { promo: true, wallet: true }
  });

  let updatedCount = 0;
  for (const r of reqs) {
    const t = r.promo.sourceText ? r.promo.sourceText.toUpperCase() : '';
    // Si la exclusión de NFC está en el texto
    if (t.includes('NO APLICA PARA PAGOS EFECTUADOS CON TECNOLOGÍA “NFC”') || 
        t.includes('T.A.P') || 
        t.includes('TECNOLOGÍA NFC')) {
      
      let newChannel = 'ANY';
      // Si la billetera es MODO o el texto menciona a MODO, cambiar a QR
      if ((r.wallet && r.wallet.name.toUpperCase().includes('MODO')) || t.includes('MODO')) {
        newChannel = 'QR';
      }
      
      await prisma.promoRequirement.update({
        where: { id: r.id },
        data: { paymentChannel: newChannel }
      });
      updatedCount++;
    }
  }
  
  console.log(`Reparados ${updatedCount} requerimientos asignados erróneamente a NFC.`);
}

main().finally(() => prisma.$disconnect());
