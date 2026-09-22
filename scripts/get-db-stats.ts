import { prisma } from '../lib/prisma';

async function main() {
  const [
    userCount,
    userWithProfileCount,
    clickCount,
    recentClicks,
    savedPromosCount,
    usageEventsCount,
    activePromosCount,
    totalCommercesCount,
    clicksBySource,
    topClickedPromos,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.financialProfile.count(),
    prisma.promoClick.count(),
    prisma.promoClick.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.savedPromo.count(),
    prisma.promoUsageEvent.count(),
    prisma.promo.count({ where: { status: 'ACTIVE' } }),
    prisma.commerce.count(),
    prisma.promoClick.groupBy({
      by: ['source'],
      _count: true,
    }),
    prisma.promoClick.groupBy({
      by: ['promoId'],
      _count: true,
      orderBy: { _count: { promoId: 'desc' } },
      take: 10,
    }),
  ]);

  console.log('=== STATS SUMMARY ===');
  console.log('Registered Users:', userCount);
  console.log('Users with Financial Profile:', userWithProfileCount);
  console.log('Total Promo Clicks logged:', clickCount);
  console.log('Clicks by Source:', clicksBySource);
  console.log('Saved Promos count:', savedPromosCount);
  console.log('Usage Events count:', usageEventsCount);
  console.log('Active Promos count:', activePromosCount);
  console.log('Total Commerces:', totalCommercesCount);
  console.log('Top clicked promo IDs:', topClickedPromos);
  console.log('Recent clicks sample:', recentClicks.map(c => ({
    source: c.source,
    createdAt: c.createdAt,
    url: c.url,
    promoId: c.promoId,
  })));
}

main().finally(() => prisma.$disconnect());
