import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── DICCIONARIO DE REGLAS ──────────────────────────────────────────────────
// Si alguna de las palabras clave aparece en el nombre del comercio o en el
// título de la promoción, se asignará a esa categoría.
const CATEGORY_RULES = [
  {
    categoryName: 'Supermercados',
    keywords: ['coto', 'jumbo', 'disco', 'vea', 'carrefour', 'changomas', 'diarco', 'makro', 'dia', 'vital', 'supermercado', 'supermercados']
  },
  {
    categoryName: 'Combustible',
    keywords: ['ypf', 'axion', 'shell', 'puma', 'gulf', 'estacion de servicio', 'combustible', 'nafta']
  },
  {
    categoryName: 'Gastronomía',
    keywords: ['mcdonald', 'burger king', 'mostaza', 'starbucks', 'cafe', 'havanna', 'restaurant', 'pizzeria', 'cerveceria', 'kfc', 'subway', 'sushi', 'cafeteria', 'kentucky', 'wendy']
  },
  {
    categoryName: 'Heladerías',
    keywords: ['grido', 'freddo', 'lucciano', 'persicco', 'volta', 'chungo', 'daniel', 'heladeria', 'helado']
  },
  {
    categoryName: 'Farmacias',
    keywords: ['farmacity', 'pigmento', 'farmacia', 'farma', 'vantage', 'dr. ahorro', 'dr ahorro', 'simplicity']
  },
  {
    categoryName: 'Indumentaria',
    keywords: ['zara', 'nike', 'adidas', 'puma', 'dexter', 'moov', 'dafiti', 'grid', 'macowens', 'indumentaria', 'ropa', 'zapatillas', 'grimoldi', 'xl', 'tucci', 'ver', 'equus']
  },
  {
    categoryName: 'Tecnología',
    keywords: ['fravega', 'musimundo', 'cetrogar', 'megatone', 'samsung', 'motorola', 'apple', 'macstation', 'tecnologia', 'electro']
  },
  {
    categoryName: 'Hogar',
    keywords: ['easy', 'sodimac', 'blaisten', 'sommier', 'colchon', 'mueble', 'pintureria', 'ferreteria', 'bazar', 'arredo']
  },
  {
    categoryName: 'Mascotas',
    keywords: ['puppis', 'pet shop', 'veterinaria', 'mascota', 'natural life', 'purina']
  },
  {
    categoryName: 'Entretenimiento',
    keywords: ['cine', 'hoyts', 'cinemark', 'showcase', 'teatro', 'entrada', 'espectaculo', 'multiplex']
  },
  {
    categoryName: 'Viajes y Turismo',
    keywords: ['aerolineas', 'despegar', 'almundo', 'turismo', 'viaje', 'hotel', 'vuelo', 'flybondi', 'jetsmart', 'cabanas']
  }
];

function normalizeStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function main() {
  console.log('🚀 Iniciando Categorizador Local (Zero-Cost)...');

  const allCategories = await prisma.category.findMany();
  
  // Obtener IDs de las categorías origen ("Sin Categoría", "Varios", etc.)
  const targetCategories = allCategories.filter(c => {
    const nameNorm = normalizeStr(c.name);
    return nameNorm === 'sin categoria' || nameNorm === 'otros' || nameNorm === 'varios' || c.slug === 'sin-categoria';
  });
  const targetIds = targetCategories.map(c => c.id);

  if (targetIds.length === 0) {
    console.log('⚠️ No se encontraron categorías comodín ("Sin categoría") en la base de datos.');
    return;
  }

  // Buscar promociones huérfanas
  const promosToClassify = await prisma.promo.findMany({
    where: { categoryId: { in: targetIds } },
    include: { commerce: true }
  });

  console.log(`📦 Se encontraron ${promosToClassify.length} promos para clasificar.`);
  if (promosToClassify.length === 0) return;

  let procesadas = 0;

  // Procesar cada promoción contra nuestras reglas
  for (const promo of promosToClassify) {
    const searchText = normalizeStr(`${promo.commerce?.name || ''} ${promo.title}`);
    let matchedCategoryId: string | null = null;
    let categoryFoundName = '';

    // Buscar coincidencia en el diccionario
    for (const rule of CATEGORY_RULES) {
      const isMatch = rule.keywords.some(kw => searchText.includes(normalizeStr(kw)));
      if (isMatch) {
        const dbCategory = allCategories.find(c => normalizeStr(c.name) === normalizeStr(rule.categoryName));
        if (dbCategory) {
          matchedCategoryId = dbCategory.id;
          categoryFoundName = dbCategory.name;
          break; // Detener en la primera coincidencia
        }
      }
    }

    if (matchedCategoryId) {
      await prisma.promo.update({
        where: { id: promo.id },
        data: { categoryId: matchedCategoryId }
      });
      console.log(`✅ [EXITO] "${promo.commerce?.name}" -> asignado a: ${categoryFoundName}`);
      procesadas++;
    }
  }

  console.log(`✨ Proceso completado. Se categorizaron automáticamente ${procesadas} promos de ${promosToClassify.length}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());