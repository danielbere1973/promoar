const fs = require('fs');

const coto = JSON.parse(fs.readFileSync('CotoconstructorCategories.json'));
const carrefour = JSON.parse(fs.readFileSync('carrefour_categories.json'));
const dia = JSON.parse(fs.readFileSync('dia_categories.json'));
const jumbo = JSON.parse(fs.readFileSync('jumbo_categories.json'));

let output = '';

// Coto structure
output += '=== COTO ===\n';
coto.output.forEach(catGroup => {
  const tlc = catGroup.topLevelCategory;
  if (tlc && tlc.displayName !== 'Ofertas') {
    output += `- ${tlc.displayName} (${tlc.categoryId})\n`;
    if (catGroup.subCategories) {
      catGroup.subCategories.forEach(sub => {
        output += `  - ${sub.displayName} (${sub.categoryId})\n`;
      });
    }
  }
});

// VTEX structure
function parseVtex(arr, prefix = '') {
  let res = '';
  arr.forEach(c => {
    res += `${prefix}- ${c.name} (${c.id})\n`;
    if (c.children && prefix === '') { // only 1 level deep
      res += parseVtex(c.children, prefix + '  ');
    }
  });
  return res;
}

output += '\n=== CARREFOUR ===\n';
output += parseVtex(carrefour);

output += '\n=== DIA ===\n';
output += parseVtex(dia);

output += '\n=== JUMBO ===\n';
output += parseVtex(jumbo);

fs.writeFileSync('scratch/category_dump.txt', output);
console.log('Categories dumped to scratch/category_dump.txt');
