const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const moreLogos = [
  { type: 'commerce', slug: 'www-simplicity-com-ar', logoUrl: 'https://cdn.worldvectorlogo.com/logos/simplicity-1.svg' },
  { type: 'commerce', slug: 'dash', logoUrl: 'https://dashdeportes.vteximg.com.br/arquivos/logo-dash.png' },
  { type: 'commerce', slug: 'grid', logoUrl: 'https://grid.vteximg.com.br/arquivos/logo-grid.png' },
  { type: 'commerce', slug: 'on-sports', logoUrl: 'https://onsports.vteximg.com.br/arquivos/logo-onsports.png' },
  { type: 'commerce', slug: 'seven-sport', logoUrl: 'https://sevensport.vteximg.com.br/arquivos/logo-sevensport.png' },
  { type: 'commerce', slug: 'parfumerie', logoUrl: 'https://www.parfumerie.com.ar/media/logo/stores/1/logo_parfumerie_2026_negro.png' },
  { type: 'commerce', slug: 'akiabara', logoUrl: 'https://akiabara.com/img/akiabara-logo-1563820612.jpg' }
];

async function updateMoreLogos() {
  for (const item of moreLogos) {
    await prisma.commerce.update({
      where: { slug: item.slug },
      data: { logoUrl: item.logoUrl }
    }).catch(e => console.error(`Error updating commerce ${item.slug}: ${e.message}`));
  }
  console.log('More logos updated successfully.');
  await prisma.$disconnect();
}

updateMoreLogos();
