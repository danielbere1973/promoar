import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import "dotenv/config";

const prisma = new PrismaClient();

// Inicializar el cliente de Gemini usando la clave de tu archivo .env
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

async function main() {
  if (!API_KEY) {
    console.error("❌ Error: No se encontró la variable GEMINI_API_KEY en el archivo .env");
    return;
  }

  console.log("🤖 Iniciando Motor de Clasificación con Gemini 1.5 Flash...");

  // 1. Obtener todas las categorías válidas de tu base de datos
  const allCategories = await prisma.category.findMany();
  
  // Filtramos las categorías "basura" o comodín de las que queremos sacar las promos
  const targetCategories = allCategories.filter(c => {
    const nameNorm = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return nameNorm === 'sin categoria' || nameNorm === 'otros' || nameNorm === 'varios' || c.slug === 'sin-categoria';
  });
  
  console.log(`🎯 Categorías a vaciar encontradas en DB: ${targetCategories.map(c => c.name).join(', ') || 'NINGUNA'}`);
  const targetIds = targetCategories.map(c => c.id);

  // -------------------------------------------------------------------------
  // DEBUGGER: Ver a qué host nos estamos conectando realmente
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^/:]+)/)?.[1] || 'Desconocido';
  console.log(`\n🔌 Conectado a PostgreSQL en el host: ${dbHost}`);

  // DEBUGGER: Verificar totales de la base de datos a la que estamos conectados
  const totalDbPromos = await prisma.promo.count();
  console.log(`\n📊 STATS DE LA BASE DE DATOS (Total de promos en la DB: ${totalDbPromos})`);
  for (const cat of targetCategories) {
    const count = await prisma.promo.count({ where: { categoryId: cat.id } });
    console.log(`   - Categoría "${cat.name}": ${count} promos encontradas`);
  }
  console.log('-----------------------------------------------------------\n');

  // Nos quedamos con los nombres de las categorías válidas para dárselos de menú a la IA
  const validCategoryNames = allCategories
    .filter(c => !targetIds.includes(c.id))
    .map(c => c.name);

  // 2. Buscar TODAS las promos sin clasificar de una vez
  const promosToClassify = await prisma.promo.findMany({
    where: { categoryId: { in: targetIds } },
    include: { commerce: true }
  });

  console.log(`📦 Encontradas ${promosToClassify.length} promos para clasificar.`);
  if (promosToClassify.length === 0) return;

  // DEBUG: Consultar y mostrar qué modelos están realmente disponibles para tu API Key
  try {
    const req = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const res = await req.json();
    console.log(`🤖 Modelos disponibles en tu cuenta: ${res.models?.map((m: any) => m.name.replace('models/', '')).join(', ')}`);
  } catch (e) { /* ignorar error de red */ }

  // 3. Inicializar el modelo pidiendo formato JSON estricto
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash", // 2.0-flash tiene un límite gratis mucho más generoso (1500 por día)
    generationConfig: { responseMimeType: "application/json" }
  });

  let procesadas = 0;
  const CHUNK_SIZE = 20; // Procesar de a 20 promos a la vez

  // 4. Procesar por lotes (Batch)
  for (let i = 0; i < promosToClassify.length; i += CHUNK_SIZE) {
    const chunk = promosToClassify.slice(i, i + CHUNK_SIZE);
    console.log(`\n⏳ Procesando lote de ${chunk.length} promociones...`);

    const prompt = `
      Actúa como un categorizador automático. Clasifica las siguientes promociones en UNA de estas categorías:
      [${validCategoryNames.join(', ')}]

      Promociones a clasificar:
      ${chunk.map(p => `ID: ${p.id} | Título: "${p.title}" | Comercio: "${p.commerce?.name || 'Desconocido'}"`).join('\n')}

      Devuelve ESTRICTAMENTE un arreglo JSON con el siguiente formato, sin texto adicional:
      [ { "id": "id_de_la_promo", "categoria": "Nombre Exacto de la Categoría Elegida" } ]
    `;

    try {
      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      const jsonResponse = JSON.parse(textResponse);

      for (const item of jsonResponse) {
        const matchedCategory = allCategories.find(c => c.name.toLowerCase() === item.categoria.toLowerCase());
        const originalPromo = chunk.find(p => p.id === item.id);
        
        if (matchedCategory && originalPromo) {
          await prisma.promo.update({ where: { id: item.id }, data: { categoryId: matchedCategory.id } });
          console.log(`✅ [EXITO] "${originalPromo.title}" -> asignada a: ${matchedCategory.name}`);
          procesadas++;
        } else {
          console.log(`⚠️ [FALLO] IA devolvió categoría "${item.categoria}" no válida para promo ${item.id}`);
        }
      }
      
      // Pausa de 4 segundos entre lotes para no ahogar la capa gratuita (15 reqs/min de Gemini)
      await new Promise(r => setTimeout(r, 4000));
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('429') || error?.status === 429) {
        console.log(`\n⏳ Límite de la API alcanzado (429). Pausando por 30 segundos antes de reintentar este lote...`);
        await new Promise(r => setTimeout(r, 30000));
        i -= CHUNK_SIZE; // Retroceder el índice para que en el próximo ciclo vuelva a agarrar el mismo chunk
      } else {
        console.error(`❌ Error procesando el lote:`, errorMsg);
      }
    }
  }
  console.log(`✨ Proceso de clasificación completado. Se procesaron ${procesadas} promos.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());