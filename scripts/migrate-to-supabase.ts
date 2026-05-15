// Script de migración Neon → Supabase
// Corre con: npx ts-node scripts/migrate-to-supabase.ts

import { PrismaClient } from '@prisma/client';

const neon = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_3NnDXmfLcI8W@ep-fragrant-bird-am3uvyq5-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
    },
  },
});

const supabase = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Ethabhaec0k3@db.hsaieohgmsbzrwobvzyt.supabase.co:5432/postgres',
    },
  },
});

async function migrate() {
  console.log('Iniciando migración Neon → Supabase...\n');

  try {
    // 1. Categorías
    console.log('→ categories...');
    const categories = await neon.category.findMany();
    if (categories.length) {
      await supabase.category.createMany({ data: categories, skipDuplicates: true });
    }
    console.log(`   ${categories.length} filas`);

    // 2. Bancos
    console.log('→ banks...');
    const banks = await neon.bank.findMany();
    if (banks.length) {
      await supabase.bank.createMany({ data: banks, skipDuplicates: true });
    }
    console.log(`   ${banks.length} filas`);

    // 3. Wallets
    console.log('→ wallets...');
    const wallets = await neon.wallet.findMany();
    if (wallets.length) {
      await supabase.wallet.createMany({ data: wallets, skipDuplicates: true });
    }
    console.log(`   ${wallets.length} filas`);

    // 4. CardNetworks
    console.log('→ cardNetworks...');
    const cardNetworks = await neon.cardNetwork.findMany();
    if (cardNetworks.length) {
      await supabase.cardNetwork.createMany({ data: cardNetworks, skipDuplicates: true });
    }
    console.log(`   ${cardNetworks.length} filas`);

    // 5. CardSegments
    console.log('→ cardSegments...');
    const cardSegments = await neon.cardSegment.findMany();
    if (cardSegments.length) {
      await supabase.cardSegment.createMany({ data: cardSegments, skipDuplicates: true });
    }
    console.log(`   ${cardSegments.length} filas`);

    // 6. BankSegments
    console.log('→ bankSegments...');
    const bankSegments = await neon.bankSegment.findMany();
    if (bankSegments.length) {
      await supabase.bankSegment.createMany({ data: bankSegments, skipDuplicates: true });
    }
    console.log(`   ${bankSegments.length} filas`);

    // 7. Relaciones banco-cardNetwork (_BankToCardNetwork)
    console.log('→ bank-cardNetwork relations...');
    const banksWithNetworks = await neon.bank.findMany({ include: { cardNetworks: true } });
    for (const bank of banksWithNetworks) {
      if (bank.cardNetworks.length) {
        await supabase.bank.update({
          where: { id: bank.id },
          data: { cardNetworks: { connect: bank.cardNetworks.map(cn => ({ id: cn.id })) } },
        });
      }
    }
    console.log('   OK');

    // 8. Commerces
    console.log('→ commerces...');
    const commerces = await neon.commerce.findMany();
    if (commerces.length) {
      await supabase.commerce.createMany({ data: commerces, skipDuplicates: true });
    }
    console.log(`   ${commerces.length} filas`);

    // 9. Promos (en batches de 200)
    console.log('→ promos...');
    const promoCount = await neon.promo.count();
    const BATCH = 200;
    let migrated = 0;
    for (let skip = 0; skip < promoCount; skip += BATCH) {
      const promos = await neon.promo.findMany({ skip, take: BATCH });
      if (promos.length) {
        await supabase.promo.createMany({ data: promos, skipDuplicates: true });
      }
      migrated += promos.length;
      process.stdout.write(`\r   ${migrated}/${promoCount}`);
    }
    console.log(`\n   ${migrated} promos`);

    // 10. PromoRequirements (en batches de 500)
    console.log('→ promoRequirements...');
    const reqCount = await neon.promoRequirement.count();
    let reqMigrated = 0;
    for (let skip = 0; skip < reqCount; skip += 500) {
      const reqs = await neon.promoRequirement.findMany({ skip, take: 500 });
      if (reqs.length) {
        await supabase.promoRequirement.createMany({ data: reqs, skipDuplicates: true });
      }
      reqMigrated += reqs.length;
      process.stdout.write(`\r   ${reqMigrated}/${reqCount}`);
    }
    console.log(`\n   ${reqMigrated} requirements`);

    // 11. Users
    console.log('→ users...');
    const users = await neon.user.findMany();
    if (users.length) {
      await supabase.user.createMany({ data: users, skipDuplicates: true });
    }
    console.log(`   ${users.length} filas`);

    // 12. Accounts (OAuth)
    console.log('→ accounts...');
    const accounts = await neon.account.findMany();
    if (accounts.length) {
      await supabase.account.createMany({ data: accounts, skipDuplicates: true });
    }
    console.log(`   ${accounts.length} filas`);

    // 13. FinancialProfiles + Cards
    console.log('→ financialProfiles...');
    const profiles = await neon.financialProfile.findMany({ include: { cards: true } });
    for (const profile of profiles) {
      const { cards, ...profileData } = profile;
      await supabase.financialProfile.upsert({
        where: { id: profile.id },
        update: {},
        create: profileData,
      });
      if (cards.length) {
        await supabase.userCard.createMany({ data: cards, skipDuplicates: true });
      }
    }
    console.log(`   ${profiles.length} perfiles`);

    // 14. SavedPromos
    console.log('→ savedPromos...');
    const saved = await neon.savedPromo.findMany();
    if (saved.length) {
      await supabase.savedPromo.createMany({ data: saved, skipDuplicates: true });
    }
    console.log(`   ${saved.length} filas`);

    console.log('\n✅ Migración completada!');
  } catch (err) {
    console.error('\n❌ Error:', err);
  } finally {
    await neon.$disconnect();
    await supabase.$disconnect();
  }
}

migrate();
