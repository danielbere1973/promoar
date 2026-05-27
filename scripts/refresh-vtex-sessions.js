/**
 * Abre Jumbo, Disco y Vea con Playwright, navega por categorías y subcategorías,
 * intercepta las respuestas de search-promotions y guarda el cache en DB.
 *
 * Uso local:  node scripts/refresh-vtex-sessions.js
 * En CI:      se ejecuta automáticamente via GitHub Actions día por medio.
 */

const { chromium } = require('playwright')

const API_URL = process.env.API_URL || 'http://localhost:3000'
const SECRET = process.env.VTEX_SESSION_SECRET

if (!SECRET) {
  console.error('ERROR: Falta VTEX_SESSION_SECRET')
  process.exit(1)
}

const SITES = [
  { host: 'www.jumbo.com.ar',  baseUrl: 'https://www.jumbo.com.ar' },
  { host: 'www.disco.com.ar',  baseUrl: 'https://www.disco.com.ar' },
  { host: 'www.vea.com.ar',    baseUrl: 'https://www.vea.com.ar' },
]

// Categorías y subcategorías reales de Jumbo/Disco/Vea (extraídas del sitio)
const CATEGORIES = [
  // Bebidas
  'bebidas/aguas/aguas-sin-gas',
  'bebidas/aguas/aguas-con-gas',
  'bebidas/aguas/aguas-saborizadas',
  'bebidas/gaseosas/cola',
  'bebidas/gaseosas/lima-limon',
  'bebidas/gaseosas/naranja',
  'bebidas/gaseosas/pomelo',
  'bebidas/gaseosas/tonica',
  'bebidas/jugos/listos',
  'bebidas/jugos/en-polvo',
  'bebidas/jugos/frescos',
  'bebidas/Cervezas',
  'bebidas/Vinos',
  'bebidas/vinos/vinos-blancos',
  'bebidas/vinos/vinos-tintos',
  'bebidas/vinos/vinos-rosados',
  'bebidas/Espumantes',
  'bebidas/Energizantes',
  'bebidas/Isotonicas',
  'bebidas/Aperitivos',
  'bebidas/Sidras',
  'bebidas/Licores',
  'bebidas/Bebidas-Blancas',
  'bebidas/Whiskys',
  // Almacén
  'almacen/aceites-y-vinagres/aceites-comunes',
  'almacen/aceites-y-vinagres/aceites-especiales',
  'almacen/aceites-y-vinagres/vinagres',
  'almacen/aderezos/mayonesas',
  'almacen/aderezos/ketchup',
  'almacen/aderezos/mostazas',
  'almacen/aderezos/salsas-frias',
  'almacen/aderezos/otros-condimentos',
  'almacen/arroz-y-legumbres/arroz',
  'almacen/arroz-y-legumbres/legumbres',
  'almacen/sal-pimienta-y-especias/sal',
  'almacen/sal-pimienta-y-especias/especias',
  'almacen/conservas/conservas-de-carne',
  'almacen/conservas/conservas-de-pescado',
  'almacen/conservas/conservas-de-verduras-y-legumbres',
  'almacen/conservas/conservas-de-frutas',
  'almacen/desayuno-y-merienda/azucar-y-edulcorantes',
  'almacen/desayuno-y-merienda/cafes',
  'almacen/desayuno-y-merienda/tes',
  'almacen/desayuno-y-merienda/yerbas',
  'almacen/desayuno-y-merienda/galletitas-dulces',
  'almacen/desayuno-y-merienda/galletitas-saladas',
  'almacen/desayuno-y-merienda/cereales',
  'almacen/desayuno-y-merienda/mermeladas-y-jaleas',
  'almacen/desayuno-y-merienda/leches',
  'almacen/desayuno-y-merienda/cacao-y-saborizantes',
  'almacen/golosinas-y-chocolates/chocolates',
  'almacen/golosinas-y-chocolates/alfajores',
  'almacen/golosinas-y-chocolates/caramelos-y-chicles',
  'almacen/golosinas-y-chocolates/bombones',
  'almacen/golosinas-y-chocolates/bocaditos-y-postres',
  'almacen/harinas/harinas',
  'almacen/harinas/avenas-y-semolas',
  'almacen/panificados/tostadas-y-grisines',
  'almacen/panificados/integral-y-salvado',
  'almacen/panificados/pan-rallado-y-rebozador',
  'almacen/caldos-sopas-pure-y-bolsas-para-horno/caldos',
  'almacen/caldos-sopas-pure-y-bolsas-para-horno/sopas',
  'almacen/caldos-sopas-pure-y-bolsas-para-horno/pure',
  'almacen/para-preparar/bizcochuelos-brownies-y-tortas',
  'almacen/para-preparar/flanes',
  'almacen/para-preparar/gelatinas',
  'almacen/para-preparar/helados',
  'almacen/pastas-secas-y-salsas/pastas-secas-largas',
  'almacen/pastas-secas-y-salsas/pastas-secas-guiseras',
  'almacen/pastas-secas-y-salsas/salsas',
  'almacen/snacks/papas-fritas',
  'almacen/snacks/nachos',
  'almacen/snacks/palitos-salados',
  'almacen/snacks/frutas-secas-y-disecadas',
  'almacen/snacks/mani',
  'almacen/snacks/pochoclos',
  // Lácteos
  'lacteos/leches/leches-larga-vida',
  'lacteos/leches/leches-refrigeradas',
  'lacteos/leches/leches-saborizadas',
  'lacteos/leches/bebidas-vegetales',
  'lacteos/yogures/yogures-enteros',
  'lacteos/yogures/yogures-descremados',
  'lacteos/cremas',
  'lacteos/dulce-de-leche',
  'lacteos/mantecas-y-margarinas/manteca',
  'lacteos/mantecas-y-margarinas/margarinas',
  'lacteos/postres',
  'lacteos/pastas-y-tapas/pastas-rellenas',
  'lacteos/pastas-y-tapas/fideos-y-noquis',
  'lacteos/pastas-y-tapas/tapas',
  // Quesos y fiambres
  'quesos-y-fiambres/quesos/quesos-untables',
  'quesos-y-fiambres/quesos/queso-muzzarella',
  'quesos-y-fiambres/quesos/quesos-port-salut-y-cremosos',
  'quesos-y-fiambres/quesos/quesos-semiblandos',
  'quesos-y-fiambres/quesos/quesos-duros',
  'quesos-y-fiambres/quesos/quesos-rallados',
  'quesos-y-fiambres/quesos/ricota',
  'quesos-y-fiambres/fiambres/jamon-cocido-y-crudo',
  'quesos-y-fiambres/fiambres/otros-fiambres',
  'quesos-y-fiambres/salchichas',
  'quesos-y-fiambres/encurtidos-aceitunas-y-pickles',
  // Carnes
  'carnes/carne-vacuna/novillito',
  'carnes/carnes-especiales',
  'carnes/carne-de-cerdo',
  'carnes/pollos',
  'carnes/embutidos/chorizos',
  'carnes/embutidos/morcilla',
  'carnes/embutidos/salchichas',
  'carnes/listos-para-cocinar',
  // Pescados
  'Pescados-y-Mariscos/Pescados',
  'Pescados-y-Mariscos/Mariscos',
  // Frutas y verduras
  'frutas-y-verduras/frutas/frutas-sueltas',
  'frutas-y-verduras/frutas/frutas-empaquetadas',
  'frutas-y-verduras/verduras/hortalizas-livianas',
  'frutas-y-verduras/verduras/hortalizas-pesadas',
  'frutas-y-verduras/verduras/verduras-empaquetadas',
  'frutas-y-verduras/huevos',
  // Panadería
  'panaderia-y-pasteleria/panaderia-salada/panificados',
  'panaderia-y-pasteleria/panaderia-dulce',
  'panaderia-y-pasteleria/pasteleria',
  // Congelados
  'congelados/comidas-congeladas/pizzas',
  'congelados/comidas-congeladas/empanadas-y-tartas',
  'congelados/comidas-congeladas/comidas-congeladas',
  'Congelados/Hamburguesas-y-Milanesas',
  'Congelados/Papas',
  'Congelados/Pollo-y-Carnes',
  'Congelados/Vegetales',
  'Congelados/Pescados-y-Mariscos',
  'congelados/helados-y-postres',
  // Limpieza
  'limpieza/lavandina',
  'limpieza/limpieza-de-bano/desinfectantes',
  'limpieza/limpieza-de-bano/pastillas-y-bloques',
  'limpieza/limpieza-de-cocina/detergentes',
  'limpieza/limpieza-de-cocina/limpiadores',
  'limpieza/limpieza-de-cocina/limpiavidrios',
  'limpieza/limpieza-de-cocina/productos-para-lavavajillas',
  'limpieza/limpieza-de-pisos-y-muebles/limpiadores-de-pisos',
  'limpieza/cuidado-para-la-ropa/detergente-para-ropa',
  'limpieza/cuidado-para-la-ropa/suavizantes',
  'limpieza/cuidado-para-la-ropa/quitamanchas',
  'limpieza/cuidado-para-la-ropa/jabon-en-pan',
  'limpieza/papeles/papel-higienico',
  'limpieza/papeles/rollos-de-cocina',
  'limpieza/papeles/panuelos',
  'limpieza/papeles/servilletas',
  'limpieza/accesorios-de-limpieza/bolsas',
  'limpieza/accesorios-de-limpieza/esponjas-y-guantes',
  'limpieza/desodorantes-de-ambiente/aromatizantes',
  'limpieza/desodorantes-de-ambiente/desodorantes-y-desinfectantes',
  'limpieza/insecticidas/aerosoles',
  // Perfumería / Higiene
  'perfumeria/cuidado-capilar/shampoo',
  'perfumeria/cuidado-capilar/acondicionador',
  'perfumeria/cuidado-capilar/coloracion',
  'perfumeria/cuidado-de-la-piel/cremas-corporales',
  'perfumeria/cuidado-de-la-piel/cremas-faciales',
  'perfumeria/cuidado-de-la-piel/solares-y-post-solares',
  'perfumeria/cuidado-personal/desodorantes-de-hombres',
  'perfumeria/cuidado-personal/desodorantes-de-mujer',
  'perfumeria/cuidado-personal/jabones',
  'perfumeria/cuidado-personal/geles-de-ducha',
  'perfumeria/cuidado-personal/depilacion',
  'perfumeria/cuidado-personal/proteccion-femenina',
  'perfumeria/cuidado-oral/pastas-dentales',
  'perfumeria/cuidado-oral/cepillos-dentales',
  'perfumeria/cuidado-oral/enjuagues-bucales',
  'perfumeria/farmacia/algodon',
  'perfumeria/farmacia/alcohol',
  'perfumeria/farmacia/preservativos',
  // Bebés y mascotas
  'mundo-bebe/panales',
  'mundo-bebe/higiene-para-el-bebe',
  'mundo-bebe/Alimentacion',
  'mascotas/perros/secos',
  'mascotas/perros/humedos',
  'mascotas/gatos/secos',
  'mascotas/gatos/humedos',
]

