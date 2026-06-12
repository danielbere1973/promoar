// Limpia logoUrl de comercios cuyo logo está roto (data URI inválida, HTTP 4xx/5xx,
// o favicon genérico de Google) según logos-faltantes.csv generado por check-logos.ts.
// Los deja en null para que aparezcan en el panel admin de "logos faltantes" y se
// curen manualmente con una URL real.
// Uso: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/fix-broken-logos.ts
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++ }
      else q = !q
    } else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

const NULLABLE_PREFIXES = ['Sin logo', 'Roto (HTTP 4', 'Roto (HTTP 5', 'Roto (data URI', 'Favicon genérico']

async function main() {
  const csvPath = path.join(process.cwd(), 'logos-faltantes.csv')
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(Boolean).slice(1)
  const rows = lines.map(parseCsvLine).map(([name, promos, estado]) => ({ name, estado }))

  const toNull = rows.filter(r => NULLABLE_PREFIXES.some(p => r.estado.startsWith(p)) && r.estado !== 'Sin logo')

  let updated = 0
  for (const row of toNull) {
    const res = await prisma.commerce.updateMany({
      where: { name: row.name, logoUrl: { not: null } },
      data: { logoUrl: null },
    })
    updated += res.count
  }

  console.log(`Comercios con logo roto detectados: ${toNull.length}`)
  console.log(`logoUrl puesto en null: ${updated}`)

  await prisma.$disconnect()
}

main().catch(console.error)
