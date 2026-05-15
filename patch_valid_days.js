const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function extractValidDays(text) {
  let t = text.toLowerCase();
  
  // Limpieza de avisos legales de horarios de envío
  t = t.replace(/de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?(?: y de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?)?,? de lunes a sábados?\.?/gi, '');

  const DAY_TO_BIT = {
    'domingo': 0, 'lunes': 1, 'martes': 2,
    'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5,
    'sábado': 6, 'sabado': 6,
  };

  const rangeMatch = t.match(
    /(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(?:a|hasta)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i
  );
  if (rangeMatch) {
    const startIdx = DAY_TO_BIT[rangeMatch[1]];
    const endIdx = DAY_TO_BIT[rangeMatch[2]];
    let mask = 0;
    if (startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) mask |= 1 << i;
    } else {
      for (let i = startIdx; i <= 6; i++) mask |= 1 << i;
      for (let i = 0; i <= endIdx; i++) mask |= 1 << i;
    }
    return mask;
  }

  let mask = 0;
  if (t.includes('domingo'))                            mask |= 1 << 0;
  if (t.includes('lunes'))                              mask |= 1 << 1;
  if (t.includes('martes'))                             mask |= 1 << 2;
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= 1 << 3;
  if (t.includes('jueves'))                             mask |= 1 << 4;
  if (t.includes('viernes'))                            mask |= 1 << 5;
  if (t.includes('sábado') || t.includes('sabado'))    mask |= 1 << 6;
  if (t.includes('fin de semana'))                      mask |= (1 << 6) | (1 << 0);

  if (mask > 0) return mask;

  if (
    t.includes('todos los días') ||
    t.includes('todos los dias') ||
    t.includes('de lunes a sábado') ||
    t.includes('de lunes a sabado') ||
    t.includes('de lunes a domingo')
  ) return 127;

  return 127;
}

async function main() {
  const promos = await prisma.promo.findMany({ select: { id: true, title: true, sourceText: true, validDays: true } });
  let updated = 0;
  for (const p of promos) {
    if (!p.sourceText) continue;
    const combinedText = p.title + ' ' + p.sourceText;
    const newMask = extractValidDays(combinedText);
    if (newMask !== p.validDays) {
      console.log(`Actualizando '${p.title}' de ${p.validDays} a ${newMask}`);
      await prisma.promo.update({
        where: { id: p.id },
        data: { validDays: newMask }
      });
      updated++;
    }
  }
  console.log(`Total actualizadas: ${updated}`);
}

main().finally(() => prisma.$disconnect());
