const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv[2] !== '--execute';

// Artículos y preposiciones que van en minúscula (salvo que sea la primera palabra)
const LOWER_WORDS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'con',
  'a', 'al', 'por', 'sin', 'sobre', 'un', 'una',
  'of', 'the', 'and',
]);

// Acrónimos que se mantienen en mayúsculas
const ACRONYMS = new Set([
  'BBVA', 'ICBC', 'BACS', 'GPAT', 'FCA', 'PSA', 'RCI', 'BNP',
  'YOY', 'CMF', 'BICA', 'JPMorgan',
]);

// Correcciones de palabras con tildes u ortografía especial
const WORD_FIX = {
  'anonima':      'Anónima',
  'anónima':      'Anónima',
  'compañia':     'Compañía',
  'republica':    'República',
  'inversion':    'Inversión',
  'credito':      'Crédito',
  'crédito':      'Crédito',
  'tucuman':      'Tucumán',
  'neuquen':      'Neuquén',
  'cordoba':      'Córdoba',
  'sucredito':    'Sucrédito',
  'jpmorgan':     'JPMorgan',
  'mercedes-benz':'Mercedes-Benz',
};

function titleCaseBank(name) {
  // Normalizar sufijos legales antes de tokenizar
  let s = name
    .replace(/\bS\.\s*A\.\s*U\.?/gi, '__SAU__')
    .replace(/\bS\.\s*A\.?/gi,       '__SA__')
    .replace(/\bN\.\s*A\.?/gi,       '__NA__')
    .replace(/\bS\.\s*R\.\s*L\.?/gi, '__SRL__')
    .replace(/\bSAU\b/gi,            '__SAU__')
    .replace(/\bSA\b/gi,             '__SA__');

  const tokens = s.split(/\s+/);

  const result = tokens.map((token, i) => {
    if (token === '__SAU__') return 'S.A.U.';
    if (token === '__SA__')  return 'S.A.';
    if (token === '__NA__')  return 'N.A.';
    if (token === '__SRL__') return 'S.R.L.';

    // Quitar puntuación final para comparar
    const clean = token.replace(/[,.]$/, '');
    const suffix = token.slice(clean.length);

    if (ACRONYMS.has(clean)) return clean + suffix;

    const lower = clean.toLowerCase();

    // Correcciones especiales
    if (WORD_FIX[lower]) return WORD_FIX[lower] + suffix;

    // Artículos en minúscula (salvo primera palabra)
    if (i > 0 && LOWER_WORDS.has(lower)) return lower + suffix;

    // Title case normal
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() + suffix;
  });

  return result.join(' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const banks = await prisma.bank.findMany({ orderBy: { name: 'asc' } });

  const changes = banks
    .map(b => ({ id: b.id, old: b.name, new: titleCaseBank(b.name) }))
    .filter(b => b.old !== b.new);

  if (changes.length === 0) {
    console.log('✅ Todos los bancos ya tienen el formato correcto.');
    return;
  }

  console.log(DRY_RUN
    ? `🟡 DRY RUN — ${changes.length} bancos a renombrar:\n`
    : `🔴 EJECUTANDO — renombrando ${changes.length} bancos:\n`
  );

  for (const c of changes) {
    console.log(`  "${c.old}"`);
    console.log(`  → "${c.new}"\n`);

    if (!DRY_RUN) {
      await prisma.bank.update({ where: { id: c.id }, data: { name: c.new } });
    }
  }

  if (!DRY_RUN) console.log('✅ Renombrado completado.');
  else console.log('👆 Ejecutá con --execute para aplicar los cambios.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
