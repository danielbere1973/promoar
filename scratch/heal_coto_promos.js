const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- Logic Helpers (Cloned from coto.ts refined logic) ---

function extractProvinces(text) {
  const t = text.toUpperCase();
  if (t.includes('TODA LA REPÚBLICA ARGENTINA') || t.includes('TODAS LAS SUCURSALES') || t.includes('ÁMBITO NACIONAL')) return ['Todas'];
  const allProvinces = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
  const found = allProvinces.filter(p => {
    const norm = p.toUpperCase().replace(/[Á]/g, 'A').replace(/[É]/g, 'E').replace(/[Í]/g, 'I').replace(/[Ó]/g, 'O').replace(/[Ú]/g, 'U');
    return t.includes(norm);
  });
  return found.length > 0 ? found : ['Todas'];
}

function extractValidDays(text) {
  const t = text.toLowerCase();
  const DAY_TO_BIT = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6 };
  const rangeMatch = t.match(/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(?:a|hasta)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i);
  if (rangeMatch) {
    const startIdx = DAY_TO_BIT[rangeMatch[1]];
    const endIdx = DAY_TO_BIT[rangeMatch[2]];
    let mask = 0;
    if (startIdx <= endIdx) { for (let i = startIdx; i <= endIdx; i++) mask |= (1 << i); }
    else { for (let i = startIdx; i <= 6; i++) mask |= (1 << i); for (let i = 0; i <= endIdx; i++) mask |= (1 << i); }
    return mask;
  }
  let mask = 0;
  if (t.includes('domingo')) mask |= (1 << 0);
  if (t.includes('lunes')) mask |= (1 << 1);
  if (t.includes('martes')) mask |= (1 << 2);
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= (1 << 3);
  if (t.includes('jueves')) mask |= (1 << 4);
  if (t.includes('viernes')) mask |= (1 << 5);
  if (t.includes('sábado') || t.includes('sabado')) mask |= (1 << 6);
  if (t.includes('fin de semana')) mask |= (1 << 6) | (1 << 0);
  if (mask > 0) return mask;
  if (t.includes('jubilad') || t.includes('pensionad')) return 16;
  if (t.includes('todos los días') || t.includes('todos los dias')) return 127;
  return 127;
}

function extractDates(text) {
  const numericRangeMatch = text.match(/(?:V[AÁ]LIDO|VIGENCIA|DEL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (numericRangeMatch) {
    const parseNumeric = (s) => {
      const parts = s.split('/');
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    };
    return { validFrom: parseNumeric(numericRangeMatch[1]), validUntil: parseNumeric(numericRangeMatch[2]) };
  }
  return {};
}

function shouldClearRestrictions(text) {
  return text.toUpperCase().includes('TODOS LOS MEDIOS DE PAGO');
}

// --- Main script ---

async function main() {
  console.log('🚀 Iniciando Curación Global de Coto...');
  
  const promos = await prisma.promo.findMany({
    where: { commerce: { name: 'Coto' } },
    include: { requirements: true }
  });

  const walletMapping = {
    'MERCADO PAGO': 'cmnulzfz80009qlkkuyavwcvh',
    'MODO': 'cmnulzh04000aqlkk8mnpzo46',
    'PERSONAL PAY': 'cmnulziao000cqlkkamv57ia0',
  };

  let updatedCount = 0;
  
  for (const promo of promos) {
    const text = (promo.title + ' ' + promo.sourceText + ' ' + promo.description).toUpperCase();
    const updates = {};
    
    // 1. Provincias
    const provinces = extractProvinces(text);
    if (JSON.stringify(provinces) !== JSON.stringify(promo.provinces)) {
      updates.provinces = provinces;
    }

    // 2. Días de vigencia
    const validDays = extractValidDays(text);
    if (validDays !== promo.validDays) {
      updates.validDays = validDays;
    }

    // 3. Fechas numéricas
    const { validFrom, validUntil } = extractDates(text);
    if (validUntil && (!promo.validUntil || new Date(validUntil).getTime() !== new Date(promo.validUntil).getTime())) {
      updates.validUntil = new Date(validUntil + 'T23:59:59-03:00');
    }
    if (validFrom && (!promo.validFrom || new Date(validFrom).getTime() !== new Date(promo.validFrom).getTime())) {
       updates.validFrom = new Date(validFrom + 'T00:00:00-03:00');
    }

    if (Object.keys(updates).length > 0) {
      await prisma.promo.update({ where: { id: promo.id }, data: updates });
    }

    // 4. Requerimientos (Tarjetas y Billeteras)
    const clearRestr = shouldClearRestrictions(text);
    
    for (const req of promo.requirements) {
      const reqUpdates = {};
      if (clearRestr) {
        if (req.cardNetworkId) reqUpdates.cardNetworkId = null;
        if (req.cardType) reqUpdates.cardType = null;
      }
      
      // Detectar billetera si el req no la tiene
      if (!req.walletId) {
        for (const [key, id] of Object.entries(walletMapping)) {
          if (text.includes(key)) {
            reqUpdates.walletId = id;
            reqUpdates.bankId = null; // Prioridad billetera
            break;
          }
        }
      }

      if (Object.keys(reqUpdates).length > 0) {
        await prisma.promoRequirement.update({ where: { id: req.id }, data: reqUpdates });
      }
    }
    
    updatedCount++;
    console.log(`✅ Procesada: ${promo.title}`);
  }

  console.log(`\n🎉 Finalizado. Se procesaron ${updatedCount} promociones.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
