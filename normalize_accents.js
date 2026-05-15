const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv[2] !== '--execute';

// Quita tildes/diacríticos: á→a, é→e, í→i, ó→o, ú→u, ü→u, ñ→n, etc.
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function main() {
  console.log(DRY_RUN
    ? '🟡 DRY RUN — ejecutá con --execute para aplicar\n'
    : '🔴 EJECUTANDO — actualizando registros\n'
  );

  // ─── BANCOS ───────────────────────────────────────────────────
  const banks = await prisma.bank.findMany({ orderBy: { name: 'asc' } });
  let bankChanges = 0;

  console.log('═══ BANCOS ═══');
  for (const bank of banks) {
    const normalized = removeAccents(bank.name);
    if (normalized !== bank.name) {
      console.log(`  "${bank.name}"  →  "${normalized}"`);
      if (!DRY_RUN) {
        await prisma.bank.update({
          where: { id: bank.id },
          data: { name: normalized },
        });
      }
      bankChanges++;
    }
  }
  if (bankChanges === 0) console.log('  (ningún cambio)');

  // ─── SEGMENTOS ────────────────────────────────────────────────
  const segments = await prisma.bankSegment.findMany({
    orderBy: [{ bankId: 'asc' }, { name: 'asc' }],
    include: { bank: { select: { name: true } } },
  });
  let segChanges = 0;

  console.log('\n═══ SEGMENTOS ═══');
  for (const seg of segments) {
    const normalized = removeAccents(seg.name);
    if (normalized !== seg.name) {
      console.log(`  [${seg.bank.name}]  "${seg.name}"  →  "${normalized}"`);
      if (!DRY_RUN) {
        await prisma.bankSegment.update({
          where: { id: seg.id },
          data: { name: normalized },
        });
      }
      segChanges++;
    }
  }
  if (segChanges === 0) console.log('  (ningún cambio)');

  // ─── RESUMEN ──────────────────────────────────────────────────
  console.log('\n═══ RESUMEN ═══');
  console.log(`Bancos modificados   : ${bankChanges}`);
  console.log(`Segmentos modificados: ${segChanges}`);
  if (DRY_RUN) console.log('\n👆 Ejecutá con --execute para aplicar los cambios.');
  else console.log('\n✅ Cambios aplicados en la base de datos.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