async function collectPromosForSite({ host, baseUrl }) {
  const promos = {}
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9' },
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    const page = await context.newPage()

    // Interceptar todas las respuestas de search-promotions
    let currentCat = ''
    const pending = []
    page.on('response', (response) => {
      if (!response.url().includes('search-promotions')) return
      const cat = currentCat
      const p = response.json().then(data => {
        const allBuckets = data?.promotions || {}
        for (const bucket of Object.values(allBuckets)) {
          for (const [skuId, promo] of Object.entries(bucket?.promotions || {})) {
            if (promo?.effectiveDiscount && promo?.code) {
              promos[skuId] = {
                promoCode: promo.code.trim(),
                effectiveDiscount: parseFloat(promo.effectiveDiscount),
                category: cat,
              }
            }
          }
        }
      }).catch(() => {})
      pending.push(p)
    })

    // Visitar la home primero para establecer la sesión
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Navegar por cada categoría/subcategoría con paginación
    for (const cat of CATEGORIES) {
      currentCat = cat
      for (let page_num = 1; ; page_num++) {
        try {
          const url = page_num === 1
            ? `${baseUrl}/${cat}`
            : `${baseUrl}/${cat}?page=${page_num}`
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await page.waitForTimeout(5000)
          await Promise.all(pending.splice(0))

          // Leer total de páginas del paginador (ej: "Página 1 de 4")
          const totalPages = await page.evaluate(() => {
            const text = document.body.innerText
            const match = text.match(/[Pp][áa]gina\s+\d+\s+de\s+(\d+)/)
            return match ? parseInt(match[1]) : null
          })
          if (totalPages !== null && page_num >= totalPages) break
        } catch {
          break
        }
      }
    }

    console.log(`[${host}] ${Object.keys(promos).length} promos recolectadas`)
  } finally {
    await browser.close()
  }

  return promos
}

async function savePromos(site, promos) {
  const count = Object.keys(promos).length
  if (count === 0) return

  const res = await fetch(`${API_URL}/api/internal/vtex-promos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ site, promos }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[${site}] Error guardando promos: ${res.status} ${text}`)
  } else {
    const data = await res.json()
    console.log(`[${site}] Guardadas ${data.saved} promos en DB`)
  }
}

async function main() {
  console.log(`Recolectando promos de ${SITES.length} sitios (${CATEGORIES.length} categorías cada uno)...`)
  console.log('Esto puede tardar ~10 minutos.\n')

  for (const site of SITES) {
    console.log(`\n--- ${site.host} ---`)
    const promos = await collectPromosForSite(site)
    await savePromos(site.host, promos)
  }

  console.log('\n✅ Listo.')
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
