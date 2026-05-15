require('ts-node').register({
  compilerOptions: { module: 'CommonJS', esModuleInterop: true }
});

const { BancoCiudadScraper } = require('./lib/scrapers/bancociudad');

async function inspectCebra() {
  console.log("Obteniendo datos crudos de Cebra desde la API del banco...");
  const promos = await BancoCiudadScraper.run();
  const cebra = promos.find(p => p.storeName.includes('Cebra'));
  
  if (cebra) {
    console.log("DATOS ENCONTRADOS:");
    console.log(JSON.stringify(cebra, null, 2));
  } else {
    console.log("No se encontró Cebra en el scrape actual.");
  }
}

inspectCebra().catch(console.error);
