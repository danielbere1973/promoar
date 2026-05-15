// Arregla archivos SQL partidos en el medio de un INSERT
// Uso: node scripts/fix-sql-parts.js

const fs = require('fs');

const FILES = [
  'neon_data_part1.sql',
  'neon_data_part2.sql',
  'neon_data_part3.sql',
  'neon_data_part4.sql',
  'neon_data_part5.sql',
];

const TABLE_HEADERS = {
  promos: `INSERT INTO "promos" ("id", "title", "description", "uniqueUsePerPeriod", "maxUsesPerPeriod", "stackable", "stackableNote", "validFrom", "validUntil", "validDays", "validDaysNote", "validFromHour", "validToHour", "categoryId", "commerceId", "status", "sourceUrl", "sourceNote", "verifiedAt", "createdAt", "updatedAt", "sourceText", "specificDates", "provinces", "slug") VALUES`,
  promo_requirements: `INSERT INTO "promo_requirements" ("id", "promoId", "bankId", "walletId", "cardNetworkId", "cardType", "cardTier", "cardSegmentId", "note", "accountType", "paymentChannel", "cap", "capPeriod", "discountType", "discountValue", "minPurchase", "nxmM", "nxmN", "segment", "segmentId", "accountTypeId", "capTarget") VALUES`,
};

function getLastInsertTable(content) {
  const matches = [...content.matchAll(/INSERT INTO "([^"]+)"/g)];
  if (!matches.length) return null;
  return matches[matches.length - 1][1];
}

for (let i = 0; i < FILES.length; i++) {
  const file = FILES[i];
  if (!fs.existsSync(file)) {
    console.log(`${file}: no encontrado, salteando`);
    continue;
  }

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Eliminar BOM donde sea que esté (inicio absoluto del archivo)
  content = content.replace(/^﻿/, '');

  // Eliminar BOM que puede haber quedado en línea 2 (después del header agregado)
  content = content.replace(/\n﻿/, '\n');

  // Fix doble )) generado por versión buggy del script anterior
  content = content.replace(/\)\)\s*\nON CONFLICT DO NOTHING;/g, ')\nON CONFLICT DO NOTHING;');

  // Fix start: si el archivo empieza con ( sin INSERT header
  const trimmed = content.trimStart();
  if (trimmed.startsWith("('")) {
    if (i > 0 && fs.existsSync(FILES[i - 1])) {
      const prevContent = fs.readFileSync(FILES[i - 1], 'utf8');
      const tableName = getLastInsertTable(prevContent);
      if (tableName && TABLE_HEADERS[tableName]) {
        content = TABLE_HEADERS[tableName] + '\n' + content;
        console.log(`✅ ${file}: agregado header para tabla "${tableName}"`);
      } else {
        console.warn(`⚠️  ${file}: no se pudo determinar la tabla (última: ${tableName})`);
      }
    }
    modified = true;
  }

  // Fix end: si termina con ), cerrar el INSERT
  const lines = content.split('\n');
  let lastNonEmpty = lines.length - 1;
  while (lastNonEmpty >= 0 && lines[lastNonEmpty].trim() === '') lastNonEmpty--;

  if (lastNonEmpty >= 0 && lines[lastNonEmpty].trimEnd().endsWith('),')) {
    lines[lastNonEmpty] = lines[lastNonEmpty].trimEnd().slice(0, -1);
    lines.splice(lastNonEmpty + 1, 0, 'ON CONFLICT DO NOTHING;\n');
    content = lines.join('\n');
    modified = true;
    console.log(`✅ ${file}: cerrado INSERT al final`);
  }

  fs.writeFileSync(file, content, 'utf8');
  if (!modified) console.log(`${file}: sin cambios necesarios`);
}

console.log('\nListo! Ahora ejecutá los archivos en orden en pgAdmin.');
