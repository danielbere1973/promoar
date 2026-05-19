import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectCategoria } from '@/lib/scrapers/bank-helpers';

const CATEGORIAS = [
  'Supermercados', 'Combustible', 'Gastronomía', 'Farmacias', 'Indumentaria',
  'Tecnología', 'Mascotas', 'Transporte', 'Heladerías', 'Hogar',
  'Entretenimiento', 'Salud y Belleza', 'Deportes', 'Jugueterías',
  'Librerías', 'Viajes y Turismo', 'Shoppings', 'Automotores', 'Otros',
];

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
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some(kw => text.includes(normStr(kw)))) return catMap[rule.cat] ?? null;
  }
  const detected = detectCategoria(`${comercio} ${titulo}`);
  if (detected && catMap[detected]) return catMap[detected];
  return null;
}

async function classifyWithGroq(batch: { id: string; comercio: string }[]): Promise<Record<string, string>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const lista = batch.map(p => `${p.id}|${p.comercio}`).join('\n');
  const prompt = `Clasificá estos comercios argentinos. Respondé SOLO con JSON array: [{"id":"...","categoria":"..."},...]
Categorías: ${CATEGORIAS.join(', ')}
Datos (id|comercio):
${lista}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Respuesta inválida de Groq: ${text.slice(0, 200)}`);
  const results: { id: string; categoria: string }[] = JSON.parse(match[0]);
  return Object.fromEntries(results.map(r => [r.id, r.categoria]));
}

export async function POST(_req: NextRequest) {
  try {
    const allCategories = await prisma.category.findMany();
    const sinCat = allCategories.find(c => c.slug === 'sin-categoria');
    if (!sinCat) return NextResponse.json({ error: 'sin-categoria no encontrada' }, { status: 400 });

    const catMap = Object.fromEntries(allCategories.map(c => [c.name, c.id]));

    const promos = await prisma.promo.findMany({
      where: { categoryId: sinCat.id, status: 'ACTIVE' },
      include: { commerce: { select: { id: true, name: true, defaultCategoryId: true } } },
      take: 200,
    });

    if (promos.length === 0) {
      return NextResponse.json({ message: 'No hay promos sin categoría', procesadas: 0, enviadas: 0 });
    }

    let procesadasKeyword = 0;
    let procesadasDefault = 0;
    let procesadasGroq = 0;
    let erroresGroq = 0;
    const paraGroq: { id: string; comercio: string; commerceId: string }[] = [];

    // Nivel 1: keywords locales + detectCategoria
    // Nivel 2: defaultCategoryId del comercio
    for (const p of promos) {
      const catId = classifyLocal(p.commerce.name, p.title, catMap);
      if (catId) {
        await prisma.promo.update({ where: { id: p.id }, data: { categoryId: catId } });
        procesadasKeyword++;
        continue;
      }
      const defCatId = (p.commerce as any).defaultCategoryId;
      if (defCatId && defCatId !== sinCat.id) {
        await prisma.promo.update({ where: { id: p.id }, data: { categoryId: defCatId } });
        procesadasDefault++;
        continue;
      }
      paraGroq.push({ id: p.id, comercio: p.commerce.name, commerceId: p.commerce.id });
    }

    // Nivel 3: Groq — un request por comercio único, de a 20
    if (paraGroq.length > 0 && process.env.GROQ_API_KEY) {
      const vistos = new Set<string>();
      const comerciosUnicos = paraGroq.filter(p => {
        if (vistos.has(p.commerceId)) return false;
        vistos.add(p.commerceId);
        return true;
      });

      const GROQ_BATCH = 10;
      const allResults: Record<string, string> = {};

      for (let i = 0; i < comerciosUnicos.length; i += GROQ_BATCH) {
        const chunk = comerciosUnicos.slice(i, i + GROQ_BATCH);
        try {
          const res = await classifyWithGroq(chunk);
          Object.assign(allResults, res);
          if (i + GROQ_BATCH < comerciosUnicos.length) await new Promise(r => setTimeout(r, 12000));
        } catch (e) {
          console.error(`[Classify] Error Groq lote ${i}:`, e);
          erroresGroq++;
        }
      }

      // Construir mapa commerceId → categoryId y guardar aprendizaje
      const commerceCatMap: Record<string, string> = {};
      for (const item of comerciosUnicos) {
        const catNombre = allResults[item.id];
        const catId = catNombre ? catMap[catNombre] : null;
        if (catId && catId !== sinCat.id) {
          commerceCatMap[item.commerceId] = catId;
          await (prisma.commerce as any).update({
            where: { id: item.commerceId },
            data: { defaultCategoryId: catId },
          });
        }
      }

      // Aplicar a todas las promos de esos comercios
      for (const p of paraGroq) {
        const catId = commerceCatMap[p.commerceId];
        if (catId) {
          await prisma.promo.update({ where: { id: p.id }, data: { categoryId: catId } });
          procesadasGroq++;
        }
      }
    }

    const procesadas = procesadasKeyword + procesadasDefault + procesadasGroq;
    console.log(`[Classify] Keywords: ${procesadasKeyword} | Default: ${procesadasDefault} | Groq: ${procesadasGroq} | Errores: ${erroresGroq} | Total: ${procesadas}/${promos.length}`);

    return NextResponse.json({
      message: `Clasificadas ${procesadas} de ${promos.length} (keywords: ${procesadasKeyword}, aprendidas: ${procesadasDefault}, Groq: ${procesadasGroq})`,
      procesadas,
      procesadasKeyword,
      procesadasDefault,
      procesadasGroq,
      enviadas: promos.length,
    });
  } catch (error: any) {
    console.error('[Classify]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
