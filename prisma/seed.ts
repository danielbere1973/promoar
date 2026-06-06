import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding...')

  // Admin user
  const adminPassword = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { email: 'admin@promoar.com.ar' },
    update: {},
    create: { email: 'admin@promoar.com.ar', name: 'Admin PromoAR', password: adminPassword, role: 'ADMIN' },
  })

  // Categorías (19 + Sin Categoría)
  const categories = [
    { name: 'Supermercados',   slug: 'supermercados',   icon: '🛒', color: '#1B5E20', order: 1 },
    { name: 'Combustible',     slug: 'combustible',     icon: '⛽', color: '#B45309', order: 2 },
    { name: 'Gastronomía',     slug: 'gastronomia',     icon: '🍕', color: '#F57F17', order: 3 },
    { name: 'Farmacias',       slug: 'farmacias',       icon: '💊', color: '#880E4F', order: 4 },
    { name: 'Indumentaria',    slug: 'indumentaria',    icon: '👕', color: '#4A148C', order: 5 },
    { name: 'Tecnología',      slug: 'tecnologia',      icon: '💻', color: '#01579B', order: 6 },
    { name: 'Mascotas',        slug: 'mascotas',        icon: '🐾', color: '#283593', order: 7 },
    { name: 'Transporte',      slug: 'transporte',      icon: '🚌', color: '#00607A', order: 8 },
    { name: 'Heladerías',      slug: 'heladerias',      icon: '🍦', color: '#00838F', order: 9 },
    { name: 'Hogar',           slug: 'hogar',           icon: '🛋️', color: '#4E342E', order: 10 },
    { name: 'Entretenimiento', slug: 'entretenimiento', icon: '🎭', color: '#1A237E', order: 11 },
    { name: 'Salud y Belleza', slug: 'salud-y-belleza', icon: '🌸', color: '#880E4F', order: 12 },
    { name: 'Deportes',        slug: 'deportes',        icon: '⚽', color: '#1B5E20', order: 13 },
    { name: 'Jugueterías',     slug: 'jugueterias',     icon: '🧸', color: '#E65100', order: 14 },
    { name: 'Librerías',       slug: 'librerias',       icon: '📚', color: '#311B92', order: 15 },
    { name: 'Viajes y Turismo',slug: 'viajes-y-turismo',icon: '✈️', color: '#006064', order: 16 },
    { name: 'Shoppings',       slug: 'shoppings',       icon: '🛍️', color: '#37474F', order: 17 },
    { name: 'Automotores',     slug: 'automotores',     icon: '🚗', color: '#263238', order: 18 },
    { name: 'Otros',           slug: 'otros',           icon: '📦', color: '#546E7A', order: 19 },
    { name: 'Sin Categoría',   slug: 'sin-categoria',   icon: '❓', color: '#9E9E9E', order: 20 },
  ]
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: { name: c.name, icon: c.icon, color: c.color, order: c.order }, create: c })
  }
  console.log('✓ Categorías')

  // Bancos (todos los que tienen scraper activo)
  const banks = [
    { name: 'Banco Galicia',       slug: 'galicia',     logoUrl: 'https://logo.clearbit.com/galicia.com.ar' },
    { name: 'Banco Santander',     slug: 'santander',   logoUrl: 'https://logo.clearbit.com/santander.com.ar' },
    { name: 'Banco BBVA',          slug: 'bbva',        logoUrl: 'https://logo.clearbit.com/bbva.com.ar' },
    { name: 'Banco Nación',        slug: 'bna',         logoUrl: 'https://logo.clearbit.com/bna.com.ar' },
    { name: 'Banco Macro',         slug: 'macro',       logoUrl: 'https://logo.clearbit.com/macro.com.ar' },
    { name: 'Banco Ciudad',        slug: 'ciudad',      logoUrl: 'https://logo.clearbit.com/bancociudad.com.ar' },
    { name: 'Banco Provincia',     slug: 'bapro',       logoUrl: 'https://logo.clearbit.com/bancobpba.com.ar' },
    { name: 'Banco Supervielle',   slug: 'supervielle', logoUrl: 'https://logo.clearbit.com/supervielle.com.ar' },
    { name: 'Banco Patagonia',     slug: 'patagonia',   logoUrl: 'https://logo.clearbit.com/bancopatagonia.com.ar' },
    { name: 'ICBC',                slug: 'icbc',        logoUrl: 'https://logo.clearbit.com/icbc.com.ar' },
    { name: 'Banco Credicoop',     slug: 'credicoop',   logoUrl: 'https://logo.clearbit.com/bancoCrEditcoop.com.ar' },
    { name: 'Banco Hipotecario',   slug: 'hipotecario', logoUrl: null },
    { name: 'Banco Comafi',        slug: 'comafi',      logoUrl: null },
    { name: 'Banco Industrial',    slug: 'industrial',  logoUrl: null },
    { name: 'Banco del Sol',       slug: 'del-sol',     logoUrl: null },
  ]
  for (const b of banks) {
    await prisma.bank.upsert({ where: { slug: b.slug }, update: { name: b.name }, create: b })
  }
  console.log('✓ Bancos')

  // Billeteras digitales
  const wallets = [
    { name: 'Mercado Pago', slug: 'mercadopago', logoUrl: 'https://logo.clearbit.com/mercadopago.com.ar' },
    { name: 'MODO',         slug: 'modo',        logoUrl: 'https://logo.clearbit.com/modo.com.ar' },
    { name: 'Ualá',         slug: 'uala',        logoUrl: 'https://logo.clearbit.com/uala.com.ar' },
    { name: 'Personal Pay', slug: 'personalpay', logoUrl: null },
    { name: 'Naranja X',    slug: 'naranjax',    logoUrl: null },
    { name: 'Brubank',      slug: 'brubank',     logoUrl: 'https://logo.clearbit.com/brubank.com.ar' },
    { name: 'Cuenta DNI',   slug: 'cuentadni',   logoUrl: null },
    { name: 'Claro Pay',    slug: 'claropay',    logoUrl: null },
    { name: 'Bimo',         slug: 'bimo',        logoUrl: null },
  ]
  for (const w of wallets) {
    await prisma.wallet.upsert({ where: { slug: w.slug }, update: { name: w.name }, create: w })
  }
  console.log('✓ Billeteras')

  // Redes de tarjetas
  const networks = [
    { name: 'Visa',             slug: 'visa' },
    { name: 'Mastercard',       slug: 'mastercard' },
    { name: 'American Express', slug: 'amex' },
    { name: 'Cabal',            slug: 'cabal' },
    { name: 'Naranja',          slug: 'naranja' },
  ]
  for (const n of networks) {
    await prisma.cardNetwork.upsert({ where: { slug: n.slug }, update: { name: n.name }, create: n })
  }
  console.log('✓ Redes de tarjetas')

  // Monedas
  await prisma.currency.upsert({ where: { code: 'ARS' }, update: {}, create: { name: 'Pesos Argentinos', code: 'ARS', symbol: '$' } })
  await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { name: 'Dólares', code: 'USD', symbol: 'U$S' } })

  // Tipos de cuenta
  const accountTypes = [
    { name: 'Caja de Ahorros',          description: 'Cuenta estándar para ahorros' },
    { name: 'Cuenta Corriente',         description: 'Cuenta con giro en descubierto' },
    { name: 'Cuenta Sueldo / Haberes',  description: 'Para acreditación de sueldos' },
    { name: 'Jubilados / Pensionados',  description: 'Beneficiarios de ANSES' },
  ]
  for (const at of accountTypes) {
    await prisma.financialAccountType.upsert({ where: { name: at.name }, update: {}, create: at })
  }

  // Segmentos de bancos principales
  const segmentsByBank: Record<string, string[]> = {
    galicia:    ['Eminent', 'Prefer', 'Move', 'General'],
    santander:  ['Select', 'Women', 'Infinity', 'General'],
    bbva:       ['Black', 'Preferred', 'General'],
    macro:      ['Selecta', 'Platinum', 'Gold', 'Classic'],
    supervielle:['Identité', 'General'],
  }
  for (const [slug, segs] of Object.entries(segmentsByBank)) {
    const bank = await prisma.bank.findUnique({ where: { slug } })
    if (!bank) continue
    for (const name of segs) {
      await prisma.bankSegment.upsert({
        where: { bankId_name: { bankId: bank.id, name } },
        update: {},
        create: { bankId: bank.id, name },
      })
    }
  }
  console.log('✓ Segmentos de bancos')

  console.log('\nSeed completado!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
