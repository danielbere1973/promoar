/**
 * Exporta la data estructural de la DB a data/structural-backup.json
 * Correr después de cualquier configuración manual importante.
 * Uso: npx tsx scripts/backup-structural.ts
 */
import { prisma } from '../lib/prisma'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

async function main() {
  console.log('Exportando data estructural...')

  const [
    banks,
    wallets,
    cardNetworks,
    cardSegments,
    bankSegments,
    categories,
    commerces,
    commerceAliases,
    currencies,
    accountTypes,
    scraperSchedules,
    bankToCardNetwork,
    bankToCardSegment,
    walletToCardNetwork,
  ] = await Promise.all([
    prisma.bank.findMany({ orderBy: { name: 'asc' } }),
    prisma.wallet.findMany({ orderBy: { name: 'asc' } }),
    prisma.cardNetwork.findMany({ orderBy: { name: 'asc' } }),
    prisma.cardSegment.findMany({ orderBy: { name: 'asc' } }),
    prisma.bankSegment.findMany({ orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.commerce.findMany({ orderBy: { name: 'asc' }, select: {
      id: true, name: true, slug: true, logoUrl: true, website: true,
      defaultCategoryId: true, active: true, activePromoCount: true,
    }}),
    (prisma.commerceAlias as any).findMany({ orderBy: { alias: 'asc' } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
    prisma.financialAccountType.findMany({ orderBy: { name: 'asc' } }),
    prisma.scraperSchedule.findMany({ orderBy: { scraperId: 'asc' } }),
    prisma.$queryRaw<{ A: string; B: string }[]>`SELECT "A", "B" FROM "_BankToCardNetwork"`,
    prisma.$queryRaw<{ A: string; B: string }[]>`SELECT "A", "B" FROM "_BankToCardSegment"`,
    prisma.$queryRaw<{ A: string; B: string }[]>`SELECT "A", "B" FROM "_WalletToCardNetwork"`,
  ])

  const backup = {
    exportedAt: new Date().toISOString(),
    banks,
    wallets,
    cardNetworks,
    cardSegments,
    bankSegments,
    categories,
    commerces,
    commerceAliases,
    currencies,
    accountTypes,
    scraperSchedules,
    joins: {
      bankToCardNetwork,
      bankToCardSegment,
      walletToCardNetwork,
    },
  }

  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  const outPath = join(process.cwd(), 'data', 'structural-backup.json')
  writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf-8')

  console.log(`✓ Backup guardado en data/structural-backup.json`)
  console.log(`  Bancos: ${banks.length}`)
  console.log(`  Billeteras: ${wallets.length}`)
  console.log(`  Redes de tarjeta: ${cardNetworks.length}`)
  console.log(`  Segmentos (CardSegment): ${cardSegments.length}`)
  console.log(`  Segmentos (BankSegment): ${bankSegments.length}`)
  console.log(`  Categorías: ${categories.length}`)
  console.log(`  Comercios: ${commerces.length}`)
  console.log(`  Aliases: ${commerceAliases.length}`)
  console.log(`  BankToCardNetwork: ${bankToCardNetwork.length} filas`)
  console.log(`  BankToCardSegment: ${bankToCardSegment.length} filas`)
  console.log(`  WalletToCardNetwork: ${walletToCardNetwork.length} filas`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
