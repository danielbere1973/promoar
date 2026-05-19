import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectCategoria } from '@/lib/scrapers/bank-helpers';



// ─── REGLAS LOCALES (rápido, sin API) ─────────────────────────────────────────
const CATEGORY_RULES = [
  { cat: 'Supermercados',    kw: ['coto', 'jumbo', 'disco', 'vea', 'carrefour', 'changomas', 'diarco', 'makro', 'dia', 'vital', 'supermercado', 'la gallega', 'gallega', 'supercoop', 'supers del interior', 'cooperativa', 'bell', 'toledo', 'josimar', 'nini', 'anonima', 'yaguar'] },
  { cat: 'Combustible',      kw: ['ypf', 'axion', 'shell', 'puma', 'gulf', 'combustible', 'nafta', 'petro'] },
  { cat: 'Gastronomía',      kw: ['mcdonald', 'burger', 'mostaza', 'starbucks', 'cafe', 'havanna', 'restaurant', 'pizzeria', 'cerveceria', 'kfc', 'subway', 'sushi', 'cafeteria'] },
  { cat: 'Heladerías',       kw: ['grido', 'freddo', 'lucciano', 'persicco', 'volta', 'chungo', 'heladeria'] },
  { cat: 'Farmacias',        kw: ['farmacity', 'farmacia', 'farma', 'vantage', 'dr ahorro', 'simplicity'] },
  { cat: 'Indumentaria',     kw: ['zara', 'nike', 'adidas', 'dafiti', 'macowens', 'indumentaria', 'ropa', 'zapatillas', 'grimoldi', 'tucci', 'equus'] },
  { cat: 'Tecnología',       kw: ['fravega', 'musimundo', 'cetrogar', 'megatone', 'samsung', 'apple', 'tecnologia', 'electro', 'garbarino'] },
  { cat: 'Hogar',            kw: ['easy', 'sodimac', 'blaisten', 'colchon', 'mueble', 'pintureria', 'ferreteria', 'bazar'] },
  { cat: 'Mascotas',         kw: ['puppis', 'petshop', 'veterinaria', 'mascota', 'purina'] },
  { cat: 'Entretenimiento',  kw: ['cine', 'hoyts', 'cinemark', 'showcase', 'teatro', 'entrada', 'multiplex'] },
  { cat: 'Viajes y Turismo', kw: ['aerolineas', 'despegar', 'almundo', 'turismo', 'viaje', 'hotel', 'vuelo', 'flybondi', 'jetsmart'] },
];

function normStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function classifyLocal(comercio: string, titulo: string, catMap: Record<string, string>): string | null {
  const text = normStr(`${comercio} ${titulo}`);
  // 1. Keywords simples
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some(kw => text.includes(normStr(kw)))) {
      return catMap[rule.cat] ?? null;
    }
  }
  // 2. detectCategoria (más completo)
  const detected = detectCategoria(`${comercio} ${titulo}`);
  if (detected && catMap[detected]) return catMap[detected];
  return null;
}


export async function POST(_req: NextRequest) {
  try {
    const allCategories = await prisma.category.findMany();
    const sinCat = allCategories.find(c => c.slug === 'sin-categoria');
    if (!sinCat) return NextResponse.json({ error: 'sin-categoria no encontrada' }, { status: 400 });

    const catMap = Object.fromEntries(allCategories.map(c => [c.name, c.id]));

    const promos = await prisma.promo.findMany({
      where: { categoryId: sinCat.id, status: 'ACTIVE' },
      include: { commerce: true },
      take: 200,
    });

    if (promos.length === 0) {
      return NextResponse.json({ message: 'No hay promos sin categoría', procesadas: 0, enviadas: 0 });
    }

    let procesadas = 0;

    for (const p of promos) {
      const catId = classifyLocal(p.commerce.name, p.title, catMap);
      if (catId) {
        await prisma.promo.update({ where: { id: p.id }, data: { categoryId: catId } });
        procesadas++;
      }
    }

    console.log(`[Classify] Local: ${procesadas}/${promos.length}`);

    return NextResponse.json({
      message: `Clasificadas ${procesadas} de ${promos.length} promos`,
      procesadas,
      enviadas: promos.length,
    });
  } catch (error: any) {
    console.error('[Classify]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
