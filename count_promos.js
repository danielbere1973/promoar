const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.promo.count();
  const first = await prisma.promo.findFirst({ select: { id: true, title: true } });
  
  console.log(`Total promos en DB: ${count}`);
  console.log(`Ejemplo de primer registro:`);
  console.log(`  ID: ${first?.id}`);
  console.log(`  Título: ${first?.title}`);
  
  // Verificamos la URL de la base de datos (ocultando el password)
  const dbUrl = process.env.DATABASE_URL || "No definida";
  console.log(`DATABASE_URL (host): ${dbUrl.split('@')[1] || "Local"}`);
}

main().finally(() => prisma.$disconnect());
