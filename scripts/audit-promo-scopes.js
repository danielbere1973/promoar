const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAudit() {
  console.log('--- INICIANDO AUDITORÍA GLOBAL DE PROMOS ACTIVAS ---');
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    include: {
      requirements: {
        include: {
          bank: { select: { name: true } },
          wallet: { select: { name: true } }
        }
      },
      commerce: { select: { name: true } },
      category: { select: { name: true } }
    }
  });

  const total = promos.length;
  console.log(`Total promos activas en la base: ${total}`);

  // Categorías de restricciones
  const stats = {
    total,
    specificProductOrSelection: [],
    subscriptionOrMembership: [],
    timeWindow: [],
    specificTripOrDestination: [],
    newUsersOnly: [],
    exclusiveProgramOrSegment: [],
    requiredCouponOrCode: [],
    perTransactionCapOrLimit: [],
  };

  const bySourceOrBank = {};

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
    const entityKey = entities[0] || p.source || 'Sin Entidad';
    bySourceOrBank[entityKey] = (bySourceOrBank[entityKey] || 0) + 1;

    let flagged = false;

    // 1. Producto o Selección específica (no aplica a toda la compra)
    const productRegex = /\b(productos?\s+seleccionados?|art[íi]culos?\s+seleccionados?|categor[íi]as?\s+seleccionadas?|marcas?\s+seleccionadas?|solo\s+en\s+combo|combos?\s+seleccionados?|solo\s+en\s+|en\s+l[íi]nea\s+de|solo\s+para\s+|exclusivo\s+en\s+el\s+producto|sundae|cono|mcflurry|big\s+mac|cajita\s+feliz|cuarto\s+kilo|kilo\s+de\s+helado)\b/i;
    // O si tiene paréntesis con nombre de producto en el título (ej: Mostaza (Sundae...))
    const hasVariantInTitle = /\([A-Za-z0-9\s\+\-\"]+\)/.test(p.title) && !/\(debito|\(credito|\(visa|\(master|\(amex|\(eminent|\(selecta/i.test(p.title);
    if (productRegex.test(fullText) || hasVariantInTitle) {
      stats.specificProductOrSelection.push(p);
      flagged = true;
    }

    // 2. Suscripción o Membresía
    const subRegex = /\b(suscripci[oó]n|membres[íi]a|pedidos\s*ya\s*plus|pedidosya\+|abono\s+mensual)\b/i;
    if (subRegex.test(fullText)) {
      stats.subscriptionOrMembership.push(p);
      flagged = true;
    }

    // 3. Franja horaria específica
    const timeRegex = /\b(\d{1,2}\s*(?:hs?|am|pm)?\s+a\s+\d{1,2}\s*(?:hs?|am|pm)?|\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2}|de\s+\d{1,2}\s+a\s+\d{1,2}\s*hs?)\b/i;
    if (timeRegex.test(fullText) || p.validFromHour != null) {
      stats.timeWindow.push(p);
      flagged = true;
    }

    // 4. Viaje específico / Destino (Ezeiza, aeropuertos, etc.)
    const tripRegex = /\b(ezeiza|aeropuerto|aeroparque|terminal\s+de\s+retiro|hacia\s+o\s+desde)\b/i;
    if (tripRegex.test(fullText)) {
      stats.specificTripOrDestination.push(p);
      flagged = true;
    }

    // 5. Solo usuarios nuevos / primera compra
    const newUserRegex = /\b(usuarios?\s+nuevos?|primer(?:a|)\s+compra|primer\s+viaje|primer\s+pedido|sin\s+viajes|clientes?\s+nuevos?|primera\s+vez)\b/i;
    if (newUserRegex.test(fullText)) {
      stats.newUsersOnly.push(p);
      flagged = true;
    }

    // 6. Programa exclusivo / fidelidad (Sorpresa Santander, etc.)
    const programRegex = /\b(sorpresa\s+santander|plan\s+sueldo|cuenta\s+sueldo|haberes|jubilad|pensionad|macro\s+selecta|galicia\s+eminent|santander\s+select)\b/i;
    if (programRegex.test(fullText)) {
      stats.exclusiveProgramOrSegment.push(p);
      flagged = true;
    }

    // 7. Cupón o código obligatorio
    const couponRegex = /\b(c[oó]digo|cup[oó]n|promocode|voucher)\b/i;
    if (couponRegex.test(fullText)) {
      stats.requiredCouponOrCode.push(p);
      flagged = true;
    }

    // 8. Tope por viaje / por transacción
    const perTxRegex = /\b(por\s+viaje|por\s+compra|por\s+transacci[oó]n|por\s+operaci[oó]n|hasta\s+\d+\s+viajes)\b/i;
    if (perTxRegex.test(fullText)) {
      stats.perTransactionCapOrLimit.push(p);
      flagged = true;
    }
  }

  // Deduplicar promos que tienen al menos 1 condición crítica
  const allFlaggedIds = new Set([
    ...stats.specificProductOrSelection.map(p => p.id),
    ...stats.subscriptionOrMembership.map(p => p.id),
    ...stats.timeWindow.map(p => p.id),
    ...stats.specificTripOrDestination.map(p => p.id),
    ...stats.newUsersOnly.map(p => p.id),
    ...stats.exclusiveProgramOrSegment.map(p => p.id),
    ...stats.requiredCouponOrCode.map(p => p.id),
    ...stats.perTransactionCapOrLimit.map(p => p.id),
  ]);

  console.log('\n================ RESULTADOS DEL CENSO ================');
  console.log(`TOTAL PROMOS ACTIVAS: ${total}`);
  console.log(`PROMOS CON CONDICIÓN CRÍTICA: ${allFlaggedIds.size} (${((allFlaggedIds.size / total) * 100).toFixed(1)}% del total)`);
  console.log('------------------------------------------------------');
  console.log(`1. Productos / Combos / Selección específica: ${stats.specificProductOrSelection.length}`);
  console.log(`2. Suscripciones / Membresías:                ${stats.subscriptionOrMembership.length}`);
  console.log(`3. Franja horaria restringida:                ${stats.timeWindow.length}`);
  console.log(`4. Destino / Viaje puntual (Ezeiza, etc.):   ${stats.specificTripOrDestination.length}`);
  console.log(`5. Solo usuarios nuevos / primer pedido:      ${stats.newUsersOnly.length}`);
  console.log(`6. Programa exclusivo / Plan Sueldo / Club:   ${stats.exclusiveProgramOrSegment.length}`);
  console.log(`7. Requiere código o cupón:                   ${stats.requiredCouponOrCode.length}`);
  console.log(`8. Tope por viaje / por transacción:          ${stats.perTransactionCapOrLimit.length}`);
  console.log('------------------------------------------------------');

  // Muestra de ejemplos representativos por cada tipo
  console.log('\n--- EJEMPLOS REALES DETECTADOS EN LA DB ---');
  
  console.log('\n[PRODUCTOS SELECCIONADOS / COMBOS]:');
  stats.specificProductOrSelection.slice(0, 5).forEach(p => {
    console.log(`- ${p.commerce.name} | ${p.title} | Req: ${p.requirements.map(r => r.bank?.name || r.wallet?.name).join(', ')}`);
  });

  console.log('\n[SUSCRIPCIONES]:');
  stats.subscriptionOrMembership.slice(0, 5).forEach(p => {
    console.log(`- ${p.commerce.name} | ${p.title} | Req: ${p.requirements.map(r => r.bank?.name || r.wallet?.name).join(', ')}`);
  });

  console.log('\n[FRANJA HORARIA]:');
  stats.timeWindow.slice(0, 5).forEach(p => {
    console.log(`- ${p.commerce.name} | ${p.title} | Req: ${p.requirements.map(r => r.bank?.name || r.wallet?.name).join(', ')}`);
  });

  console.log('\n[USUARIOS NUEVOS / PRIMER VIAJE]:');
  stats.newUsersOnly.slice(0, 5).forEach(p => {
    console.log(`- ${p.commerce.name} | ${p.title} | Req: ${p.requirements.map(r => r.bank?.name || r.wallet?.name).join(', ')}`);
  });

  console.log('\n[PROGRAMA EXCLUSIVO (SORPRESA, SUELDO, ETC.)]:');
  stats.exclusiveProgramOrSegment.slice(0, 5).forEach(p => {
    console.log(`- ${p.commerce.name} | ${p.title} | Req: ${p.requirements.map(r => r.bank?.name || r.wallet?.name).join(', ')}`);
  });

  console.log('\n[POR VIAJE / POR COMPRA]:');
  stats.perTransactionCapOrLimit.slice(0, 5).forEach(p => {
    console.log(`- ${p.commerce.name} | ${p.title} | Req: ${p.requirements.map(r => r.bank?.name || r.wallet?.name).join(', ')}`);
  });
}

runAudit().catch(console.error).finally(() => prisma.$disconnect());
