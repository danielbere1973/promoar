/**
 * Enriquecedor de taxonomía de productos para comercios de retail en PromoAR.
 * Asigna catálogos conceptuales con términos de búsqueda rioplatenses reales
 * (saco, corbata, traje, ambo, libro, rompecabezas, pelota, botines, cartera, etc.)
 * a comercios de Indumentaria, Deportes, Librerías, Jugueterías y Calzado.
 *
 * Uso: npx ts-node scripts/enrich-retail-products.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Archetype {
  id: string
  name: string
  categoria: string
  subcategoria: string
  productos: string
  matches: (name: string, categoryName?: string | null) => boolean
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

const ARCHETYPES: Archetype[] = [
  // 1. SASTRERÍA MASCULINA Y VESTIR
  {
    id: 'sastreria',
    name: 'Sastrería Masculina y Formal',
    categoria: 'Indumentaria Masculina',
    subcategoria: 'Sastrería y Vestir',
    productos: 'saco | sacos | traje | trajes | ambo | ambos | corbata | corbatas | moño | moños | camisa | camisas | camisa de vestir | pantalon | pantalones | pantalon de vestir | blazer | blazers | tiradores | gemelos | cinturón | cinturones | sobretodo | chaleco | chalecos | zapatos de vestir',
    matches: (name, cat) => {
      const n = norm(name)
      const isSastreriaName = [
        'macowens', 'giesso', 'christian lacroix', 'equus', 'devre', 'rochas', 'bowen',
        'azzaro', 'lord', 'garcon garcia', 'prototype', 'bensimon', 'brooksfield',
        'mancini', 'liguria', 'perramus', 'valenza', 'fiorani', 'modas gianni', 'sastreria'
      ].some(k => n.includes(k))
      return isSastreriaName
    }
  },

  // 2. LIBRERÍAS Y EDITORIALES
  {
    id: 'librerias',
    name: 'Librerías y Literatura',
    categoria: 'Librería',
    subcategoria: 'Libros y Literatura',
    productos: 'libro | libros | novela | novelas | best seller | comic | comics | manga | mangas | literatura | literatura infantil | autoayuda | ensayo | ensayos | ficcion | poesia | diccionario | diccionarios | enciclopedia | biografia | agenda | agendas | cuaderno | cuadernos | papelería | marcapaginas',
    matches: (name, cat) => {
      const n = norm(name)
      const c = norm(cat || '')
      if (c.includes('libreria') || c.includes('librería')) return true
      return [
        'cuspide', 'yenny', 'el ateneo', 'sbs', 'distal', 'losada', 'hernandez',
        'boutique del libro', 'antigona', 'waldhuter', 'eterna cadencia', 'atlantida',
        'libreria', 'libros', 'book', 'editorial'
      ].some(k => n.includes(k))
    }
  },

  // 3. JUGUETERÍAS Y DIDÁCTICOS
  {
    id: 'jugueterias',
    name: 'Jugueterías y Juegos Didácticos',
    categoria: 'Juguetería',
    subcategoria: 'Juegos y Juguetes',
    productos: 'rompecabezas | puzzle | puzzles | juego de mesa | juegos de mesa | cartas | muñeca | muñecas | autitos | bloques | lego | bloques de construccion | didacticos | peluche | peluches | masa | masas | slime | pistas de autos | metegol | rodados | andarines | triciclos | disfraces | juegos de ciencia | muñecos de accion',
    matches: (name, cat) => {
      const n = norm(name)
      const c = norm(cat || '')
      if (c.includes('jugueteria') || c.includes('juguetería')) return true
      return [
        'cebra', 'educando', 'giro didactico', 'citykids', 'el mundo del juguete',
        'creciendo', 'apioverde', 'apio verde', 'kinderland', 'tio mario',
        'compania de juguetes', 'jugueteria', 'juguete', 'toys', 'didactico'
      ].some(k => n.includes(k))
    }
  },

  // 4. DEPORTES Y ARTÍCULOS DEPORTIVOS
  {
    id: 'deportes',
    name: 'Deportes y Fútbol',
    categoria: 'Deportes',
    subcategoria: 'Indumentaria y Artículos Deportivos',
    productos: 'pelota | pelotas | futbol | balon | balones | botin | botines | zapatillas | zapatillas running | camiseta | camisetas | camiseta de futbol | short | shorts | calza | calzas | calza deportiva | campera deportiva | raqueta | raquetas | tenis | padel | basquet | guantes | guantes de arquero | canilleras | bolso deportivo | medias deportivas',
    matches: (name, cat) => {
      const n = norm(name)
      const c = norm(cat || '')
      if (c.includes('deporte')) return true
      return [
        'solo deportes', 'dexter', 'stockcenter', 'stock center', 'nike', 'adidas',
        'puma', 'sporting', 'open sports', 'cristobal colon', 'topper', 'under armour',
        'fila', 'umbro', 'penalty', 'le coq sportif', 'salomon', 'montagne', 'ansilta',
        'columbia', 'deportes', 'sport', 'futbol', 'tennis', 'padel'
      ].some(k => n.includes(k))
    }
  },

  // 5. CALZADO Y MARROQUINERÍA (CARTERAS, ZAPATOS)
  {
    id: 'marroquineria',
    name: 'Calzado y Marroquinería',
    categoria: 'Calzado y Marroquinería',
    subcategoria: 'Carteras, Bolsos y Zapatos',
    productos: 'cartera | carteras | bolso | bolsos | mochila | mochilas | billetera | billeteras | bandolera | bandoleras | sobre | sobres | valija | valijas | cinto | cintos | cinturón | cinturones | zapato | zapatos | bota | botas | borcego | borcegos | sandalia | sandalias | zapatilla | zapatillas | mocasin | mocasines | stiletto | chatitas',
    matches: (name, cat) => {
      const n = norm(name)
      return [
        'prune', 'blaque', 'lazaro', 'paruolo', 'grimoldi', 'ricky sarkany', 'sarkany',
        'hush puppies', 'briganti', 'xl extra large', 'tropea', 'jackie smith', 'mishka',
        'aldo', 'carla danelli', 'viamo', 'batistella', 'lucerna', 'lady stork', 'heyas',
        'clarks', 'marroquineria', 'calzados', 'zapatos'
      ].some(k => n.includes(k))
    }
  },

  // 6. INDUMENTARIA FEMENINA Y MODA
  {
    id: 'femenina',
    name: 'Indumentaria Femenina y Moda',
    categoria: 'Indumentaria Femenina',
    subcategoria: 'Moda y Fiesta',
    productos: 'vestido | vestidos | vestido de fiesta | pollera | polleras | falda | faldas | blazer | blazers | blusa | blusas | tapado | tapados | pantalon | pantalones | jean | jeans | sweater | sweaters | top | tops | campera | camperas | camisa | camisas | remeron | remerones | remera | remeras | solero | soleros | calzas',
    matches: (name, cat) => {
      const n = norm(name)
      return [
        'rapsodia', 'jazmin chebar', 'paula cahen d anvers', 'kosiuko', 'cher',
        'maria cher', 'portsaid', 'desiderata', 'vero alfie', 'uma', 'ayres',
        'clara ibarguren', 'tucci', 'system', 'yagmour', 'ver', 'vitamina', 'julien',
        'zhoue', 'sweet', 'akiabara', 'wanama', 'cook', 'las pepas', 'naima', 'ginebra'
      ].some(k => n.includes(k))
    }
  },

  // 7. INDUMENTARIA INFANTIL Y BEBÉS
  {
    id: 'infantil',
    name: 'Indumentaria Infantil y Bebés',
    categoria: 'Indumentaria Infantil',
    subcategoria: 'Bebés y Niños',
    productos: 'ropa de bebe | body | bodys | enterito | enteritos | remera infantil | pantalon infantil | buzo infantil | camperita | pijama infantil | medias de bebe | vestido de nena | calzado infantil | zapatillitas | babero | escarpines',
    matches: (name, cat) => {
      const n = norm(name)
      return [
        'cheeky', 'mimo', 'mimo & co', 'grisino', 'broer', 'pioppa', 'como quieres',
        'baby cottons', 'atomik', 'coony', 'pisa pizuela', 'tiempos de infancia', 'infantil', 'kids', 'baby'
      ].some(k => n.includes(k))
    }
  },

  // 8. INDUMENTARIA CASUAL Y URBANA GENERAL
  {
    id: 'casual',
    name: 'Indumentaria Casual y Urbana',
    categoria: 'Indumentaria',
    subcategoria: 'Moda Urbana y Casual',
    productos: 'jean | jeans | pantalon | pantalones | remera | remeras | buzo | buzos | campera | camperas | chomba | chombas | bermuda | bermudas | sweater | sweaters | camisa | camisas | chaleco | chalecos | abrigo | abrigos | campera de abrigo | cinto | cintos',
    matches: (name, cat) => {
      const n = norm(name)
      const c = norm(cat || '')
      if (c.includes('indumentaria')) return true
      return [
        'levis', 'levi', 'taverniti', 'mistral', 'chelsea', 'seven sport', 'top sport',
        'exit', 'vaqueria', 'legacy', 'wrangler', 'lee', 'bowen', 'narrow', 'kevingston',
        'tascani', 'quiksilver', 'billabong', 'rip curl', 'volcom', 'hang loose', 'rusty'
      ].some(k => n.includes(k))
    }
  },
]

async function main() {
  console.log('=== Iniciando Enriquecimiento de Taxonomía Retail ===\n')

  // Obtener todos los comercios activos que tengan defaultCategory o promos en rubros objetivo
  const commerces = await prisma.commerce.findMany({
    where: {
      active: true,
      OR: [
        { defaultCategory: { slug: { in: ['indumentaria', 'librerias', 'jugueterias', 'deportes'] } } },
        { promos: { some: { category: { slug: { in: ['indumentaria', 'librerias', 'jugueterias', 'deportes'] } } } } },
        { defaultCategoryId: null }
      ]
    },
    select: {
      id: true,
      name: true,
      defaultCategory: { select: { name: true, slug: true } },
      _count: { select: { products: true, promos: true } }
    }
  })

  console.log(`Comercios candidatos evaluados: ${commerces.length}`)

  let mappedCount = 0
  let rowsToInsert: { commerceId: string; categoria: string; subcategoria: string; productos: string; source: string }[] = []

  for (const commerce of commerces) {
    const catName = commerce.defaultCategory?.name
    // Buscar arquetipos que coincidan
    const matchedArchetypes = ARCHETYPES.filter(a => a.matches(commerce.name, catName))

    if (matchedArchetypes.length > 0) {
      mappedCount++
      for (const arch of matchedArchetypes) {
        rowsToInsert.push({
          commerceId: commerce.id,
          categoria: arch.categoria,
          subcategoria: arch.subcategoria,
          productos: arch.productos,
          source: 'retail-taxonomy'
        })
      }
    }
  }

  console.log(`Comercios clasificados con arquetipos: ${mappedCount}`)
  console.log(`Registros de taxonomía a generar: ${rowsToInsert.length}`)

  // Eliminar registros previos con source = 'retail-taxonomy' para ser idempotente
  const del = await prisma.commerceProduct.deleteMany({
    where: { source: 'retail-taxonomy' }
  })
  console.log(`Registros previos 'retail-taxonomy' eliminados: ${del.count}`)

  // Insertar en lotes
  const BATCH_SIZE = 250
  let inserted = 0
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE)
    const res = await prisma.commerceProduct.createMany({ data: batch })
    inserted += res.count
    process.stdout.write(`\rInsertados: ${inserted}/${rowsToInsert.length}`)
  }

  console.log(`\n\n✓ Inserción completada con éxito. Total filas creadas: ${inserted}`)

  // Reporte de validación sobre los términos clave
  const testTerms = ['corbata', 'saco', 'pantalon', 'libro', 'rompecabezas', 'pelota', 'botines', 'cartera']
  console.log('\n=== Verificación de términos clave en DB ===')
  for (const term of testTerms) {
    const count = await prisma.commerceProduct.count({
      where: {
        OR: [
          { productos: { contains: term, mode: 'insensitive' } },
          { subcategoria: { contains: term, mode: 'insensitive' } },
          { categoria: { contains: term, mode: 'insensitive' } }
        ]
      }
    })
    console.log(`- Término "${term}": ${count} registros asociados`)
  }
}

main()
  .catch(e => {
    console.error('Error durante enriquecimiento:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
