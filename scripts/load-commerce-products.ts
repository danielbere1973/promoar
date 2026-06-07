// Carga CommerceProduct a partir de unicenter-catalogo.csv, filtrando por el mapeo
// de marcas aprobado en commerce-mapping-approved.csv (ver CLAUDE.md punto 8).
import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const CATALOGO = path.join(process.cwd(), 'unicenter-catalogo.csv');
const MAPEO = path.join(process.cwd(), 'commerce-mapping-approved.csv');

function parseCsvLine(line: string, sep = ','): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === sep && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function readCSV(file: string, sep = ','): Record<string, string>[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const headers = parseCsvLine(lines[0], sep).map(h => h.replace(/\r$/, ''));
  return lines.slice(1).map(l => {
    const vals = parseCsvLine(l, sep).map(v => v.replace(/\r$/, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

async function main() {
  const mapeo = readCSV(MAPEO);
  const marcaToCommerceId = new Map<string, string>();
  for (const m of mapeo) marcaToCommerceId.set(m.marca, m.commerceId);

  const catalogo = readCSV(CATALOGO);
  const toInsert = catalogo
    .filter(r => r.categoria.trim() && marcaToCommerceId.has(r.marca))
    .map(r => ({
      commerceId: marcaToCommerceId.get(r.marca)!,
      categoria: r.categoria.trim(),
      subcategoria: r.subcategoria.trim() || null,
      productos: r.productos_ejemplo.trim() || null,
      source: 'unicenter',
    }));

  console.log(`Filas a insertar: ${toInsert.length} (de ${catalogo.length} totales en el catálogo)`);
  console.log(`Comercios cubiertos: ${new Set(toInsert.map(r => r.commerceId)).size}`);

  // Limpiar carga previa de la misma fuente antes de recargar
  const deleted = await prisma.commerceProduct.deleteMany({ where: { source: 'unicenter' } });
  console.log(`Filas previas eliminadas (source=unicenter): ${deleted.count}`);

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const r = await prisma.commerceProduct.createMany({ data: batch });
    inserted += r.count;
    process.stdout.write(`\r  Insertados: ${inserted}/${toInsert.length}`);
  }
  console.log(`\n\nListo. Total insertado: ${inserted}`);

  await prisma.$disconnect();
}
main().catch(console.error);
