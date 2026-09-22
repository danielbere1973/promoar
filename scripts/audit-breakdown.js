const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function breakdown() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    include: {
      requirements: {
        include: {
          bank: { select: { name: true } },
          wallet: { select: { name: true } }
        }
      },
      commerce: { select: { name: true } }
    }
  });

  const patterns = [
    /\b(productos?\s+seleccionados?|art[íi]culos?\s+seleccionados?|categor[íi]as?\s+seleccionadas?|marcas?\s+seleccionadas?|solo\s+en\s+combo|combos?\s+seleccionados?|solo\s+en\s+|en\s+l[íi]nea\s+de|sundae|cono|mcflurry|big\s+mac|cajita\s+feliz|cuarto\s+kilo|kilo\s+de\s+helado)\b/i,
    /\b(suscripci[oó]n|membres[íi]a|pedidos\s*ya\s*plus|pedidosya\+|abono\s+mensual)\b/i,
    /\b(\d{1,2}\s*(?:hs?|am|pm)?\s+a\s+\d{1,2}\s*(?:hs?|am|pm)?|\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2}|de\s+\d{1,2}\s+a\s+\d{1,2}\s*hs?)\b/i,
    /\b(ezeiza|aeropuerto|aeroparque|terminal\s+de\s+retiro|hacia\s+o\s+desde)\b/i,
    /\b(usuarios?\s+nuevos?|primer(?:a|)\s+compra|primer\s+viaje|primer\s+pedido|sin\s+viajes|clientes?\s+nuevos?|primera\s+vez)\b/i,
    /\b(sorpresa\s+santander|plan\s+sueldo|cuenta\s+sueldo|haberes|jubilad|pensionad|macro\s+selecta|galicia\s+eminent|santander\s+select)\b/i,
    /\b(c[oó]digo|cup[oó]n|promocode|voucher)\b/i,
    /\b(por\s+viaje|por\s+compra|por\s+transacci[oó]n|por\s+operaci[oó]n|hasta\s+\d+\s+viajes)\b/i
  ];

  const countByEntity = {};
  const totalByEntity = {};

  for (const p of promos) {
    const fullText = [
      p.title,
      p.description,
      p.sourceText,
      p.commerceNote,
      ...p.requirements.map(r => r.note || ''),
      ...p.requirements.map(r => r.segment || '')
    ].filter(Boolean).join(' ').toLowerCase();

    const entities = [
      ...p.requirements.map(r => r.bank?.name),
      ...p.requirements.map(r => r.wallet?.name)
    ].filter(Boolean);
    const entity = entities[0] || p.source || 'Sin entidad asignada';

    totalByEntity[entity] = (totalByEntity[entity] || 0) + 1;

    const hasVariantInTitle = /\([A-Za-z0-9\s\+\-\"]+\)/.test(p.title) && !/\(debito|\(credito|\(visa|\(master|\(amex|\(eminent|\(selecta/i.test(p.title);
    const matches = patterns.some(rgx => rgx.test(fullText)) || hasVariantInTitle || p.validFromHour != null;

    if (matches) {
      countByEntity[entity] = (countByEntity[entity] || 0) + 1;
    }
  }

  const sorted = Object.entries(countByEntity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log('TOP 15 ENTIDADES CON PROMOS CON CONDICIÓN RESTRINGIDA:');
  sorted.forEach(([ent, count]) => {
    const tot = totalByEntity[ent] || count;
    console.log(`- ${ent}: ${count} promos restringidas de ${tot} totales (${((count/tot)*100).toFixed(1)}%)`);
  });
}

breakdown().catch(console.error).finally(() => prisma.$disconnect());
