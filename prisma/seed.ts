import { PrismaClient, CardType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding...')

  const adminPassword = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { email: 'admin@promoar.com.ar' },
    update: {},
    create: {
      email: 'admin@promoar.com.ar',
      name: 'Admin PromoAR',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  const banks = ['galicia','santander','bbva','bna','macro','ciudad','bapro','supervielle']
  const bankNames: Record<string,string> = {
    galicia:'Banco Galicia', santander:'Banco Santander', bbva:'Banco BBVA',
    bna:'Banco Nacion', macro:'Banco Macro', ciudad:'Banco Ciudad',
    bapro:'Banco Provincia', supervielle:'Banco Supervielle'
  }
  for (const slug of banks) {
    await prisma.bank.upsert({
      where: { slug },
      update: {},
      create: { name: bankNames[slug], slug }
    })
  }

  const wallets = ['mercadopago','modo','uala','personalpay','naranjax','brubank']
  const walletNames: Record<string,string> = {
    mercadopago:'Mercado Pago', modo:'Modo', uala:'Ualá',
    personalpay:'Personal Pay', naranjax:'Naranja X', brubank:'Brubank'
  }
  for (const slug of wallets) {
    await prisma.wallet.upsert({
      where: { slug },
      update: {},
      create: { name: walletNames[slug], slug }
    })
  }

  const networks = [
    { name:'Visa', slug:'visa' },
    { name:'Mastercard', slug:'mastercard' },
    { name:'American Express', slug:'amex' },
    { name:'Cabal', slug:'cabal' },
  ]
  for (const n of networks) {
    await prisma.cardNetwork.upsert({ where: { slug: n.slug }, update: {}, create: n })
  }

  const categories = [
    { name:'Transporte', slug:'transporte', icon:'🚌', color:'#00607A', order:1 },
    { name:'Combustible', slug:'combustible', icon:'⛽', color:'#B45309', order:2 },
    { name:'Supermercados', slug:'supermercados', icon:'🛒', color:'#1B5E20', order:3 },
    { name:'Farmacias', slug:'farmacias', icon:'💊', color:'#880E4F', order:4 },
    { name:'Petshops', slug:'petshops', icon:'🐾', color:'#283593', order:5 },
    { name:'Gastronomía', slug:'gastronomia', icon:'🍕', color:'#F57F17', order:6 },
    { name:'Indumentaria', slug:'indumentaria', icon:'👕', color:'#4A148C', order:7 },
    { name:'Tecnología', slug:'tecnologia', icon:'💻', color:'#01579B', order:8 },
  ]
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c })
  }

  const commerces = [
    { name:'SUBE', slug:'sube' },
    { name:'Uber', slug:'uber' },
    { name:'YPF', slug:'ypf' },
    { name:'Shell', slug:'shell' },
    { name:'Axion', slug:'axion' },
    { name:'Carrefour', slug:'carrefour' },
    { name:'Coto', slug:'coto' },
    { name:'Farmacity', slug:'farmacity' },
    { name:'PetCity', slug:'petcity' },
    { name:'Rappi', slug:'rappi' },
    { name:'PedidosYa', slug:'pedidosya' },
  ]
  for (const c of commerces) {
    await prisma.commerce.upsert({ where: { slug: c.slug }, update: {}, create: c })
  }

  // --- Monedas ---
  const currencies = [
    { name: 'Pesos Argentinos', code: 'ARS', symbol: '$' },
    { name: 'Dólares Estadounidenses', code: 'USD', symbol: 'U$S' },
  ]
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, update: {}, create: c })
  }

  // --- Tipos de Cuenta ---
  const accountTypes = [
    { name: 'Caja de Ahorros', description: 'Cuenta estándar para ahorros' },
    { name: 'Cuenta Corriente', description: 'Cuenta con giro en descubierto' },
    { name: 'Cuenta Sueldo / Haberes', description: 'Para acreditación de sueldos' },
    { name: 'Jubilados / Pensionados', description: 'Beneficiarios de ANSES' },
  ]
  for (const at of accountTypes) {
    await prisma.financialAccountType.upsert({ where: { name: at.name }, update: {}, create: at })
  }

  // --- Segmentos de Ejemplo ---
  const galicia = await prisma.bank.findUnique({ where: { slug: 'galicia' } })
  if (galicia) {
    const segments = ['Eminent', 'Prefer', 'Move', 'General']
    for (const name of segments) {
      await prisma.bankSegment.upsert({ 
        where: { bankId_name: { bankId: galicia.id, name } }, 
        update: {}, 
        create: { bankId: galicia.id, name } 
      })
    }
  }

  const santander = await prisma.bank.findUnique({ where: { slug: 'santander' } })
  if (santander) {
    const segments = ['Select', 'Women', 'Infinity', 'General']
    for (const name of segments) {
      await prisma.bankSegment.upsert({ 
        where: { bankId_name: { bankId: santander.id, name } }, 
        update: {}, 
        create: { bankId: santander.id, name } 
      })
    }
  }

  console.log('Seed completado!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())