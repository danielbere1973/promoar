// Ejecuta el test de Galicia solo Mascotas/Puppis
import { GaliciaMascotasTest } from './galicia_mascotas_test';

(async () => {
  const promos = await GaliciaMascotasTest.run();
  console.log('Promos Puppis:', promos);
})();
