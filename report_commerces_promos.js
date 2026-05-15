const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Generando reporte...");
  
  const commerces = await prisma.commerce.findMany({
    include: {
      promos: {
        select: {
          title: true,
          status: true,
          validUntil: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  });

  let report = "# Reporte de Comercios y Promociones\n\n";
  report += `Fecha: ${new Date().toLocaleString()}\n\n`;

  commerces.forEach(commerce => {
    report += `## ${commerce.name}\n`;
    if (commerce.promos.length === 0) {
      report += "- No tiene promociones registradas.\n";
    } else {
      commerce.promos.forEach(promo => {
        const validUntil = promo.validUntil ? new Date(promo.validUntil).toLocaleDateString() : 'N/A';
        report += `- **[${promo.status}]** ${promo.title} (Vence: ${validUntil})\n`;
      });
    }
    report += "\n";
  });

  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, 'reporte_comercios_promos.md');
  fs.writeFileSync(reportPath, report);
  
  console.log(`Reporte generado exitosamente en: ${reportPath}`);
  console.log(report);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
