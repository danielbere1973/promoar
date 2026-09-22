const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const entityLogos = [
  // Banks
  { type: 'bank', slug: 'macro', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Macro_BMA.png/800px-Macro_BMA.png' },
  { type: 'bank', slug: 'patagonia', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Logo_Banco_Patagonia.svg/1200px-Logo_Banco_Patagonia.svg.png' },
  { type: 'bank', slug: 'columbia', logoUrl: 'https://vignette.wikia.nocookie.net/logopedia/images/2/23/Banco_Columbia_2011.png' },
  { type: 'bank', slug: 'comafi', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Logo_Oficial_Banco_Comafi.png' },
  { type: 'bank', slug: 'icbc', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/36/ICBC_Argentina.png' },
  { type: 'bank', slug: 'banco-del-sol', logoUrl: 'https://www.bancodelsol.com/wp-content/uploads/2020/07/logo-bds-sun-orange.png' },
  { type: 'bank', slug: 'reba-compania-financiera', logoUrl: 'https://www.reba.com.ar/wp-content/themes/reba/img/logo-reba.png' },
  
  // Commerces
  { type: 'commerce', slug: 'devre', logoUrl: 'https://brandslogos.com/wp-content/uploads/images/devre-logo.png' },
  { type: 'commerce', slug: 'macowens', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Logo_Macowens.png' },
  { type: 'commerce', slug: 'cheeky', logoUrl: 'https://brandslogos.com/wp-content/uploads/images/cheeky-logo.png' },
  { type: 'commerce', slug: 'paruolo', logoUrl: 'https://seeklogo.com/images/P/paruolo-logo-8A1B1C8E1B-seeklogo.com.png' },
  { type: 'commerce', slug: 'dexter', logoUrl: 'https://logodownload.org/wp-content/uploads/2021/04/dexter-logo.png' },
  { type: 'commerce', slug: 'cabify', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Cabify-Logo-Moradul-RGB.png' },
  { type: 'commerce', slug: 'mistral', logoUrl: 'https://brandslogos.com/wp-content/uploads/images/mistral-logo.png' },
  { type: 'commerce', slug: 'nike', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/1200px-Logo_NIKE.svg.png' }
];

async function updateLogos() {
  for (const item of entityLogos) {
    if (item.type === 'bank') {
      await prisma.bank.update({
        where: { slug: item.slug },
        data: { logoUrl: item.logoUrl }
      }).catch(e => console.error(`Error updating bank ${item.slug}: ${e.message}`));
    } else if (item.type === 'commerce') {
      await prisma.commerce.update({
        where: { slug: item.slug },
        data: { logoUrl: item.logoUrl }
      }).catch(e => console.error(`Error updating commerce ${item.slug}: ${e.message}`));
    }
  }
  console.log('Logos updated successfully.');
  await prisma.$disconnect();
}

updateLogos();
