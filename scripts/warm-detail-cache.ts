/**
 * Calienta el caché de las páginas de detalle (/promos/[slug] y /comercios/[slug])
 * en producción, después de un revalidate:prod — para que el primer visitante real
 * (o el próximo crawl de Googlebot) encuentre un HIT en vez de disparar el miss que
 * revalidate:prod acaba de limpiar.
 *
 * Orden correcto de operación (ver también CLAUDE.md):
 *   scrapers -> npm run revalidate:prod -> npm run warm:prod
 *
 * MODO POR DEFECTO: POST /api/internal/warm-detail en tandas de hasta 50 slugs.
 * Ver "Warm proactivo de /api/internal/warm-detail — ABANDONADO" en CLAUDE.md:
 * lo que este endpoint escribe (llamando desde ADENTRO de Next.js a las mismas
 * funciones cacheadas que usan las páginas, lib/cache/detailFetchers.ts) nunca
 * se confirmó que sea lo que la página real lee después — el cache-miss volvía a
 * aparecer en los logs al visitar la página aunque el warm hubiera "corrido bien".
 * Se deja este modo sin borrar (no hace daño, solo no tiene efecto comprobado).
 *
 * MODO --http-get (NUEVO, recomendado): en vez de pegarle al endpoint interno,
 * hace GET real a las URLs públicas (/promos/<slug>, /comercios/<slug>) — el
 * mismo camino exacto que sigue un visitante o Googlebot. Esto sí garantiza que
 * se llena la entrada de caché que la página realmente lee, porque ES la página
 * la que se está pidiendo. Respeta el rate-limit de middleware.ts
 * (RATE_LIMITED_PREFIXES incluye /promos/ y /comercios/, límite 60/min con UA de
 * navegador) con concurrencia baja y pausa entre tandas — point hecho explícito,
 * no correrlo con --dry-run.
 *
 * La lista de slugs a calentar se pide por HTTP a GET /api/internal/warm-detail
 * (mismo Bearer) en vez de abrir una conexión Prisma propia — así el script corre
 * igual en local o en GitHub Actions sin necesitar DATABASE_URL como secret de CI
 * (ver .github/workflows/warm-detail-cache.yml y la nota en CLAUDE.md). Esto vale
 * para ambos modos: --http-get solo cambia CÓMO se calienta cada slug, no de
 * dónde sale la lista.
 *
 * Uso (modo endpoint interno, el de siempre):
 *   npm run warm:prod
 *   npm run warm:prod -- --dry-run          (solo imprime cuántas promos/comercios y el ETA)
 *   npm run warm:prod -- --limit=20         (probar con pocas)
 *   npm run warm:prod -- --type=promo       (solo promos, o --type=comercio)
 *   npm run warm:prod -- --only-commerces   (atajo de --type=comercio, pensado para
 *                                            auditar/calentar solo el universo de
 *                                            comercios tras el cambio de criterio
 *                                            a paridad con sitemap.ts, 27/11/2026)
 *
 * Uso (modo HTTP GET real a las páginas públicas):
 *   npm run warm:prod -- --http-get --limit=200
 *   npm run warm:prod -- --http-get --limit=200 --offset=200   (siguiente tanda, otro día)
 *   npm run warm:prod -- --http-get --type=promo --limit=500 --offset=1000
 *   npm run warm:prod -- --http-get --only-commerces --limit=500
 *   npm run warm:prod -- --http-get --base-url=http://localhost:3000 --limit=5  (smoke test local)
 *
 * Repartir en varios días con --offset: el orden de slugs es determinístico
 * (mismo ORDER BY en /api/internal/warm-detail cada vez que se pide la lista
 * completa sin --limit/--offset del lado del endpoint — ver ese route.ts), así
 * que correr --limit=200 --offset=0, después --limit=200 --offset=200, etc.
 * en días sucesivos cubre el universo completo sin repetir ni saltear slugs,
 * siempre que no cambie el total de filas entre una corrida y la siguiente
 * (si se insertan/borran promos/comercios en el medio, el orden puede correrse
 * levemente — no es grave, en el peor caso se repite o se saltea algún slug
 * suelto en el borde de la tanda, no el conjunto completo).
 */
import 'dotenv/config'

