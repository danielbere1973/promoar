import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = '' }
      else { current += char }
    }
    values.push(current.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function main() {
  const csvPath = path.join(process.cwd(), 'unicenter-locales.csv')
  const rows = parseCSV(csvPath).filter(r => r.instagram && r.instagram.includes('instagram.com'))

  console.log(`Filas con Instagram en CSV: ${rows.length}`)

  const commerces = await prisma.commerce.findMany({ select: { id: true, name: true } })
  const commerceMap = new Map(commerces.map(c => [normalize(c.name), c.id]))

  let updated = 0
  let notFound = 0

  for (const row of rows) {
    const key = normalize(row.nombre)
    const id = commerceMap.get(key)
    if (!id) {
      notFound++
      continue
    }
    await prisma.commerce.update({
      where: { id },
      data: { instagramUrl: row.instagram },
    })
    console.log(`✓ ${row.nombre} → ${row.instagram}`)
    updated++
  }

  console.log(`\nActualizados: ${updated} | No encontrados: ${notFound}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
