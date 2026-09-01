import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const commerces = await prisma.commerce.findMany({
    where: {
      promos: {
        some: {
          requirements: {
            some: {
              bank: { slug: 'santander' }
            }
          }
        }
      }
    }
  });

  console.log(`Checking ${commerces.length} commerces with Santander promos...`);

  for (const commerce of commerces) {
    if (!commerce.logoUrl || commerce.logoUrl.includes('santander.com.ar')) {
      const domainMatch = commerce.name.toLowerCase().replace(/ /g, '').replace(/[^a-z0-9]/g, '');
      // Intentamos inferir un dominio o usamos el servicio de favicons con el nombre si no hay mas
      // Pero mejor aun, si no tiene logo o el que tiene es de santander (que suele fallar), usamos google favicon
      let newLogo = `https://www.google.com/s2/favicons?sz=128&domain=${domainMatch}.com.ar`;
      
      // Casos especiales conocidos
      if (commerce.name.toLowerCase().includes('coto')) newLogo = 'https://www.google.com/s2/favicons?sz=128&domain=coto.com.ar';
      if (commerce.name.toLowerCase().includes('jumbo')) newLogo = 'https://www.google.com/s2/favicons?sz=128&domain=jumbo.com.ar';
      if (commerce.name.toLowerCase().includes('disco')) newLogo = 'https://www.google.com/s2/favicons?sz=128&domain=disco.com.ar';
      if (commerce.name.toLowerCase().includes('vea')) newLogo = 'https://www.google.com/s2/favicons?sz=128&domain=supermercadosvea.com.ar';
      if (commerce.name.toLowerCase().includes('changomas')) newLogo = 'https://www.google.com/s2/favicons?sz=128&domain=changomas.com.ar';
      if (commerce.name.toLowerCase().includes('farmacity')) newLogo = 'https://www.google.com/s2/favicons?sz=128&domain=farmacity.com';

      console.log(`Updating ${commerce.name}: ${newLogo}`);
      await prisma.commerce.update({
        where: { id: commerce.id },
        data: { logoUrl: newLogo }
      });
    }
  }

  console.log('Finished healing Santander commerce logos.');
  await prisma.$disconnect();
}

run();
