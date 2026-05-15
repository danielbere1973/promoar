const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Pares de duplicados: [nombre a ELIMINAR, nombre a CONSERVAR]
const DUPLICATES = [
  ['BANCO DE FORMOSA S.A.',                      'Banco Formosa'],
  ['BANCO DE SANTA CRUZ S.A.',                   'Banco Santa Cruz'],
  ['BANCO DE SAN JUAN S.A.',                     'Banco San Juan'],
  ['BANCO DE LA PROVINCIA DE BUENOS AIRES',      'Banco Provincia'],
  ['BANCO PROVINCIA DEL NEUQUÉN SOCIEDAD ANÓ',   'Banco Neuquen'],
  ['NUEVO BANCO DE ENTRE RÍOS S.A.',             'Banco Entre Ríos'],
  ['NUEVO BANCO DE SANTA FE SOCIEDAD ANONIMA',   'Banco Santa Fe'],
  ['NARANJA DIGITAL COMPAÑÍA FINANCIERA S.A.',   'Naranja X'],
];

const DRY_RUN = process.argv[2] !== '--execute';

async function mergePair(deleteName, keepName) {
  const toDelete = await prisma.bank.findUnique({ where: { name: deleteName } });
  const toKeep   = await prisma.bank.findUnique({ where: { name: keepName } });

  if (!toDelete) { console.log(`  ⚠️  No encontrado: "${deleteName}" — salteando`); return; }
  if (!toKeep)   { console.log(`  ⚠️  No encontrado: "${keepName}" — salteando`); return; }

  console.log(`\n🔀 Mergeando:`);
  console.log(`   ELIMINAR: "${deleteName}" (${toDelete.id})`);
  console.log(`   CONSERVAR: "${keepName}" (${toKeep.id})`);

  // Contar referencias
  const [reqCount, userBankCount, userCardCount, segCount, modoCount] = await Promise.all([
    prisma.promoRequirement.count({ where: { bankId: toDelete.id } }),
    prisma.userBank.count({ where: { bankId: toDelete.id } }),
    prisma.userCard.count({ where: { bankId: toDelete.id } }),
    prisma.bankSegment.count({ where: { bankId: toDelete.id } }),
    prisma.bank_modo_codes.count({ where: { bankId: toDelete.id } }),
  ]);

  console.log(`   Referencias encontradas:`);
  console.log(`     promo_requirements : ${reqCount}`);
  console.log(`     user_banks         : ${userBankCount}`);
  console.log(`     user_cards         : ${userCardCount}`);
  console.log(`     bank_segments      : ${segCount}`);
  console.log(`     bank_modo_codes    : ${modoCount}`);

  if (DRY_RUN) {
    console.log(`   🟡 DRY RUN — no se realizaron cambios`);
    return;
  }

  // Reasignar promo_requirements
  if (reqCount > 0) {
    await prisma.promoRequirement.updateMany({
      where: { bankId: toDelete.id },
      data:  { bankId: toKeep.id },
    });
  }

  // Reasignar user_cards
  if (userCardCount > 0) {
    await prisma.userCard.updateMany({
      where: { bankId: toDelete.id },
      data:  { bankId: toKeep.id },
    });
  }

  // Reasignar user_banks (respetar unique constraint [financialProfileId, bankId])
  if (userBankCount > 0) {
    const userBanks = await prisma.userBank.findMany({ where: { bankId: toDelete.id } });
    for (const ub of userBanks) {
      const exists = await prisma.userBank.findUnique({
        where: { financialProfileId_bankId: { financialProfileId: ub.financialProfileId, bankId: toKeep.id } },
      });
      if (exists) {
        await prisma.userBank.delete({ where: { id: ub.id } }); // ya tiene el banco correcto
      } else {
        await prisma.userBank.update({ where: { id: ub.id }, data: { bankId: toKeep.id } });
      }
    }
  }

  // Reasignar bank_segments
  if (segCount > 0) {
    await prisma.bankSegment.updateMany({
      where: { bankId: toDelete.id },
      data:  { bankId: toKeep.id },
    });
  }

  // Reasignar bank_modo_codes
  if (modoCount > 0) {
    await prisma.bank_modo_codes.updateMany({
      where: { bankId: toDelete.id },
      data:  { bankId: toKeep.id },
    });
  }

  // Reasignar relación many-to-many cardNetworks
  await prisma.$executeRaw`
    UPDATE "_BankToCardNetwork"
    SET "A" = ${toKeep.id}
    WHERE "A" = ${toDelete.id}
    AND NOT EXISTS (
      SELECT 1 FROM "_BankToCardNetwork"
      WHERE "A" = ${toKeep.id} AND "B" = "_BankToCardNetwork"."B"
    )
  `;

  // Eliminar el banco duplicado
  await prisma.bank.delete({ where: { id: toDelete.id } });

  console.log(`   ✅ Merge completado — "${deleteName}" eliminado`);
}

async function main() {
  console.log(DRY_RUN
    ? '🟡 MODO DRY RUN — ejecutá con --execute para aplicar los cambios\n'
    : '🔴 MODO EJECUCIÓN — aplicando cambios en la base de datos\n'
  );

  for (const [deleteName, keepName] of DUPLICATES) {
    await mergePair(deleteName, keepName);
  }

  console.log('\n✅ Proceso finalizado');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
