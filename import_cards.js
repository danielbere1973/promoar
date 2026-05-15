const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const COLUMN_MAP = {
  'Visa Credito': { slug: 'visa', type: 'CREDIT' },
  'Visa Debito': { slug: 'visa', type: 'DEBIT' }, // The DB has a 'visa-debito' network, but semantically it's network: visa, type: DEBIT. The model UserCard expects cardNetworkId (Visa) and cardType (DEBIT).
  'Mastercard Credito': { slug: 'mastercard', type: 'CREDIT' },
  'Mastercard Debito': { slug: 'mastercard', type: 'DEBIT' },
  'Maestro': { slug: 'maestro', type: 'DEBIT' },
  'Master Prepaga': { slug: 'mastercard', type: 'PREPAID' },
  'Visa Recargable': { slug: 'visa', type: 'PREPAID' },
  'Cabal': { slug: 'cabal', type: 'CREDIT' },
  'American Express Banco': { slug: 'american-express-banco', type: 'CREDIT' },
  'American Express': { slug: 'amex', type: 'CREDIT' },
  'Confiable': { slug: 'confiable', type: 'CREDIT' },
  'Patagonia': { slug: 'patagonia', type: 'CREDIT' },
  'Naranja X': { slug: 'naranja-x', type: 'CREDIT' }
};

async function main() {
  console.log("Loading Excel file...");
  const filePath = path.join(__dirname, 'bancos_paquetes_tarjetas.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = data[0];

  const dbNetworks = await prisma.cardNetwork.findMany();
  const networkMap = {};
  dbNetworks.forEach(n => { networkMap[n.slug] = n.id; });

  const dbBanks = await prisma.bank.findMany();
  const bankMap = {};
  dbBanks.forEach(b => { bankMap[b.name.trim().toLowerCase()] = b; });

  console.log("Clearing existing CardSegments...");
  await prisma.cardSegment.deleteMany({});

  let currentBank = null;
  let skippedBanks = new Set();
  
  const bankToSegments = {};
  const bankToNetworks = {};
  const globalSegments = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    if (row[0]) {
      currentBank = row[0].trim();
    }

    if (!currentBank) continue;

    const bankRecord = bankMap[currentBank.toLowerCase()];
    if (!bankRecord) {
      skippedBanks.add(currentBank);
      continue;
    }

    const bankId = bankRecord.id;
    if (!bankToSegments[bankId]) bankToSegments[bankId] = new Set();
    if (!bankToNetworks[bankId]) bankToNetworks[bankId] = new Set();

    headers.forEach((h, idx) => {
      const colName = h?.trim();
      const cellValue = row[idx];
      
      if (!cellValue || typeof cellValue !== 'string' || !colName || !COLUMN_MAP[colName]) return;

      const segmentName = cellValue.trim();
      if (segmentName === '-' || segmentName.toLowerCase() === 'no') return;

      const config = COLUMN_MAP[colName];
      const networkId = networkMap[config.slug];

      if (!networkId) {
        console.log(`Warning: Network not found for slug ${config.slug}`);
        return;
      }

      const segmentKey = `${networkId}-${config.type}-${segmentName.toLowerCase()}`;
      
      bankToNetworks[bankId].add(networkId);

      if (!globalSegments[segmentKey]) {
        globalSegments[segmentKey] = {
          cardNetworkId: networkId,
          cardType: config.type,
          name: segmentName
        };
      }

      bankToSegments[bankId].add(segmentKey);
    });
  }

  console.log(`Creating ${Object.keys(globalSegments).length} unique Card Segments...`);
  const segmentIdMap = {};
  for (const [key, data] of Object.entries(globalSegments)) {
    const seg = await prisma.cardSegment.create({ data });
    segmentIdMap[key] = seg.id;
  }

  console.log("Updating Banks with Networks and Segments...");
  for (const [bankId, segmentKeys] of Object.entries(bankToSegments)) {
    const segmentIds = Array.from(segmentKeys).map(k => ({ id: segmentIdMap[k] }));
    const networkIds = Array.from(bankToNetworks[bankId]).map(id => ({ id }));

    await prisma.bank.update({
      where: { id: bankId },
      data: {
        cardSegments: { set: segmentIds },
        cardNetworks: { connect: networkIds }
      }
    });
  }

  console.log("Import completed successfully!");
  if (skippedBanks.size > 0) {
    console.log("Banks not found in DB:");
    console.log(Array.from(skippedBanks).join(", "));
  }
}

main().finally(() => prisma.$disconnect());
