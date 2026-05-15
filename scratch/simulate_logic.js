const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promo = await prisma.promo.findFirst({
    where: { 
      commerce: { name: 'Coto' },
      requirements: { some: { discountValue: { gt: 0 } } }
    },
    include: { 
      requirements: {
        include: { bank: true, wallet: true, cardNetwork: true }
      },
      category: true,
      commerce: true
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!promo) {
    console.log("No se encontraron promos con reqs.");
    return;
  }

  console.log("PROMO:", promo.title);
  console.log("REQS count:", promo.requirements.length);
  
  const allReqs = promo.requirements;
  
  // Logic from API
  const globalMaxDiscount = allReqs.length > 0 ? allReqs.reduce((max, r) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, allReqs[0]) : null;
  
  // Logic from Frontend
  function maxDiscountReq(p) {
    // Simulando p.globalMaxDiscount que viene de la API
    if (globalMaxDiscount) return globalMaxDiscount;
    return p.requirements.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), p.requirements[0]);
  }

  const best = maxDiscountReq(promo);
  console.log("BEST VALUE FOUND:", best ? best.discountValue : 'NONE');
  console.log("REQS DETAIL:", promo.requirements.map(r => ({ val: r.discountValue, bank: r.bank?.name })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
