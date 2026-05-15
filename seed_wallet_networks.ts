import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const wallets = await prisma.wallet.findMany()
  const networks = await prisma.cardNetwork.findMany()
  
  const visa = networks.find(n => n.name.toLowerCase().includes('visa'))
  const mc = networks.find(n => n.name.toLowerCase().includes('mastercard') || n.name.toLowerCase() === 'master')
  const cabal = networks.find(n => n.name.toLowerCase().includes('cabal'))

  console.log('Available Networks:', networks.map(n => n.name).join(', '))
  console.log('Existing Wallets:', wallets.map(w => w.name).join(', '))

  const walletMapping: Record<string, string[]> = {
    'Mercado Pago': [mc?.id].filter(Boolean) as string[],
    'Ualá': [mc?.id].filter(Boolean) as string[],
    'Personal Pay': [visa?.id].filter(Boolean) as string[],
    'Cuenta DNI': [visa?.id, mc?.id].filter(Boolean) as string[], // Banco Provincia issues Visa/MC
    'Naranja X': [visa?.id].filter(Boolean) as string[], // Visa
    'BUEPP': [visa?.id].filter(Boolean) as string[], // Banco Ciudad Visa
    'YOY': [mc?.id].filter(Boolean) as string[], // ICBC Mastercard
    'MODO': [visa?.id, mc?.id, cabal?.id].filter(Boolean) as string[], // MODO soporta todas
  }

  for (const wallet of wallets) {
    const networkIds = walletMapping[wallet.name]
    if (networkIds && networkIds.length > 0) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          cardNetworks: {
            connect: networkIds.map(id => ({ id }))
          }
        }
      })
      console.log(`Updated ${wallet.name} with ${networkIds.length} networks`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
