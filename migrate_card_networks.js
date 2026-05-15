const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log("=== Migración: Segmentación de redes de tarjeta ===\n");

  // 1. Obtener redes existentes
  const networks = await prisma.cardNetwork.findMany();
  const byName = Object.fromEntries(networks.map(n => [n.name.toLowerCase(), n]));

  const visa = byName['visa'];
  const master = byName['mastercard'];

  if (!visa || !master) {
    console.error("No se encontraron Visa y/o Mastercard en la base de datos.");
    process.exit(1);
  }

  console.log(`Visa ID: ${visa.id}`);
  console.log(`Mastercard ID: ${master.id}\n`);

  // 2. Crear nuevas entidades (upsert por nombre)
  const toCreate = [
    { name: 'Visa Crédito',       slug: 'visa-credito' },
    { name: 'Visa Débito',        slug: 'visa-debito' },
    { name: 'Mastercard Crédito', slug: 'mastercard-credito' },
    { name: 'Mastercard Débito',  slug: 'mastercard-debito' },
  ];

  const newNetworks = {};
  for (const { name, slug } of toCreate) {
    const existing = await prisma.cardNetwork.findFirst({ where: { name } });
    if (existing) {
      console.log(`Ya existe: ${name} (${existing.id})`);
      newNetworks[name] = existing;
    } else {
      const created = await prisma.cardNetwork.create({ data: { name } });
      console.log(`Creada: ${name} (${created.id})`);
      newNetworks[name] = created;
    }
  }

  console.log('\n=== Migrando PromoRequirements ===\n');

  const migrations = [
    { sourceId: visa.id,   cardType: 'CREDIT', targetName: 'Visa Crédito' },
    { sourceId: visa.id,   cardType: 'DEBIT',  targetName: 'Visa Débito' },
    { sourceId: master.id, cardType: 'CREDIT', targetName: 'Mastercard Crédito' },
    { sourceId: master.id, cardType: 'DEBIT',  targetName: 'Mastercard Débito' },
  ];

  for (const { sourceId, cardType, targetName } of migrations) {
    const reqs = await prisma.promoRequirement.findMany({
      where: { cardNetworkId: sourceId, cardType }
    });

    if (reqs.length === 0) {
      console.log(`Sin registros para migrar: ${targetName}`);
      continue;
    }

    const targetId = newNetworks[targetName].id;
    await prisma.promoRequirement.updateMany({
      where: { cardNetworkId: sourceId, cardType },
      data: { cardNetworkId: targetId, cardType: null }
    });
    console.log(`Migrados ${reqs.length} registros → ${targetName}`);
  }

  console.log('\n✅ Migración completada.');
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