const DEFAULT_PROD_URL = 'https://www.promoar.com.ar'
const BATCH_SIZE = 50
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

// --http-get: concurrencia baja + pausa entre tandas para quedar muy por
// debajo de RATE_LIMIT_BROWSER_MAX=60/min de middleware.ts (prefix /promos/
// y /comercios/ están en RATE_LIMITED_PREFIXES). Con concurrencia 3 y 1.5s de
// pausa entre tandas, el ritmo efectivo es ~3 req / 1.5s = ~120/min en el pico
// de la tanda, pero la pausa entre tandas baja el promedio real bien por debajo
// de 60/min sostenido — igual se manda un UA de navegador real para no caer en
// la clasificación de bot (límite 6/min, mucho más fácil de pisar).
const HTTP_GET_CONCURRENCY = 3
const HTTP_GET_BATCH_PAUSE_MS = 1500
const HTTP_GET_SLOW_THRESHOLD_MS = 1500
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Mismo patrón de carga/normalización de secret que scripts/revalidate-prod.ts
const RAW_SECRET = process.env.VTEX_SESSION_SECRET
const SECRET = RAW_SECRET?.trim().replace(/^['"]|['"]$/g, '')

function parseIntArg(flag: string): number | null {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`))
  if (!arg) return null
  const n = parseInt(arg.slice(flag.length + 1), 10)
  return Number.isFinite(n) ? n : null
}

function parseStringArg(flag: string): string | null {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`))
  return arg ? arg.slice(flag.length + 1).trim() : null
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

// --only-commerces es un atajo de --type=comercio (gana si ambos se pasan,
// aunque no tiene sentido combinarlos) — pensado para auditar/calentar solo
// el universo de comercios después del cambio de criterio a paridad con
// sitemap.ts, sin tener que recordar la forma exacta de --type=.
export function resolveTypeArg(): 'promo' | 'comercio' | null {
  if (hasFlag('--only-commerces')) return 'comercio'
  const typeArg = parseStringArg('--type')
  return typeArg === 'promo' || typeArg === 'comercio' ? typeArg : null
}

async function getSlugList(baseUrl: string, type: 'promo' | 'comercio', limit: number | null, offset: number | null): Promise<string[]> {
  const params = new URLSearchParams({ type })
  if (limit) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))
  const res = await fetch(`${baseUrl}/api/internal/warm-detail?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${SECRET}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`No se pudo obtener la lista de slugs (${type}): HTTP ${res.status} — ${text.slice(0, 300)}`)
  }
  const data = await res.json() as { slugs: string[] }
  // Orden determinístico de nuestro lado, por si el endpoint no garantiza un
  // ORDER BY estable — así --offset es confiable aunque el endpoint cambie.
  return [...data.slugs].sort()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

type WarmDetailResponse = { ok: boolean; requested: number; warmed: number; notFound: number; errors: number; ms: number }

async function warmBatch(type: 'promo' | 'comercio', slugs: string[]): Promise<WarmDetailResponse> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${DEFAULT_PROD_URL}/api/internal/warm-detail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SECRET}`,
        },
        body: JSON.stringify({ type, slugs }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`)
      }
      return await res.json()
    } catch (error: any) {
      lastError = error
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS)
    }
  }
  throw lastError
}

async function warmAll(label: string, type: 'promo' | 'comercio', slugs: string[]): Promise<{ warmed: number; notFound: number; errors: number }> {
  const batches = chunk(slugs, BATCH_SIZE)
  console.log(`\n${label}: ${slugs.length} slugs en ${batches.length} tanda(s) de hasta ${BATCH_SIZE}...`)

  let warmed = 0
  let notFound = 0
  let errors = 0
  const t0 = Date.now()

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    try {
      const result = await warmBatch(type, batch)
      warmed += result.warmed
      notFound += result.notFound
      errors += result.errors
      console.log(`  [${i + 1}/${batches.length}] ${batch.length} slugs -> warmed=${result.warmed} notFound=${result.notFound} errors=${result.errors} (${result.ms}ms)`)
    } catch (error: any) {
      errors += batch.length
      console.error(`  [${i + 1}/${batches.length}] FALLÓ tras ${MAX_RETRIES + 1} intentos: ${error.message}`)
    }
  }

  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`${label} — resumen: ${warmed} warmed / ${notFound} notFound / ${errors} errores (${elapsedS}s)`)
  return { warmed, notFound, errors }
}

// ---------------------------------------------------------------------------
// Modo --http-get: GET real a las páginas públicas
// ---------------------------------------------------------------------------

type HttpGetResult = { slug: string; path: string; status: number | null; ms: number; error?: string }

async function fetchOne(baseUrl: string, kind: 'promo' | 'comercio', slug: string): Promise<HttpGetResult> {
  const path = kind === 'promo' ? `/promos/${slug}` : `/comercios/${slug}`
  const t0 = Date.now()
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      redirect: 'follow',
    })
    // Se descarta el body — alcanza con que el servidor termine de renderizar
    // la página (lo que dispara/llena la entrada de caché), no hace falta leer
    // el HTML completo.
    await res.arrayBuffer()
    return { slug, path, status: res.status, ms: Date.now() - t0 }
  } catch (error: any) {
    return { slug, path, status: null, ms: Date.now() - t0, error: error.message }
  }
}

// Concurrencia fija (2-3, ver HTTP_GET_CONCURRENCY) con pausa entre tandas —
// nunca dispara más requests en simultáneo que ese número.
async function warmViaHttpGet(
  baseUrl: string,
  items: Array<{ kind: 'promo' | 'comercio'; slug: string }>,
): Promise<HttpGetResult[]> {
  const results: HttpGetResult[] = []
  const batches = chunk(items, HTTP_GET_CONCURRENCY)

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const batchResults = await Promise.all(batch.map(item => fetchOne(baseUrl, item.kind, item.slug)))
    results.push(...batchResults)

    for (const r of batchResults) {
      const tag = r.error ? `ERROR (${r.error})` : `${r.status}${r.ms >= HTTP_GET_SLOW_THRESHOLD_MS ? ' LENTA' : ''}`
      console.log(`  [${results.length}/${items.length}] ${r.path} -> ${tag} (${r.ms}ms)`)
    }

    if (i < batches.length - 1) await sleep(HTTP_GET_BATCH_PAUSE_MS)
  }

  return results
}

async function runHttpGetMode() {
  const baseUrl = (parseStringArg('--base-url') || DEFAULT_PROD_URL).replace(/\/$/, '')
  const limit = parseIntArg('--limit')
  const offset = parseIntArg('--offset') ?? 0
  const typeArg = resolveTypeArg() // 'promo' | 'comercio' | null (ambos)

  console.log(`Modo --http-get: GET real a páginas públicas de ${baseUrl}`)
  console.log(`Concurrencia=${HTTP_GET_CONCURRENCY}, pausa entre tandas=${HTTP_GET_BATCH_PAUSE_MS}ms, umbral lenta=${HTTP_GET_SLOW_THRESHOLD_MS}ms`)

  // Siempre se pide la lista completa (sin --limit al endpoint): el orden
  // determinístico + el slice de --offset/--limit los hace este script, no
  // el endpoint — así --offset es confiable entre corridas separadas.
  const [promoSlugs, commerceSlugs] = await Promise.all([
    typeArg === 'comercio' ? Promise.resolve([]) : getSlugList(baseUrl, 'promo', null, null),
    typeArg === 'promo' ? Promise.resolve([]) : getSlugList(baseUrl, 'comercio', null, null),
  ])

  // Un solo universo ordenado (promos primero, luego comercios, cada grupo ya
  // ordenado alfabéticamente por getSlugList) para que --offset/--limit corten
  // de forma predecible a través de ambos tipos en la misma corrida.
  const universe: Array<{ kind: 'promo' | 'comercio'; slug: string }> = [
    ...promoSlugs.map(slug => ({ kind: 'promo' as const, slug })),
    ...commerceSlugs.map(slug => ({ kind: 'comercio' as const, slug })),
  ]

  const sliceEnd = limit ? offset + limit : universe.length
  const items = universe.slice(offset, sliceEnd)

  console.log(`Universo total: ${universe.length} slugs (${promoSlugs.length} promos + ${commerceSlugs.length} comercios).`)
  console.log(`Tanda de esta corrida: offset=${offset}, limit=${limit ?? '(sin límite, hasta el final)'} -> ${items.length} slugs a pedir.`)

  if (items.length === 0) {
    console.log('\nNada que hacer con ese offset/limit (¿offset mayor que el universo total?).')
    return
  }

  if (hasFlag('--dry-run')) {
    console.log('\n--dry-run: no se pidió ninguna URL.')
    return
  }

  const t0 = Date.now()
  const results = await warmViaHttpGet(baseUrl, items)
  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1)

  const ok200 = results.filter(r => r.status === 200).length
  const slow = results.filter(r => r.ms >= HTTP_GET_SLOW_THRESHOLD_MS).length
  const failed = results.filter(r => r.status === null || r.status >= 400).length

  console.log(`\nResumen --http-get:`)
  console.log(`  Total pedidas: ${results.length}`)
  console.log(`  200 OK: ${ok200}`)
  console.log(`  Lentas (>=${HTTP_GET_SLOW_THRESHOLD_MS}ms): ${slow}`)
  console.log(`  Fallidas (error o status>=400): ${failed}`)
  console.log(`  Tiempo total: ${elapsedS}s (~${(Number(elapsedS) / 60).toFixed(1)} min)`)

  if (offset + items.length < universe.length) {
    const nextOffset = offset + items.length
    console.log(`\nPara continuar otro día desde donde quedó:`)
    console.log(`  npm run warm:prod -- --http-get --limit=${limit ?? items.length} --offset=${nextOffset}`)
    console.log(`  (quedan ${universe.length - nextOffset} slugs sin pedir en esta tanda)`)
  } else {
    console.log('\nEste fue el final del universo de slugs — no queda nada después de este offset.')
  }

  if (failed > 0) process.exit(1)
}

// ---------------------------------------------------------------------------
// Modo por defecto: POST /api/internal/warm-detail
// ---------------------------------------------------------------------------

async function runInternalEndpointMode() {
  const dryRun = hasFlag('--dry-run')
  const limit = parseIntArg('--limit')
  const typeArg = resolveTypeArg() // 'promo' | 'comercio' | null (ambos)
  const baseUrl = DEFAULT_PROD_URL

  const [promoSlugs, commerceSlugs] = await Promise.all([
    typeArg === 'comercio' ? Promise.resolve([]) : getSlugList(baseUrl, 'promo', limit, null),
    typeArg === 'promo' ? Promise.resolve([]) : getSlugList(baseUrl, 'comercio', limit, null),
  ])

  const total = promoSlugs.length + commerceSlugs.length
  const totalBatches = Math.ceil(promoSlugs.length / BATCH_SIZE) + Math.ceil(commerceSlugs.length / BATCH_SIZE)
  // Estimación conservadora: cada tanda de 50 slugs, con concurrencia interna 5
  // dentro del endpoint, asumiendo ~300-500ms por query de Prisma -> ~3-5s por tanda.
  const etaSec = totalBatches * 4

  console.log(`Calentando ${baseUrl} — ${promoSlugs.length} promos + ${commerceSlugs.length} comercios = ${total} slugs.`)
  console.log(`${totalBatches} tanda(s) de hasta ${BATCH_SIZE} slugs. ETA estimado: ~${etaSec}s (~${(etaSec / 60).toFixed(1)} min).`)

  if (dryRun) {
    console.log('\n--dry-run: no se llamó al endpoint.')
    return
  }

  let totalErrors = 0
  if (promoSlugs.length) {
    const r = await warmAll('Promos', 'promo', promoSlugs)
    totalErrors += r.errors
  }
  if (commerceSlugs.length) {
    const r = await warmAll('Comercios', 'comercio', commerceSlugs)
    totalErrors += r.errors
  }

  console.log(totalErrors > 0 ? `\nTerminado con ${totalErrors} errores.` : '\nListo, sin errores.')
  if (totalErrors > 0) process.exit(1)
}

async function main() {
  if (!SECRET) {
    console.error('ERROR: Falta VTEX_SESSION_SECRET en el .env')
    process.exit(1)
  }

  if (hasFlag('--http-get')) {
    await runHttpGetMode()
  } else {
    await runInternalEndpointMode()
  }
}

main().catch(e => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
