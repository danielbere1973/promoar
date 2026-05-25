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
  { cat: 'Supermercados',    kw: ['coto', 'jumbo', 'disco', 'vea', 'carrefour', 'changomas', 'diarco', 'makro', 'dia online', 'supermercado', 'la gallega', 'gallega', 'supercoop', 'supers del interior', 'bell\'s', 'bells', 'toledo', 'josimar', 'nini', 'anonima', 'yaguar', 'hipermaxi', 'almacen', 'despensa'] },
  // Combustible: SOLO estaciones de servicio — marcas de autos (honda, ford) NO van aquí
  { cat: 'Combustible',      kw: ['ypf', 'axion', 'shell', 'puma energy', 'gulf energy', 'wico', 'estacion de servicio', 'surtidor', 'petrobras', 'petro rio', 'combustible', 'nafta premium', 'serviclub'] },
  { cat: 'Gastronomía',      kw: ['mcdonald', 'burger king', 'mostaza', 'starbucks', 'havanna', 'restaurant', 'pizzeria', 'cerveceria', 'kfc', 'subway', 'sushi', 'cafeteria', 'parrilla', 'rotiseria', 'comida', 'delivery', 'rappi', 'pedidosya', 'menuclass', 'wendy'] },
  { cat: 'Heladerías',       kw: ['grido', 'freddo', 'lucciano', 'persicco', 'volta', 'chungo', 'heladeria', 'cremolatti', 'amorino'] },
  { cat: 'Farmacias',        kw: ['farmacity', 'farmacia', 'dr ahorro', 'vantage', 'farmared', 'drogueria', 'botica'] },
  { cat: 'Indumentaria',     kw: ['zara', 'nike', 'adidas', 'puma', 'dafiti', 'macowens', 'ropa', 'zapatillas', 'grimoldi', 'tucci', 'equus', 'portsaid', 'wanama', 'kosiuko', 'vitamina', 'rapsodia', 'bensimon', 'mimo', 'cheeky', 'grisino', 'off corss', 'cardon', 'lacoste', 'topper', 'umbro', 'levi', 'legacy', 'save my bag', 'louise louise', 'batistella', 'etiqueta negra', 'hering', 'importados'] },
  // Deportes: sin 'sport' solo (demasiado amplio) y sin 'bicicleta' solo (conflicto con bicicleta electrica en Transporte)
  { cat: 'Deportes',         kw: ['decathlon', 'arsenal', 'dexter', 'montagne', 'lippi', 'oxbow', 'sportline', 'padel', 'fitness', 'gimnasio', 'running', 'camping', 'trekking', 'natacion', 'columbia', 'timberland', 'quechua', 'ciclismo', 'alpinismo'] },
  { cat: 'Tecnología',       kw: ['fravega', 'musimundo', 'cetrogar', 'megatone', 'samsung', 'apple', 'electro', 'garbarino', 'compumundo', 'digitaltek', 'movistar tienda', 'personal shop', 'claro shop', 'pc factory', 'notebook', 'celular', 'iphone', 'tablet', 'tv led'] },
  { cat: 'Hogar',            kw: ['easy', 'sodimac', 'blaisten', 'colchon', 'mueble', 'pintureria', 'ferreteria', 'bazar', 'el hogar', 'falabella', 'ikea', 'linio hogar'] },
  { cat: 'Mascotas',         kw: ['puppis', 'petshop', 'veterinaria', 'mascota', 'purina', 'barf', 'agropecuaria'] },
  { cat: 'Entretenimiento',  kw: ['cine', 'hoyts', 'cinemark', 'showcase', 'teatro', 'entrada', 'multiplex', 'ticket', 'disney', 'netflix', 'spotify', 'xbox', 'playstation', 'steam', 'gaming'] },
  { cat: 'Salud y Belleza',  kw: ['perfumeria', 'natura', 'avon', 'loreal', 'estetica', 'peluqueria', 'spa', 'clinica', 'optica', 'dental', 'arcos', 'derma', 'cosmetica'] },
  { cat: 'Viajes y Turismo', kw: ['aerolineas', 'despegar', 'almundo', 'turismo', 'hotel', 'vuelo', 'flybondi', 'jetsmart', 'booking', 'airbnb', 'latam', 'aeropuerto', 'hostel', 'crucero'] },
  // Automotores: solo términos inequívocamente automotrices (concesionarias, repuestos, 0km)
  // Las marcas de autos sin calificador se omiten para evitar falsos positivos
  { cat: 'Automotores',      kw: ['concesionaria', '0km', 'cero km', 'repuesto automotor', 'taller mecanico', 'gomeria', 'patentamiento', 'volkswagen', 'ford dealer', 'nissan dealer', 'jeep dealer', 'hyundai dealer', 'peugeot 0km', 'renault 0km', 'toyota 0km', 'chevrolet 0km', 'fiat 0km', 'honda 0km', 'audi dealer', 'bmw dealer', 'volvo dealer'] },
  // Transporte: movilidad urbana — 'moto' solo es demasiado amplio (Motorola, etc.), usar solo compuestos
  { cat: 'Transporte',       kw: ['uber', 'cabify', 'taxi', 'sube', 'peaje', 'autopista', 'estacionamiento', 'parking', 'pedido ya moto', 'rappi moto', 'bicicleta electrica', 'scooter electrico', 'patineta'] },
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
  const prompt = `Sos un experto en comercios argentinos. Clasificá cada comercio en UNA de las categorías de la lista.

CATEGORÍAS DISPONIBLES: ${CATEGORIAS.join(', ')}

REGLAS IMPORTANTES — leé con atención antes de clasificar:
- "Combustible" = EXCLUSIVAMENTE estaciones de servicio que venden nafta/diesel: YPF, Shell, Axion, Puma Energy, Gulf. NADA MÁS va a Combustible.
- "Automotores" = concesionarias, compraventa de vehículos 0km, repuestos de autos, talleres mecánicos, gomería, patentamiento.
- "Transporte" = movilidad urbana: Uber, Cabify, taxi, SUBE, peajes, estacionamiento. NO incluye autos ni motos de venta.
- "Indumentaria" = ropa, zapatillas, accesorios de moda (Puma, Nike, Adidas, Zara, etc.)
- "Tecnología" = electrónica, celulares, computadoras, electrodomésticos
- "Hogar" = muebles, decoración, ferretería, pinturería
- "Gastronomía" = restaurantes, cafés, delivery, fast food
- "Salud y Belleza" = peluquerías, cosméticos, ópticas, spa
- "Otros" = si genuinamente no encaja en ninguna categoría

ERRORES COMUNES A EVITAR — estos son los más frecuentes:
- Puma (ropa deportiva) → Indumentaria, NO Combustible
- Ford, Toyota, Honda, Renault, Fiat sin contexto de venta → Otros o Automotores (NO Combustible)
- Fravega, Garbarino, Megatone → Tecnología (NO Hogar)
- Rappi, PedidosYa → Gastronomía (NO Transporte)
- Booking, Airbnb → Viajes y Turismo (NO Hogar)
- Movistar, Personal, Claro → Tecnología (NO Entretenimiento)

Respondé SOLO con un JSON array sin texto adicional:
[{"id":"...","categoria":"..."},...]

Datos a clasificar (id|comercio):
${lista}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      max_tokens: 2048,
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
