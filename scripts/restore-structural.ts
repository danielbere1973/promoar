/**
 * Restaura la data estructural desde data/structural-backup.json
 * NO toca promos, usuarios ni suscripciones push.
 * Uso: npx tsx scripts/restore-structural.ts
 */
import { prisma } from '../lib/prisma'
import { readFileSync } from 'fs'
import { join } from 'path'

async function main() {
  const path = join(process.cwd(), 'data', 'structural-backup.json')
  const backup = JSON.parse(readFileSync(path, 'utf-8'))

  console.log(`Restaurando backup del ${backup.exportedAt}`)
  console.log('ATENCIÓN: esto pisa la data estructural existente. Los datos de promos, usuarios y suscripciones NO se tocan.')
  console.log('Empezando en 3 segundos...')
  await new Promise(r => setTimeout(r, 3000))

  // Orden de restauración respeta FK constraints

  // 1. Currencies y account types (sin dependencias)
  console.log('Currencies...')
  for (const c of backup.currencies) {
    await prisma.currency.upsert({ where: { id: c.id }, update: c, create: c })
  }

  console.log('Account types...')
  for (const a of backup.accountTypes) {
    await prisma.financialAccountType.upsert({ where: { id: a.id }, update: a, create: a })
  }

  // 2. Categorías
  console.log('Categorías...')
  for (const c of backup.categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c })
  }

  // 3. Redes de tarjeta (sin dependencias)
  console.log('Redes de tarjeta...')
  for (const n of backup.cardNetworks) {
    await prisma.cardNetwork.upsert({ where: { id: n.id }, update: n, create: n })
  }

  // 4. Card segments (dependen de cardNetwork)
  console.log('Card segments...')
  for (const s of backup.cardSegments) {
    await prisma.cardSegment.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // 5. Bancos
  console.log('Bancos...')
  for (const b of backup.banks) {
    await prisma.bank.upsert({ where: { id: b.id }, update: b, create: b })
  }

  // 6. Bank segments (dependen de bank)
  console.log('Bank segments...')
  for (const s of backup.bankSegments) {
    await prisma.bankSegment.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // 7. Billeteras
  console.log('Billeteras...')
  for (const w of backup.wallets) {
    await prisma.wallet.upsert({ where: { id: w.id }, update: w, create: w })
  }

  // 8. Comercios
  console.log(`Comercios (${backup.commerces.length})...`)
  for (const c of backup.commerces) {
    await prisma.commerce.upsert({ where: { id: c.id }, update: c, create: c })
  }

  // 9. Commerce aliases
  console.log('Commerce aliases...')
  for (const a of backup.commerceAliases) {
    await (prisma.commerceAlias as any).upsert({ where: { id: a.id }, update: a, create: a })
  }

  // 10. Scraper schedules
  console.log('Scraper schedules...')
  for (const s of backup.scraperSchedules) {
    await prisma.scraperSchedule.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // 11. Join tables (limpiar y reinsertar)
  console.log('Join tables...')
  await prisma.$executeRaw`DELETE FROM "_BankToCardNetwork"`
  for (const row of backup.joins.bankToCardNetwork) {
    await prisma.$executeRaw`INSERT INTO "_BankToCardNetwork" ("A","B") VALUES (${row.A}, ${row.B}) ON CONFLICT DO NOTHING`
  }
  console.log(`  BankToCardNetwork: ${backup.joins.bankToCardNetwork.length} filas`)

  await prisma.$executeRaw`DELETE FROM "_BankToCardSegment"`
  for (const row of backup.joins.bankToCardSegment) {
    await prisma.$executeRaw`INSERT INTO "_BankToCardSegment" ("A","B") VALUES (${row.A}, ${row.B}) ON CONFLICT DO NOTHING`
  }
  console.log(`  BankToCardSegment: ${backup.joins.bankToCardSegment.length} filas`)

  await prisma.$executeRaw`DELETE FROM "_WalletToCardNetwork"`
  for (const row of backup.joins.walletToCardNetwork) {
    await prisma.$executeRaw`INSERT INTO "_WalletToCardNetwork" ("A","B") VALUES (${row.A}, ${row.B}) ON CONFLICT DO NOTHING`
  }
  console.log(`  WalletToCardNetwork: ${backup.joins.walletToCardNetwork.length} filas`)

  console.log('✓ Restauración completa.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
