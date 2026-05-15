const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function extractCardNetwork(text) {
  let t = text.toUpperCase();
  t = t.replace(/(?:NO\s+APLICA|NI\s+PARA|EXCLUYE|NO\s+V[AÁ]LIDO)[^.]{0,100}?(?:AMERICAN\s+EXPRESS|AMEX|VISA|MASTERCARD|CABAL|MAESTRO)/gi, '');

  if (/TODOS\s+LOS\s+MEDIOS\s+DE\s+PAGO/.test(t)) return null;
  if (/MASTERCARD/.test(t) && /\bVISA\b/.test(t)) return null; 
  if (/MASTERCARD/.test(t)) return 'MASTERCARD';
  if (/\bVISA\b/.test(t)) return 'VISA';
  if (/\bCABAL\b/.test(t)) return 'CABAL';
  if (/AMERICAN\s+EXPRESS|\bAMEX\b/.test(t)) return 'AMERICAN EXPRESS';
  if (/\bMAESTRO\b/.test(t)) return 'MAESTRO';
  return null;
}

async function main() {
  const amexReqs = await prisma.promoRequirement.findMany({
    where: { 
      cardNetwork: { name: { contains: 'american', mode: 'insensitive' } }
    },
    include: { promo: { select: { title: true, sourceText: true } } }
  });

  let updated = 0;
  for (const r of amexReqs) {
    if (!r.promo.sourceText) continue;
    const combinedText = r.promo.title + ' ' + r.promo.sourceText;
    const correctedNetworkName = extractCardNetwork(combinedText);
    
    // Si la corrección da nulo u otra red, entonces borramos o actualizamos el requirement
    if (correctedNetworkName === null || correctedNetworkName !== 'AMERICAN EXPRESS') {
      console.log(`Corrigiendo AMEX falso en: ${r.promo.title} -> Red real deducida: ${correctedNetworkName || 'Ninguna'}`);
      
      if (correctedNetworkName === null) {
         // Eliminamos el cardNetworkId de este entry
         await prisma.promoRequirement.update({
           where: { id: r.id },
           data: { cardNetworkId: null }
         });
      } else {
         // Buscar el ID de la nueva red 
         const netObj = await prisma.cardNetwork.findFirst({ where: { name: { contains: correctedNetworkName, mode: 'insensitive' } } });
         if (netObj) {
           await prisma.promoRequirement.update({
             where: { id: r.id },
             data: { cardNetworkId: netObj.id }
           });
         } else {
           await prisma.promoRequirement.update({
             where: { id: r.id },
             data: { cardNetworkId: null }
           });
         }
      }
      updated++;
    }
  }
  console.log(`Total requerimientos AMEX purgados: ${updated}`);
}

main().finally(() => prisma.$disconnect());
