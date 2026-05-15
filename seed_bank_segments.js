const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Segmentos por banco. null = sin paquetes (se omite). '???' = pendiente.
const SEGMENTS = [
  { bank: 'YOY',               segments: ['Cuenta Simple'] },
  { bank: 'Banco Santa Cruz',  segments: ['Cuenta Plus', 'Cuenta Preferencial', 'Cuenta Excellence'] },
  { bank: 'Banco Entre Rios',  segments: ['Cuenta Clasico BPN', 'Cuenta Plus BPN', 'Cuenta Select BPN', 'Cuenta Unico BPN', 'Cuenta Unico Mas'] },
  { bank: 'Banco Neuquen',     segments: ['Cuenta Clasico BPN', 'Cuenta Plus BPN', 'Cuenta Select BPN', 'Cuenta Unico BPN', 'Cuenta Unico Mas'] },
  { bank: 'Banco Formosa',     segments: ['Cuenta Simple', 'Cuenta Plus', 'Cuenta Oro', 'Cuenta Preferencial'] },
  // Banco del Chubut -> sin paquetes, se omite
  { bank: 'Banco Santa Fe',    segments: ['Excellence', 'Preferencial', 'Simple', 'Proteccion'] },
  { bank: 'Banco San Juan',    segments: ['Excellence', 'Preferencial', 'Plus', 'Simple', 'Proteccion'] },
  { bank: 'Banco Galicia',     segments: ['Move', 'Plus', 'Eminent'] },
  { bank: 'Banco Santander',   segments: ['Super Cuenta', 'Supercuenta 3', 'Infinite', 'Infinity Gold', 'Platinum', 'Black'] },
  { bank: 'BBVA',              segments: ['Premium World', 'Premium', 'Plus Gold', 'Express'] },
  { bank: 'Banco Nacion',      segments: ['Azul', 'Style', 'Insignia'] },
  { bank: 'Banco Macro',       segments: ['Selecta'] },
  // Banco Ciudad -> pendiente (???)
  { bank: 'Banco Provincia',   segments: ['Impulso', 'Crecimiento', 'Evolucion', 'Logros'] },
  { bank: 'Banco Supervielle', segments: ['Hit IOL', 'Platinum', 'Identite Black'] },
  { bank: 'ICBC',              segments: ['Exclusive Banking', 'Plus', 'Classic'] },
  { bank: 'Banco Credicoop',   segments: ['Modulos Credicoop', 'Credicuenta', 'Jovenes'] },
  // Banco Columbia -> sin paquetes, se omite
  { bank: 'Banco Comafi',      segments: ['Premium', 'Ahorro', 'Global', 'Unico'] },
  { bank: 'Banco Hipotecario', segments: ['Black', 'Emprendedor Black', 'Platinum Black', 'Buho Black', 'Gold Black', 'Paci Black', 'Buho Inicia'] },
  { bank: 'Banco Patagonia',   segments: ['Patagonia ON', 'Patagonia Clasica', 'Patagonia Clasica Pro', 'Patagonia Plus', 'Patagonia Plus Premium', 'Patagonia Singular'] },
];

const DRY_RUN = process.argv[2] !== '--execute';

async function main() {
  console.log(DRY_RUN
    ? '🟡 DRY RUN — ejecutá con --execute para aplicar\n'
    : '🔴 EJECUTANDO — insertando segmentos\n'
  );

  let totalInserted = 0;
  let totalSkipped  = 0;

  for (const { bank, segments } of SEGMENTS) {
    // Buscar banco (flexible: busca por nombre exacto o contenido)
    const bankRecord = await prisma.bank.findFirst({
      where: { name: { equals: bank, mode: 'insensitive' } },
    });

    if (!bankRecord) {
      console.log(`⚠️  Banco no encontrado: "${bank}" — saltando`);
      continue;
    }

    console.log(`🏦 ${bank} (${bankRecord.id})`);

    for (const segName of segments) {
      const existing = await prisma.bankSegment.findUnique({
        where: { bankId_name: { bankId: bankRecord.id, name: segName } },
      });

      if (existing) {
        console.log(`   ⏭️  Ya existe: "${segName}"`);
        totalSkipped++;
        continue;
      }

      console.log(`   ✅ Insertar: "${segName}"`);
      if (!DRY_RUN) {
        await prisma.bankSegment.create({
          data: { bankId: bankRecord.id, name: segName },
        });
      }
      totalInserted++;
    }
    console.log();
  }

  console.log('═══ RESUMEN ═══');
  console.log(`Insertados : ${totalInserted}`);
  console.log(`Ya existían: ${totalSkipped}`);
  if (DRY_RUN) console.log('\n👆 Ejecutá con --execute para aplicar.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
