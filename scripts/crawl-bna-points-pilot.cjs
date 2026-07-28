// Piloto: recorre departamentos de Argentina (Georef) y consulta /api/points/ de BNA
// para una categoria+campaign dados, dedupeando por _id. Sin Playwright: fetch directo.
const fs = require('fs');
const path = require('path');

const SCRATCH = 'C:\\Users\\pablo\\AppData\\Local\\Temp\\claude\\c--Users-pablo-Proyectos-promoar\\437c2567-c2da-4397-85b9-7199276dc377\\scratchpad';

const CATEGORY_ID = process.argv[2] || '65a68145479be319ae7d871d'; // Veterinarias
const CAMPAIGNS = process.argv[3] || 'MASCOTASSN_inactive MASCOTASSN';
const OUT_NAME = process.argv[4] || 'pilot_veterinarias';

async function getDepartamentos() {
  const all = [];
  let inicio = 0;
  const max = 500;
  while (true) {
    const url = `https://apis.datos.gob.ar/georef/api/departamentos?max=${max}&inicio=${inicio}&campos=nombre,centroide,provincia.nombre`;
    const res = await fetch(url);
    const json = await res.json();
    all.push(...json.departamentos);
    inicio += max;
    if (inicio >= json.total) break;
  }
  return all;
}

async function queryPoints(lat, lng) {
  const url = `https://backend.activx.production.digiventures.la/api/points/?activeDays=&hasThisBenefits=&coordinates=${lat}+${lng}&promotionProducts=&categories=${CATEGORY_ID}&clearPreviousData=true&select=merchant+campaign+featured+contentData+location.coordinates+locationData+paymentMethods+text+marker&status=active&lng=${lng}&lat=${lat}&distance=20000&limit=200&campaigns=${encodeURIComponent(CAMPAIGNS)}&skip=0`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (e) {
    return [];
  }
}

(async () => {
  console.log('Descargando departamentos de Georef...');
  const departamentos = await getDepartamentos();
  console.log('Total departamentos:', departamentos.length);

  const merchantsById = new Map();
  let queriesDone = 0;
  let queriesWithResults = 0;
  let maxPointsInOneQuery = 0;

  for (const dep of departamentos) {
    const { lat, lon } = dep.centroide;
    const pts = await queryPoints(lat, lon);
    queriesDone++;
    if (pts.length > 0) queriesWithResults++;
    if (pts.length > maxPointsInOneQuery) maxPointsInOneQuery = pts.length;
    for (const p of pts) {
      if (!merchantsById.has(p._id)) {
        merchantsById.set(p._id, { ...p, foundVia: dep.nombre + ' (' + dep.provincia.nombre + ')' });
      }
    }
    if (queriesDone % 50 === 0) {
      console.log(`  progreso: ${queriesDone}/${departamentos.length} depts, ${merchantsById.size} comercios unicos, ${queriesWithResults} queries con resultados, max en una query: ${maxPointsInOneQuery}`);
    }
    // pequeña pausa para no saturar
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('=== RESULTADO FINAL ===');
  console.log('Total queries:', queriesDone);
  console.log('Queries con al menos 1 resultado:', queriesWithResults);
  console.log('Max puntos en una sola query (posible techo de paginacion):', maxPointsInOneQuery);
  console.log('Total comercios unicos encontrados:', merchantsById.size);
  console.log('Tiene Forrajeria La Negrita:', [...merchantsById.values()].some(p => /forrajer.*negrita/i.test(p.merchant||'')));

  const outPath = path.join(SCRATCH, OUT_NAME + '.json');
  fs.writeFileSync(outPath, JSON.stringify([...merchantsById.values()], null, 2));
  console.log('Guardado en:', outPath);
})().catch(e => { console.error(e); process.exit(1); });
