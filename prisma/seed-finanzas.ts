import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRaw`TRUNCATE TABLE "finance_items" CASCADE`;
  
  await prisma.$executeRaw`
    INSERT INTO "finance_items" ("id", "type", "entityName", "rateTNA", "rateTEA", "currency", "active", "updatedAt", "createdAt")
    VALUES 
    (gen_random_uuid(), 'TNA_WALLET', 'Naranja X', 72, 100.1, 'ARS', true, NOW(), NOW()),
    (gen_random_uuid(), 'TNA_WALLET', 'Brubank', 70, 96.7, 'ARS', true, NOW(), NOW()),
    (gen_random_uuid(), 'TNA_WALLET', 'Ualá', 69, 94.9, 'ARS', true, NOW(), NOW()),
    (gen_random_uuid(), 'TNA_WALLET', 'Mercado Pago', 68, 93.1, 'ARS', true, NOW(), NOW()),
    (gen_random_uuid(), 'CAUCION', '1 día (overnight)', 60, NULL, 'ARS', true, NOW(), NOW()),
    (gen_random_uuid(), 'CAUCION', '7 días', 62, NULL, 'ARS', true, NOW(), NOW()),
    (gen_random_uuid(), 'CAUCION', '30 días', 65, NULL, 'ARS', true, NOW(), NOW());
  `;

  await prisma.$executeRaw`
    INSERT INTO "finance_items" ("id", "type", "entityName", "code", "maturityDate", "rateTEM", "currency", "active", "updatedAt", "createdAt")
    VALUES 
    (gen_random_uuid(), 'LECAP', 'LECAP S30A6', 'S30A6', '2026-04-30', 4.2, 'ARS', true, NOW(), NOW());
  `;

  await prisma.$executeRaw`
    INSERT INTO "finance_items" ("id", "type", "entityName", "code", "maturityDate", "rateAdjust", "currency", "active", "updatedAt", "createdAt")
    VALUES 
    (gen_random_uuid(), 'LECAP', 'LECER X16J6', 'X16J6', '2026-06-16', 'CER + 5%', 'ARS', true, NOW(), NOW());
  `;

  await prisma.$executeRaw`
    INSERT INTO "finance_items" ("id", "type", "entityName", "maturityDate", "rateTEA", "currency", "active", "updatedAt", "createdAt")
    VALUES 
    (gen_random_uuid(), 'ON', 'YPF 2026', '2026-07-01', 7.2, 'USD', true, NOW(), NOW()),
    (gen_random_uuid(), 'ON', 'Pampa 2027', '2027-01-01', 8.1, 'USD', true, NOW(), NOW()),
    (gen_random_uuid(), 'ON', 'IRSA 2028', '2028-03-01', 9.3, 'USD', true, NOW(), NOW());
  `;

  console.log('✅ Seed completado via SQL!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
