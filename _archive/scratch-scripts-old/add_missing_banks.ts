import { prisma } from '../lib/prisma';

/**
 * Agrega los bancos faltantes a la DB.
 * Después de correr esto, hay que re-scrappear para que los
 * requirements queden vinculados correctamente.
 */
const MISSING_BANKS = [
  { name: 'Banco ICBC',        slug: 'icbc' },
  { name: 'Banco Credicoop',   slug: 'credicoop' },
  { name: 'Banco Columbia',    slug: 'columbia' },
  { name: 'Banco Comafi',      slug: 'comafi' },
  { name: 'Banco Hipotecario', slug: 'hipotecario' },
  { name: 'Banco Patagonia',   slug: 'patagonia' },
  { name: 'Banco Itaú',        slug: 'itau' },
  { name: 'Brubank',           slug: 'brubank' },
  { name: 'Naranja X',         slug: 'naranja-x' },
];

async function main() {
  console.log('Agregando bancos faltantes...\n');

  for (const bank of MISSING_BANKS) {
    const existing = await prisma.bank.findUnique({ where: { slug: bank.slug } });
    if (existing) {
      console.log(`  ⏭️  Ya existe: ${bank.name}`);
      continue;
    }
    await prisma.bank.create({ data: { ...bank, active: true } });
    console.log(`  ✅ Creado: ${bank.name}`);
  }

  console.log('\nBancos en DB ahora:');
  const all = await prisma.bank.findMany({ orderBy: { name: 'asc' }, select: { name: true, slug: true } });
  all.forEach(b => console.log(`  - ${b.name} (${b.slug})`));
  
  console.log('\n⚠️  Ahora debés correr el scraper de COTO para re-vincular los requirements.');
  console.log('   npx tsx run_scraper.ts');
}

main().catch(console.error).finally(() => process.exit(0));
