import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- LIMPIEZA Y RE-ENRIQUECIMIENTO DE ALCANCES Y RESTRICCIONES ---');

  // 1. Reset de horas espurias causadas por "de 2 a 6 cuotas", etc.
  const resetRes = await prisma.promo.updateMany({
    where: {
      validFromHour: { not: null },
    },
    data: {
      validFromHour: null,
      validToHour: null,
    },
  });
  console.log(`Horas reseteadas: ${resetRes.count}`);

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      description: true,
      sourceText: true,
      commerceNote: true,
      validFromHour: true,
      validToHour: true,
      commerce: { select: { name: true } },
    },
  });

  console.log(`Analizando ${promos.length} promos activas...`);
  let updatedCount = 0;

  for (const promo of promos) {
    const title = promo.title || '';
    const desc = promo.description || '';
    const source = promo.sourceText || '';
    const commerceName = promo.commerce.name;
    const combined = `${promo.commerceNote || ''} ${title} ${desc} ${source}`.toLowerCase();

    let newNote: string | null = promo.commerceNote;
    let newFromHour: number | null = null;
    let newToHour: number | null = null;
    let changed = false;

    // A. CABIFY
    if (/cabify/i.test(commerceName)) {
      const parts: string[] = [];

      if (/\bezeiza\b/i.test(combined)) {
        parts.push('Solo viajes hacia/desde Ezeiza');
      }

      if (/\b(?:de\s+)?7\s*(?:am)?\s*a\s*9\s*(?:am|hs)?\b/i.test(combined)) {
        newFromHour = 7;
        newToHour = 9;
        parts.push('De 7 a 9 hs');
      }

      const codeMatch = combined.match(/\bc[oó]digo\s+([A-Z0-9]{4,12})\b/i);
      if (codeMatch) {
        parts.push(`Código: ${codeMatch[1].toUpperCase()}`);
      }

      const ridesMatch = combined.match(/(\d+)\s+viajes/i);
      if (ridesMatch) {
        parts.push(`Hasta ${ridesMatch[1]} viajes`);
      }

      if (parts.length > 0) {
        newNote = parts.join(' · ');
        changed = true;
      }
    }

    // B. PEDIDOSYA (Plus / Suscripción)
    if (/pedidos\s*ya/i.test(commerceName) && /suscripci[oó]n|plus/i.test(combined)) {
      newNote = 'Solo válido para la suscripción PedidosYa Plus (no aplica a comida)';
      changed = true;
    }

    // C. VARIANTES DE PRODUCTOS (Personal Pay y comercios gastronómicos/retail)
    const parenMatch = title.match(/\(([^)]+)\)$/);
    if (parenMatch) {
      const rawVariant = parenMatch[1].trim();
      const isIgnoredVariant = /^(debito|credito|visa|master|mastercard|amex|selecta|eminent|plus|singular|general)$/i.test(rawVariant);
      const isFullStore = /total\s+de\s+la\s+(?:compra|cuenta)/i.test(rawVariant);
      if (!isIgnoredVariant && !isFullStore && rawVariant.length > 2) {
        newNote = `Solo en: ${rawVariant}`;
        changed = true;
      }
    }

    // D. FRANJA HORARIA REAL (requiere 'hs' o 'horas', no cuotas)
    if (newFromHour == null && !/cuotas/i.test(combined)) {
      const hourMatch = combined.match(/\bde\s+([012]?\d)(?::[0-5]\d)?\s*(?:hs|horas|am|pm)?\s+a\s+([012]?\d)(?::[0-5]\d)?\s*(?:hs|horas|am|pm)\b/i)
        || combined.match(/\b([012]?\d)\s*a\s*([012]?\d)\s*(?:hs|horas)\b/i);
      if (hourMatch) {
        const fromH = parseInt(hourMatch[1]);
        const toH = parseInt(hourMatch[2]);
        if (fromH <= 24 && toH <= 24 && fromH !== toH) {
          newFromHour = fromH;
          newToHour = toH;
          changed = true;
        }
      }
    }

    if (changed) {
      await prisma.promo.update({
        where: { id: promo.id },
        data: {
          commerceNote: newNote,
          validFromHour: newFromHour,
          validToHour: newToHour,
        },
      });
      updatedCount++;
      if (updatedCount <= 30 || /cabify|pedidos\s*ya|mostaza|kfc/i.test(commerceName)) {
        console.log(`[ENRICHED] ${commerceName} -> note: "${newNote}" | hours: ${newFromHour}-${newToHour}`);
      }
    }
  }

  console.log(`\nProceso completado. Total promos enriquecidas con precisión: ${updatedCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
