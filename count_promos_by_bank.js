const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`
    SELECT 
      b.name AS banco,
      COUNT(DISTINCT pr."promoId") AS total_promos
    FROM banks b
    LEFT JOIN promo_requirements pr ON pr."bankId" = b.id
    GROUP BY b.id, b.name
    ORDER BY total_promos ASC, b.name ASC
  `;

  const rows = result.map(r => ({
    Banco: r.banco,
    Promos: Number(r.total_promos)
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 50 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Promos por Banco');

  const outPath = path.join(__dirname, 'promos_por_banco.xlsx');
  XLSX.writeFile(wb, outPath);

  console.log(`✅ Excel generado: ${outPath}`);
  console.log(`   ${rows.length} bancos exportados`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
