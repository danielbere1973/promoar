/**
 * Calienta el caché de las páginas de detalle (/promos/[slug] y /comercios/[slug])
 * en producción, después de un revalidate:prod — para que el primer visitante real
 * (o el próximo crawl de Googlebot) encuentre un HIT en vez de disparar el miss que
 * revalidate:prod acaba de limpiar.
 *
 * Orden correcto de operación (ver también CLAUDE.md):
 *   scrapers -> npm run revalidate:prod -> npm run warm:prod
 *
 * A diferencia de la versión anterior (que pedía cada página por HTTP, 1 cada 12s
 * para no chocar con el rate-limit de bots de middleware.ts — más de un día para
 * recorrer todo), este script llama a POST /api/internal/warm-detail en tandas de
 * hasta 50 slugs. Ese endpoint es interno (auth Bearer, no pasa por el rate-limit de
 * bots) y llama DESDE ADENTRO de Next.js a las mismas funciones cacheadas que usan
 * las páginas (ver lib/cache/detailFetchers.ts) — sin HTTP de por medio, sin rate-limit.
 *
 * Uso:
 *   npm run warm:prod
 *   npm run warm:prod -- --dry-run          (solo imprime cuántas promos/comercios y el ETA)
 *   npm run warm:prod -- --limit=20         (probar con pocas)
 *   npm run warm:prod -- --type=promo       (solo promos, o --type=comercio)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROD_URL = 'https://www.promoar.com.ar'
const BATCH_SIZE = 50
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

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

async function getActivePromoSlugs(limit: number | null): Promise<string[]> {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', slug: { not: null } },
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
      const res = await fetch(`${PROD_URL}/api/internal/warm-detail`, {
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

async function main() {
  if (!SECRET) {
    console.error('ERROR: Falta VTEX_SESSION_SECRET en el .env')
    process.exit(1)
  }

  const dryRun = hasFlag('--dry-run')
  const limit = parseIntArg('--limit')
  const typeArg = parseStringArg('--type') // 'promo' | 'comercio' | null (ambos)

  const [promoSlugs, commerceSlugs] = await Promise.all([
    typeArg === 'comercio' ? Promise.resolve([]) : getActivePromoSlugs(limit),
    typeArg === 'promo' ? Promise.resolve([]) : getActiveCommerceSlugs(limit),
  ])

  const total = promoSlugs.length + commerceSlugs.length
  const totalBatches = Math.ceil(promoSlugs.length / BATCH_SIZE) + Math.ceil(commerceSlugs.length / BATCH_SIZE)
  // Estimación conservadora: cada tanda de 50 slugs, con concurrencia interna 5,
  // asumiendo ~300-500ms por query de Prisma -> ~3-5s por tanda.
  const etaSec = totalBatches * 4

  console.log(`Calentando ${PROD_URL} — ${promoSlugs.length} promos + ${commerceSlugs.length} comercios = ${total} slugs.`)
  console.log(`${totalBatches} tanda(s) de hasta ${BATCH_SIZE} slugs. ETA estimado: ~${etaSec}s (~${(etaSec / 60).toFixed(1)} min).`)

  if (dryRun) {
    console.log('\n--dry-run: no se llamó al endpoint.')
    await prisma.$disconnect()
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
  await prisma.$disconnect()
  if (totalErrors > 0) process.exit(1)
}

main().catch(e => {
  console.error('ERROR:', e.message)
  prisma.$disconnect().finally(() => process.exit(1))
})
