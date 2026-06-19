import { prisma } from '../lib/prisma'

async function main() {
  console.log('Verificando tablas de join...')

  // Chequear cuáles faltan
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '\_%' ESCAPE '\'
  `
  const existing = new Set(tables.map(t => t.table_name))
  console.log('Tablas de join existentes:', [...existing])

  if (!existing.has('_BankToCardNetwork')) {
    console.log('Creando _BankToCardNetwork...')
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_BankToCardNetwork" (
        "A" STRING NOT NULL,
        "B" STRING NOT NULL,
        CONSTRAINT "_BankToCardNetwork_pkey" PRIMARY KEY ("A","B"),
        INDEX "_BankToCardNetwork_B_index" ("B"),
        CONSTRAINT "_BankToCardNetwork_A_fkey" FOREIGN KEY ("A") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "_BankToCardNetwork_B_fkey" FOREIGN KEY ("B") REFERENCES "card_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `
    console.log('✓ _BankToCardNetwork creada')
  }

  if (!existing.has('_BankToCardSegment')) {
    console.log('Creando _BankToCardSegment...')
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_BankToCardSegment" (
        "A" STRING NOT NULL,
        "B" STRING NOT NULL,
        CONSTRAINT "_BankToCardSegment_pkey" PRIMARY KEY ("A","B"),
        INDEX "_BankToCardSegment_B_index" ("B"),
        CONSTRAINT "_BankToCardSegment_A_fkey" FOREIGN KEY ("A") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "_BankToCardSegment_B_fkey" FOREIGN KEY ("B") REFERENCES "card_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `
    console.log('✓ _BankToCardSegment creada')
  }

  if (!existing.has('_WalletToCardNetwork')) {
    console.log('Creando _WalletToCardNetwork...')
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_WalletToCardNetwork" (
        "A" STRING NOT NULL,
        "B" STRING NOT NULL,
        CONSTRAINT "_WalletToCardNetwork_pkey" PRIMARY KEY ("A","B"),
        INDEX "_WalletToCardNetwork_B_index" ("B"),
        CONSTRAINT "_WalletToCardNetwork_A_fkey" FOREIGN KEY ("A") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "_WalletToCardNetwork_B_fkey" FOREIGN KEY ("B") REFERENCES "card_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `
    console.log('✓ _WalletToCardNetwork creada')
  }

  // Verificar cuántos bancos tenemos
  const bankCount = await prisma.bank.count()
  console.log(`Bancos en DB: ${bankCount}`)
  console.log('Listo.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
