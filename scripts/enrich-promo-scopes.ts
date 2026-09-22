import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- ENRIQUECIENDO PROMOS ACTIVAS CON ALCANCES Y RESTRICCIONES ---');

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
      requirements: { select: { segment: true, note: true } },
    },
  });

  console.log(`Total promos activas examinadas: ${promos.length}`);
  let updatedCount = 0;

  for (const promo of promos) {
    const title = promo.title || '';
    const desc = promo.description || '';
    const source = promo.sourceText || '';
    const commerceName = promo.commerce.name;
    const combined = `${promo.commerceNote || ''} ${title} ${desc} ${source}`.toLowerCase();

    let newNote: string | null = promo.commerceNote;
    let newFromHour: number | null = promo.validFromHour;
    let newToHour: number | null = promo.validToHour;
    let changed = false;

    // 1. Cabify
    if (/cabify/i.test(commerceName)) {
      if (/\bezeiza\b/i.test(combined) && !newNote) {
        newNote = 'Solo viajes hacia/desde Ezeiza';
        changed = true;
      }
      const timeMatch = combined.match(/\bde\s+(\d{1,2})\s*(?:hs?|am)?\s+a\s+(\d{1,2})\s*(?:hs?|am)?\b/i) || combined.match(/\b(\d{1,2})\s*a\s*(\d{1,2})\s*hs\b/i);
      if (timeMatch && (newFromHour == null || newToHour == null)) {
        newFromHour = parseInt(timeMatch[1]);
        newToHour = parseInt(timeMatch[2]);
        if (!newNote || !newNote.includes('hs')) {
          newNote = newNote ? `${newNote} · De ${newFromHour} a ${newToHour} hs` : `De ${newFromHour} a ${newToHour} hs`;
        }
        changed = true;
      } else if (/7\s*(?:am)?\s*a\s*9\s*(?:am)?/i.test(combined) && (newFromHour == null || newToHour == null)) {
        newFromHour = 7;
        newToHour = 9;
        if (!newNote || !newNote.includes('7 a 9')) {
          newNote = newNote ? `${newNote} · De 7 a 9 hs` : 'De 7 a 9 hs';
        }
        changed = true;
      }
      if (/(\d+)\s+viajes/i.test(combined) && (!newNote || !newNote.includes('viajes'))) {
        const m = combined.match(/(\d+)\s+viajes/i);
        const extra = `Hasta ${m![1]} viajes`;
        newNote = newNote ? `${newNote} · ${extra}` : extra;
        changed = true;
      }
    }

    // 2. PedidosYa (Plus / Suscripción)
    if (/pedidos\s*ya/i.test(commerceName) && /suscripci[oó]n|plus/i.test(combined) && !newNote) {
      newNote = 'Solo válido para la suscripción PedidosYa Plus (no aplica a pedidos de comida)';
      changed = true;
    }

    // 3. Variantes de producto entre paréntesis en el título (Mostaza, KFC, etc.)
    if (!newNote) {
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
    }

    // 4. Franja horaria general no detectada previamente
    if (newFromHour == null && newToHour == null) {
      const hourMatch = combined.match(/\bde\s+(\d{1,2})\s*(?:hs?|am)?\s+a\s+(\d{1,2})\s*(?:hs?|am)?\b/i);
      if (hourMatch) {
        newFromHour = parseInt(hourMatch[1]);
        newToHour = parseInt(hourMatch[2]);
        changed = true;
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
      console.log(`[UPDATED] ${commerceName} - "${title}" -> note: "${newNote}" | hours: ${newFromHour}-${newToHour}`);
    }
  }

  console.log(`\nPromos enriquecidas con éxito: ${updatedCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
