/**
 * Calienta el caché de las páginas de detalle (/promos/[slug] y /comercios/[slug])
 * en producción, pidiéndolas una por una después de un revalidate:prod — para que el
 * primer visitante real (o el próximo crawl de Googlebot) encuentre un HIT en vez de
 * disparar la query de Prisma que generó el miss original.
 *
 * Orden correcto de operación (ver también CLAUDE.md):
 *   scrapers -> npm run revalidate:prod -> npm run warm:prod
 *
 * Importante sobre el rate-limit (middleware.ts):
 * Este script no tiene User-Agent de navegador (no lo falseamos — ni real ni de
 * Googlebot), así que middleware.ts lo clasifica como "bot no identificado":
 * RATE_LIMIT_BOT_MAX = 6 requests/min por IP, con ban de 5 minutos si se excede.
 * Por eso el script NO corre con concurrencia real ni ráfagas: pacea cada request
 * para quedar bien por debajo de ese límite (default: 1 request cada 3s = 20/min...
 * en los hechos, con margen de seguridad, bajamos a 1 cada 12s = 5/min, por debajo
 * de las 6/min permitidas). No existe manera de "subir la concurrencia" sin
 * arriesgarse al ban — si se necesita calentar más rápido, la solución correcta es
 * ampliar una allowlist en el middleware para este script (IP o header interno), no
 * bypassear el límite desde aquí.
 *
 * Uso:
 *   npm run warm:prod
 *   npm run warm:prod -- --limit=50       (solo probar con las primeras 50 de cada tipo)
 *   npm run warm:prod -- --only=promos    (solo promos, o --only=comercios)
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const PROD_URL = 'https://www.promoar.com.ar'

// Pacing: 1 request cada WARM_DELAY_MS, muy por debajo del límite de bots del
// middleware (6/min). 12s -> 5/min con margen.
const WARM_DELAY_MS = 12_000

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

async function getActivePromoSlugs(limit: number | null): Promise<string[]> {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true },
    orderBy: { updatedAt: 'desc' },
    take: limit ?? undefined,
  })
  return promos.map(p => p.slug).filter((s): s is string => !!s)
}

async function getActiveCommerceSlugs(limit: number | null): Promise<string[]> {
  const commerces = await prisma.commerce.findMany({
    where: { activePromoCount: { gt: 0 } },
    select: { slug: true },
    orderBy: { activePromoCount: 'desc' },
    take: limit ?? undefined,
  })
  return commerces.map(c => c.slug).filter((s): s is string => !!s)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type WarmResult = { slug: string; status: number | 'error'; cacheState: string }

async function warmUrl(url: string): Promise<WarmResult> {
  const slug = url.split('/').filter(Boolean).pop() ?? url
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const cacheState = res.headers.get('x-vercel-cache') ?? 'unknown'
    return { slug, status: res.status, cacheState }
  } catch (error: any) {
    console.error(`  [error] ${slug}: ${error.message}`)
    return { slug, status: 'error', cacheState: 'n/a' }
  }
}

async function warmAll(label: string, path: string, slugs: string[]): Promise<void> {
  console.log(`\n${label}: ${slugs.length} páginas a calentar (pacing ${WARM_DELAY_MS / 1000}s entre requests)...`)
  let ok200 = 0
  let errors = 0
  let hits = 0
  let misses = 0

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    const result = await warmUrl(`${PROD_URL}${path}/${slug}`)

    if (result.status === 200) ok200++
    else errors++
    if (result.cacheState === 'HIT') hits++
    else if (result.cacheState === 'MISS') misses++

    const progress = `[${i + 1}/${slugs.length}]`
    console.log(`  ${progress} ${result.slug} -> ${result.status} (x-vercel-cache: ${result.cacheState})`)

    if (i < slugs.length - 1) await sleep(WARM_DELAY_MS)
  }

  console.log(`${label} — resumen: ${ok200} OK / ${errors} errores / ${hits} HIT / ${misses} MISS (de ${slugs.length})`)
}

async function main() {
  const limit = parseIntArg('--limit')
  const only = parseStringArg('--only') // 'promos' | 'comercios' | null (ambos)

  const [promoSlugs, commerceSlugs] = await Promise.all([
    only === 'comercios' ? Promise.resolve([]) : getActivePromoSlugs(limit),
    only === 'promos' ? Promise.resolve([]) : getActiveCommerceSlugs(limit),
  ])

  const total = promoSlugs.length + commerceSlugs.length
  const etaMin = Math.ceil((total * WARM_DELAY_MS) / 60_000)
  console.log(`Calentando ${PROD_URL} — ${promoSlugs.length} promos + ${commerceSlugs.length} comercios = ${total} páginas.`)
  console.log(`Estimado: ~${etaMin} min a ${WARM_DELAY_MS / 1000}s por request.`)

  if (promoSlugs.length) await warmAll('Promos', '/promos', promoSlugs)
  if (commerceSlugs.length) await warmAll('Comercios', '/comercios', commerceSlugs)

  console.log('\nListo.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error('ERROR:', e.message)
    prisma.$disconnect().finally(() => process.exit(1))
  })
