import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Logos directos (favicon.ico verificado)
const DIRECT_LOGOS: Record<string, string> = {
  'BBVA':              'https://www.bbva.com.ar/favicon.ico',
  'Banco Credicoop':   'https://www.bancocredicoop.coop/favicon.ico',
  'American Express':  'https://www.americanexpress.com/favicon.ico',
  'Banco Provincia':   'https://www.bancoprovincia.com.ar/favicon.ico',
  'Banco Ciudad':      'https://www.bancociudad.com.ar/favicon.ico',
}

const BANK_DOMAINS: Record<string, string> = {}
const WALLET_DOMAINS: Record<string, string> = {}

// Comercios con dominio conocido para probar favicon
const COMMERCE_DOMAINS: Record<string, string> = {
  // Supermercados
  'Jumbo':           'jumbo.com.ar',
  'Coto':            'coto.com.ar',
  'Carrefour':       'carrefour.com.ar',
  'Disco':           'disco.com.ar',
  'Vea':             'vea.com.ar',
  'Changomas':       'changomas.com.ar',
  'Walmart':         'walmart.com.ar',
  'La Anónima':      'la-anonima.com.ar',
  'DIA':             'dia.com.ar',
  // Gastronomía
  'McDonald\'s':     'mcdonalds.com.ar',
  'Burger King':     'burgerking.com.ar',
  'Mostaza':         'mostaza.com.ar',
  'Starbucks':       'starbucks.com.ar',
  'Rappi':           'rappi.com',
  'PedidosYa':       'pedidosya.com',
  // Heladerías
  'Freddo':          'freddo.com.ar',
  'Grido':           'grido.com.ar',
  'Chungo':          'chungo.com.ar',
  // Farmacia
  'Farmacity':       'farmacity.com',
  // Combustible
  'YPF':             'ypf.com',
  'Shell':           'shell.com.ar',
  'Axion':           'axionenergy.com',
  // Tecnología
  'Garbarino':       'garbarino.com',
  'Fravega':         'fravega.com',
  'Musimundo':       'musimundo.com',
  // Indumentaria
  'Zara':            'zara.com',
  // Viajes
  'Despegar':        'despegar.com',
  'Almundo':         'almundo.com',
  // Deportes
  'Decathlon':       'decathlon.com.ar',
  // Hogar
  'Easy':            'easy.com.ar',
  'Sodimac':         'sodimac.com.ar',
  // Entretenimiento
  'Ticketek':        'ticketek.com.ar',
  // Mascotas
  'Petco':           'petco.com.ar',
}

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    // Google devuelve un PNG genérico de ~870 bytes cuando no encuentra el logo — lo filtramos
    const buf = await res.arrayBuffer()
    return buf.byteLength > 1000
  } catch {
    return false
  }
}

async function main() {
  console.log('🔍 Cargando logos directos...')
  for (const [name, url] of Object.entries(DIRECT_LOGOS)) {
    await prisma.bank.updateMany({ where: { name }, data: { logoUrl: url } })
    console.log(`  ✅ ${name}`)
  }

  console.log('\n🔍 Actualizando logos de bancos...')
  for (const [name, domain] of Object.entries(BANK_DOMAINS)) {
    const url = faviconUrl(domain)
    const ok = await checkUrl(url)
    if (ok) {
      await prisma.bank.updateMany({ where: { name }, data: { logoUrl: url } })
      console.log(`  ✅ ${name}`)
    } else {
      console.log(`  ❌ ${name} → sin logo reconocible`)
    }
  }

  console.log('\n🔍 Actualizando logos de billeteras...')
  for (const [name, domain] of Object.entries(WALLET_DOMAINS)) {
    const url = faviconUrl(domain)
    const ok = await checkUrl(url)
    if (ok) {
      await prisma.wallet.updateMany({ where: { name }, data: { logoUrl: url } })
      console.log(`  ✅ ${name}`)
    } else {
      console.log(`  ❌ ${name} → sin logo reconocible`)
    }
  }

  console.log('\n🔍 Actualizando logos de comercios...')
  for (const [name, domain] of Object.entries(COMMERCE_DOMAINS)) {
    const url = faviconUrl(domain)
    const ok = await checkUrl(url)
    if (ok) {
      await prisma.commerce.updateMany({ where: { name }, data: { logoUrl: url } })
      console.log(`  ✅ ${name}`)
    } else {
      console.log(`  ❌ ${name} → sin logo reconocible`)
    }
  }

  console.log('\n✔ Listo.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
