import { prisma } from '../lib/prisma';

async function main() {
  const total = await prisma.promo.count({
    where: { status: 'ACTIVE', requirements: { none: {} } }
  });
  console.log('Total promos ACTIVE sin requirements:', total);

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', requirements: { none: {} } },
    select: {
      id: true,
      title: true,
      commerce: { select: { name: true } },
      sourceText: true,
      sourceUrl: true,
    },
    take: 15,
    orderBy: { createdAt: 'desc' }
  });

  for (const p of promos) {
    console.log('\n---');
    console.log('TITLE:', p.title);
    console.log('COMMERCE:', p.commerce.name);
    console.log('URL:', p.sourceUrl);
    console.log('TEXT:', (p.sourceText ?? '').slice(0, 400));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
