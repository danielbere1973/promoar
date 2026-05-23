import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';

const prisma = new PrismaClient();

// ─── DICCIONARIO DE REGLAS LOCALES ─────────────────────────────────────────
const CATEGORY_RULES = [
  { categoryName: 'Supermercados', keywords: ['coto', 'jumbo', 'disco', 'vea', 'carrefour', 'changomas', 'diarco', 'makro', 'dia', 'vital', 'supermercado', 'supermercados'] },
  { categoryName: 'Combustible', keywords: ['ypf', 'axion', 'shell', 'puma', 'gulf', 'estacion de servicio', 'combustible', 'nafta'] },
  { categoryName: 'Gastronomía', keywords: ['mcdonald', 'burger king', 'mostaza', 'starbucks', 'cafe', 'havanna', 'restaurant', 'pizzeria', 'cerveceria', 'kfc', 'subway', 'sushi', 'cafeteria', 'kentucky', 'wendy'] },
  { categoryName: 'Heladerías', keywords: ['grido', 'freddo', 'lucciano', 'persicco', 'volta', 'chungo', 'daniel', 'heladeria', 'helado'] },
  { categoryName: 'Farmacias', keywords: ['farmacity', 'pigmento', 'farmacia', 'farma', 'vantage', 'dr. ahorro', 'dr ahorro', 'simplicity'] },
  { categoryName: 'Indumentaria', keywords: ['zara', 'nike', 'adidas', 'puma', 'dexter', 'moov', 'dafiti', 'grid', 'macowens', 'indumentaria', 'ropa', 'zapatillas', 'grimoldi', 'xl', 'tucci', 'ver', 'equus'] },
  { categoryName: 'Tecnología', keywords: ['fravega', 'musimundo', 'cetrogar', 'megatone', 'samsung', 'motorola', 'apple', 'macstation', 'tecnologia', 'electro'] },
  { categoryName: 'Hogar', keywords: ['easy', 'sodimac', 'blaisten', 'sommier', 'colchon', 'mueble', 'pintureria', 'ferreteria', 'bazar', 'arredo'] },
  { categoryName: 'Mascotas', keywords: ['puppis', 'pet shop', 'veterinaria', 'mascota', 'natural life', 'purina'] },
  { categoryName: 'Entretenimiento', keywords: ['cine', 'hoyts', 'cinemark', 'showcase', 'teatro', 'entrada', 'espectaculo', 'multiplex'] },
  { categoryName: 'Viajes y Turismo', keywords: ['aerolineas', 'despegar', 'almundo', 'turismo', 'viaje', 'hotel', 'vuelo', 'flybondi', 'jetsmart', 'cabanas'] }
];

function normalizeStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de seguridad
    const session = await getServerSession();
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 2. Obtener categorías "comodín"
    const allCategories = await prisma.category.findMany();
    const targetCategories = allCategories.filter(c => {
      const nameNorm = normalizeStr(c.name);
      return nameNorm === 'sin categoria' || nameNorm === 'otros' || nameNorm === 'varios' || c.slug === 'sin-categoria';
    });
    const targetIds = targetCategories.map(c => c.id);
    
    // 3. Traer un lote grande (200) ya que la CPU lo procesa en milisegundos
    const promosToClassify = await prisma.promo.findMany({
      where: { categoryId: { in: targetIds } },
      include: { commerce: true },
      take: 200
    });

    if (promosToClassify.length === 0) {
      return NextResponse.json({ message: 'No hay promociones pendientes de clasificación', procesadas: 0, enviadas: 0 });
    }

    // 4. Clasificar localmente comparando palabras clave
    let procesadas = 0;
    for (const promo of promosToClassify) {
      const searchText = normalizeStr(`${promo.commerce?.name || ''} ${promo.title}`);
      let matchedCategoryId: string | null = null;

      for (const rule of CATEGORY_RULES) {
        const isMatch = rule.keywords.some(kw => searchText.includes(normalizeStr(kw)));
        if (isMatch) {
          const dbCategory = allCategories.find(c => normalizeStr(c.name) === normalizeStr(rule.categoryName));
          if (dbCategory) {
            matchedCategoryId = dbCategory.id;
            break;
          }
        }
      }

      if (matchedCategoryId) {
        await prisma.promo.update({ where: { id: promo.id }, data: { categoryId: matchedCategoryId } });
        procesadas++;
      }
    }

    return NextResponse.json({ message: 'Clasificación completada', procesadas, enviadas: promosToClassify.length });
  } catch (error: any) {
    console.error('Error en API de clasificación:', error);
    return NextResponse.json({ error: 'Error interno en clasificación' }, { status: 500 });
  }
}