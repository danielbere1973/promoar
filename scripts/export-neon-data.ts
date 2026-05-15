// Exporta datos de Neon como SQL INSERTs para pegar en Supabase SQL Editor
// Corre con: npx ts-node scripts/export-neon-data.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const neon = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_3NnDXmfLcI8W@ep-fragrant-bird-am3uvyq5-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
    },
  },
});

function escape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (Array.isArray(val)) return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]::TEXT[]`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function toInsert(table: string, rows: any[]): string {
  if (!rows.length) return `-- ${table}: sin datos\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map(row => {
    const vals = cols.map(c => escape(row[c])).join(', ');
    return `(${vals})`;
  });
  return `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES\n${lines.join(',\n')}\nON CONFLICT DO NOTHING;\n`;
}

async function exportData() {
  const out = fs.createWriteStream('neon_data.sql', { encoding: 'utf8' });
  const log = (msg: string) => { console.log(msg); out.write(`-- ${msg}\n`); };

  out.write('-- Datos exportados de Neon\n-- Pegar en Supabase SQL Editor\n\n');

  log('categories');
  out.write(toInsert('categories', await neon.category.findMany()) + '\n');

  log('banks');
  out.write(toInsert('banks', await neon.bank.findMany()) + '\n');

  log('wallets');
  out.write(toInsert('wallets', await neon.wallet.findMany()) + '\n');

  log('card_networks');
  out.write(toInsert('card_networks', await neon.cardNetwork.findMany()) + '\n');

  log('card_segments');
  out.write(toInsert('card_segments', await neon.cardSegment.findMany()) + '\n');

  log('bank_segments');
  out.write(toInsert('bank_segments', await neon.bankSegment.findMany()) + '\n');

  // Relaciones banco-red (_BankToCardNetwork)
  log('_BankToCardNetwork');
  const banksWithNets = await neon.bank.findMany({ include: { cardNetworks: { select: { id: true } } } });
  const bnRows = banksWithNets.flatMap(b => b.cardNetworks.map(cn => ({ A: b.id, B: cn.id })));
  out.write(toInsert('_BankToCardNetwork', bnRows) + '\n');

  log('commerces');
  out.write(toInsert('commerces', await neon.commerce.findMany()) + '\n');

  // Promos en batches
  log('promos');
  const promoCount = await neon.promo.count();
  console.log(`  total: ${promoCount}`);
  const BATCH = 500;
  for (let skip = 0; skip < promoCount; skip += BATCH) {
    const batch = await neon.promo.findMany({ skip, take: BATCH });
    out.write(toInsert('promos', batch) + '\n');
    process.stdout.write(`\r  ${Math.min(skip + BATCH, promoCount)}/${promoCount}`);
  }
  console.log();

  // Requirements en batches
  log('promo_requirements');
  const reqCount = await neon.promoRequirement.count();
  console.log(`  total: ${reqCount}`);
  for (let skip = 0; skip < reqCount; skip += BATCH) {
    const batch = await neon.promoRequirement.findMany({ skip, take: BATCH });
    out.write(toInsert('promo_requirements', batch) + '\n');
    process.stdout.write(`\r  ${Math.min(skip + BATCH, reqCount)}/${reqCount}`);
  }
  console.log();

  log('users');
  out.write(toInsert('users', await neon.user.findMany()) + '\n');

  log('accounts');
  out.write(toInsert('accounts', await neon.account.findMany()) + '\n');

  log('financial_profiles');
  out.write(toInsert('financial_profiles', await neon.financialProfile.findMany()) + '\n');

  log('user_cards');
  out.write(toInsert('user_cards', await neon.userCard.findMany()) + '\n');

  log('saved_promos');
  out.write(toInsert('saved_promos', await neon.savedPromo.findMany()) + '\n');

  out.end();
  console.log('\n✅ Exportado a neon_data.sql');
  await neon.$disconnect();
}

exportData().catch(console.error);
