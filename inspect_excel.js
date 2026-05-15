const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'bancos_paquetes_tarjetas.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const headers = data[0];

let currentBank = null;
let foundCount = 0;

console.log("Searching for sample banks to understand structure...");

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (row[0]) currentBank = row[0];
  
  if (currentBank === 'Banco Galicia' || currentBank === 'Banco Santa Cruz') {
    console.log(`\nRow ${i} (Bank: ${currentBank}):`);
    headers.forEach((h, idx) => {
      if (row[idx]) {
        console.log(`  ${h}: ${row[idx]}`);
      }
    });
    foundCount++;
    if (foundCount > 15) break;
  }
}
