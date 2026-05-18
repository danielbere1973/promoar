import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const BATCH_SIZE = 30;

const CATEGORIAS = [
  'Supermercados', 'Combustible', 'Gastronomía', 'Farmacias', 'Indumentaria',
  'Tecnología', 'Mascotas', 'Transporte', 'Heladerías', 'Hogar',
  'Entretenimiento', 'Salud y Belleza', 'Deportes', 'Jugueterías',
  'Librerías', 'Viajes y Turismo', 'Shoppings', 'Automotores', 'Otros'
];

// ─── REGLAS LOCALES (rápido, sin API) ─────────────────────────────────────────
const CATEGORY_RULES = [
  { cat: 'Supermercados',    kw: ['coto', 'jumbo', 'disco', 'vea', 'carrefour', 'changomas', 'diarco', 'makro', 'dia', 'vital', 'supermercado'] },
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
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some(kw => text.includes(normStr(kw)))) {
      return catMap[rule.cat] ?? null;
    }
  }
  return null;
}

async function classifyWithGemini(
  batch: { id: string; comercio: string; titulo: string }[]
): Promise<Record<string, string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const lista = batch.map(p => `${p.id}|${p.comercio}|${p.titulo}`).join('\n');
  const prompt = `Clasificá cada comercio argentino en la categoría más adecuada.
Categorías: ${CATEGORIAS.join(', ')}
Respondé SOLO con JSON array sin texto adicional: [{"id":"...","categoria":"..."},...]
Datos (formato id|comercio|titulo):
${lista}`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    })
  });

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de Gemini');
  const results: { id: string; categoria: string }[] = JSON.parse(match[0]);
  return Object.fromEntries(results.map(r => [r.id, r.categoria]));
}

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession();
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

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

    let procesadasLocal = 0;
    const paraSendToAI: { id: string; comercio: string; titulo: string }[] = [];

    // Paso 1: reglas locales
    for (const p of promos) {
      const catId = classifyLocal(p.commerce.name, p.title, catMap);
      if (catId) {
        await prisma.promo.update({ where: { id: p.id }, data: { categoryId: catId } });
        procesadasLocal++;
      } else {
        paraSendToAI.push({ id: p.id, comercio: p.commerce.name, titulo: p.title });
      }
    }

    // Paso 2: Gemini para las que no matchearon
    let procesadasAI = 0;
    let erroresAI = 0;
    for (let i = 0; i < paraSendToAI.length; i += BATCH_SIZE) {
      const chunk = paraSendToAI.slice(i, i + BATCH_SIZE);
      try {
        const results = await classifyWithGemini(chunk);
        for (const [promoId, catNombre] of Object.entries(results)) {
          const catId = catMap[catNombre];
          if (catId && catId !== sinCat.id) {
            await prisma.promo.update({ where: { id: promoId }, data: { categoryId: catId } });
            procesadasAI++;
          }
        }
        if (i + BATCH_SIZE < paraSendToAI.length) await new Promise(r => setTimeout(r, 1100));
      } catch (e) {
        console.error(`[Classify] Error Gemini lote ${i}:`, e);
        erroresAI++;
      }
    }

    const procesadas = procesadasLocal + procesadasAI;
    console.log(`[Classify] Local: ${procesadasLocal} | Gemini: ${procesadasAI} | Errores: ${erroresAI}`);

    return NextResponse.json({
      message: `Clasificadas ${procesadas} de ${promos.length} promos`,
      procesadas,
      procesadasLocal,
      procesadasAI,
      enviadas: promos.length,
    });
  } catch (error: any) {
    console.error('[Classify]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
