const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promoId = 'cmnuujvmq0001gij5ig9wd855';
  const mpWalletId = 'cmnulzfz80009qlkkuyavwcvh';
  
  console.log('--- Corrigiendo Promo Mercado Pago Fin de semana ---');
  
  // 1. Update Promo basic info
  await prisma.promo.update({
    where: { id: promoId },
    data: {
      validUntil: new Date('2026-05-01T02:59:59.999Z'), // Fin del 30/04 en UTC-3
      status: 'ACTIVE'
    }
  });

  // 2. Update Requirements
  await prisma.promoRequirement.updateMany({
    where: { promoId: promoId },
    data: {
      bankId: null,      // Quitar Ciudad
      walletId: mpWalletId, // Poner Mercado Pago
      cardNetworkId: null,   // Quitar Visa (hacer todos los medios)
      cardType: null,        // Quitar Credito (hacer todos los medios)
      paymentChannel: 'QR',
      discountValue: 20,
      note: 'Pagando con Mercado Pago'
    }
  });

  console.log('✅ Promo Mercado Pago corregida: Vencimiento 30/04, Wallet MP, Todos los medios.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
