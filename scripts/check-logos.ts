// Audita logos de comercios: sin logo, favicon genérico de Google (roto) o URL caída.
// Genera logos-report.csv ordenado por cantidad de promos activas (desc).
// Uso: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/check-logos.ts
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { prisma } from '../lib/prisma'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

const CONCURRENCY = 20
const TIMEOUT_MS = 8000
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; PromoARLogoCheck/1.0)' }

type Row = { name: string; promos: number; logoUrl: string | null }
type Result = { name: string; promos: number; estado: string; url: string }

async function checkUrl(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: HEADERS,
      responseType: 'arraybuffer',
    })

    const isGoogleFavicon = url.includes('google.com/s2/favicons')
    const size = Number(res.headers['content-length'] ?? res.data?.length ?? 0)

    if (isGoogleFavicon && (res.status === 404 || size === 726)) {
      return 'Favicon genérico (roto)'
    }

    if (res.status >= 400) return `Roto (HTTP ${res.status})`

    if (url.startsWith('data:')) return 'Roto (data URI inválida)'

    // Algunos CDNs sirven imágenes con content-type genérico (octet-stream) — el
    // <img> las renderiza igual. Solo lo marcamos roto si claramente devolvió HTML (error).
    const contentType = String(res.headers['content-type'] ?? '')
    if (contentType.startsWith('text/html')) return `Roto (HTML, probable error: ${contentType})`

    return 'OK'
  } catch (e: any) {
    return `Roto (${e.code || e.message})`
  }
}

async function main() {
  const commerces = await prisma.commerce.findMany({
    where: { active: true },
    select: {
      name: true,
      logoUrl: true,
      _count: { select: { promos: { where: { status: 'ACTIVE' } } } },
    },
  })

  const rows: Row[] = commerces
    .filter(c => c._count.promos > 0)
    .map(c => ({ name: c.name, promos: c._count.promos, logoUrl: c.logoUrl }))
    .sort((a, b) => b.promos - a.promos)

  const results: Result[] = []
  let processed = 0

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (row): Promise<Result> => {
        if (!row.logoUrl) {
          return { name: row.name, promos: row.promos, estado: 'Sin logo', url: '' }
        }
        const estado = await checkUrl(row.logoUrl)
        return { name: row.name, promos: row.promos, estado, url: row.logoUrl }
      })
    )
    results.push(...batchResults)
    processed += batch.length
    process.stdout.write(`\rVerificando logos... ${processed}/${rows.length}`)
  }
  console.log('')

  const csvLines = [
    'Comercio,Promos,Estado Logo,URL',
    ...results.map(r => `"${r.name.replace(/"/g, '""')}",${r.promos},${r.estado},"${r.url.replace(/"/g, '""')}"`),
  ]
  const outPath = path.join(process.cwd(), 'logos-report-new.csv')
  fs.writeFileSync(outPath, csvLines.join('\n'), 'utf-8')

  const counts: Record<string, number> = {}
  for (const r of results) {
    const key = r.estado.startsWith('Roto') ? 'Roto' : r.estado
    counts[key] = (counts[key] ?? 0) + 1
  }
  console.log('Resumen:', counts)
  console.log('Guardado en', outPath)

  await prisma.$disconnect()
}

main().catch(console.error)
