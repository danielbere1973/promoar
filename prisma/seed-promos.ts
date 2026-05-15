import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding promos reales...')

  // ─── Lookup helpers ────────────────────────────────────────────
  const cat  = (slug: string) => prisma.category.findUniqueOrThrow({ where: { slug } })
  const com  = (slug: string) => prisma.commerce.findUniqueOrThrow({ where: { slug } })
  const bank = (slug: string) => prisma.bank.findUniqueOrThrow({ where: { slug } })
  const wallet = (slug: string) => prisma.wallet.findUniqueOrThrow({ where: { slug } })
  const net  = (slug: string) => prisma.cardNetwork.findUniqueOrThrow({ where: { slug } })

  const validFrom = new Date('2026-04-01')
  const endMes = new Date('2026-04-30')
  const endJun = new Date('2026-06-30')

  // ─── 1. Galicia + Supermercados = 20% reintegro en Coto ────────
  {
    const [c, co, b, v] = await Promise.all([
      cat('supermercados'), com('coto'), bank('galicia'), net('visa')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-001' },
      update: {},
      create: {
        id: 'seed-promo-001',
        title: '20% de reintegro en Coto con Galicia Visa',
        description: 'Obtené un 20% de reintegro en Coto pagando con tarjeta Visa de Banco Galicia. Tope de $3.000 por mes. Válido todos los días.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.bancogalicia.com/beneficios',
        requirements: {
          create: [
            { bankId: b.id, cardNetworkId: v.id, cardType: 'CREDIT', discountType: 'PERCENTAGE_REINTEGRO', discountValue: 20, cap: 3000, capPeriod: 'MONTHLY', minPurchase: 5000 },
            { bankId: b.id, cardNetworkId: v.id, cardType: 'DEBIT', discountType: 'PERCENTAGE_REINTEGRO', discountValue: 20, cap: 3000, capPeriod: 'MONTHLY', minPurchase: 5000 },
          ]
        }
      }
    })
    console.log('✓ Promo 1: Galicia + Coto')
  }

  // ─── 2. Modo + Farmacity = 25% descuento ───────────────────────
  {
    const [c, co, w] = await Promise.all([
      cat('farmacias'), com('farmacity'), wallet('modo')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-002' },
      update: {},
      create: {
        id: 'seed-promo-002',
        title: '25% de descuento en Farmacity con Modo',
        description: 'Descuento directo del 25% pagando con Modo en Farmacity. Tope de $2.500 por transacción. Sin mínimo de compra.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.way.com.ar/beneficios',
        requirements: {
          create: [{ walletId: w.id, discountType: 'PERCENTAGE_DESCUENTO', discountValue: 25, cap: 2500, capPeriod: 'PER_TRANSACTION' }]
        }
      }
    })
    console.log('✓ Promo 2: Modo + Farmacity')
  }

  // ─── 3. Mercado Pago + YPF = 15% reintegro combustible ─────────
  {
    const [c, co, w] = await Promise.all([
      cat('combustible'), com('ypf'), wallet('mercadopago')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-003' },
      update: {},
      create: {
        id: 'seed-promo-003',
        title: '15% de reintegro en YPF con Mercado Pago',
        description: 'Cargá nafta o gasoil en YPF y obtenés 15% de reintegro pagando con Mercado Pago. Máximo $2.000 de reintegro por carga.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.mercadopago.com.ar/beneficios',
        requirements: {
          create: [{ walletId: w.id, discountType: 'PERCENTAGE_REINTEGRO', discountValue: 15, cap: 2000, capPeriod: 'PER_TRANSACTION' }]
        }
      }
    })
    console.log('✓ Promo 3: Mercado Pago + YPF')
  }

  // ─── 4. BBVA + Rappi = 30% descuento gastronomia ───────────────
  {
    const [c, co, b, mc] = await Promise.all([
      cat('gastronomia'), com('rappi'), bank('bbva'), net('mastercard')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-004' },
      update: {},
      create: {
        id: 'seed-promo-004',
        title: '30% de descuento en Rappi con BBVA Mastercard',
        description: 'Pedí por Rappi con tu tarjeta Mastercard de Banco BBVA y obtené 30% de descuento. Tope de $2.000 por pedido. Solo jueves y viernes.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 0b0110000, // jueves=bit4 + viernes=bit5
        validDaysNote: 'Solo jueves y viernes',
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.bbva.com.ar/beneficios',
        requirements: {
          create: [
            { bankId: b.id, cardNetworkId: mc.id, cardType: 'CREDIT', discountType: 'PERCENTAGE_DESCUENTO', discountValue: 30, cap: 2000, capPeriod: 'PER_TRANSACTION', minPurchase: 3000 },
          ]
        }
      }
    })
    console.log('✓ Promo 4: BBVA + Rappi')
  }

  // ─── 5. Personal Pay + SUBE = 30% reintegro transporte ─────────
  {
    const [c, co, w] = await Promise.all([
      cat('transporte'), com('sube'), wallet('personalpay')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-005' },
      update: {},
      create: {
        id: 'seed-promo-005',
        title: '30% de reintegro al cargar SUBE con Personal Pay',
        description: 'Cargá tu SUBE desde la app de Personal Pay y obtenés 30% de reintegro. Tope de $1.500 por mes. Válido todos los días, todas las franjas horarias.',
        uniqueUsePerPeriod: false,
        stackable: true,
        stackableNote: 'Acumulable con subsidio de transporte',
        validFrom,
        validUntil: endJun,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.personalpay.com.ar',
        requirements: {
          create: [{ walletId: w.id, discountType: 'PERCENTAGE_REINTEGRO', discountValue: 30, cap: 1500, capPeriod: 'MONTHLY' }]
        }
      }
    })
    console.log('✓ Promo 5: Personal Pay + SUBE')
  }

  // ─── 6. Naranja X + PedidosYa = 3x2 gastronomia ────────────────
  {
    const [c, co, w] = await Promise.all([
      cat('gastronomia'), com('pedidosya'), wallet('naranjax')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-006' },
      update: {},
      create: {
        id: 'seed-promo-006',
        title: '3x2 en PedidosYa con Naranja X (3 pedidos, pagás 2)',
        description: 'Hacé 3 pedidos en PedidosYa pagando con Naranja X y el tercero va por cuenta de la casa. El reintegro se acredita a las 48hs.',
        uniqueUsePerPeriod: true,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        validDaysNote: 'Aplica para el tercer pedido del mes',
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.naranjax.com/beneficios',
        requirements: {
          create: [{ walletId: w.id, discountType: 'NXM', discountValue: 33.33, nxmN: 3, nxmM: 2 }]
        }
      }
    })
    console.log('✓ Promo 6: Naranja X + PedidosYa')
  }

  // ─── 7. Santander + Shell = 20% reintegro nafta ─────────────────
  {
    const [c, co, b, v, mc] = await Promise.all([
      cat('combustible'), com('shell'), bank('santander'), net('visa'), net('mastercard')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-007' },
      update: {},
      create: {
        id: 'seed-promo-007',
        title: '20% de reintegro en Shell con Santander',
        description: '20% de reintegro en estaciones Shell con tarjetas Visa o Mastercard de Banco Santander. Tope de $3.500 mensuales. Sin mínimo de carga.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.santander.com.ar/beneficios',
        requirements: {
          create: [
            { bankId: b.id, cardNetworkId: v.id, cardType: 'CREDIT', discountType: 'PERCENTAGE_REINTEGRO', discountValue: 20, cap: 3500, capPeriod: 'MONTHLY' },
            { bankId: b.id, cardNetworkId: mc.id, cardType: 'CREDIT', discountType: 'PERCENTAGE_REINTEGRO', discountValue: 20, cap: 3500, capPeriod: 'MONTHLY' },
          ]
        }
      }
    })
    console.log('✓ Promo 7: Santander + Shell')
  }

  // ─── 8. Ualá + Uber = 20% descuento transporte ─────────────────
  {
    const [c, co, w] = await Promise.all([
      cat('transporte'), com('uber'), wallet('uala')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-008' },
      update: {},
      create: {
        id: 'seed-promo-008',
        title: '20% de descuento en Uber pagando con Ualá',
        description: 'Viajá con Uber y pagá con tu tarjeta Ualá para obtener 20% de descuento directo. Hasta 4 usos por mes. Tope de $800 por viaje.',
        uniqueUsePerPeriod: false,
        maxUsesPerPeriod: 4,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.uala.com.ar/beneficios',
        requirements: {
          create: [{ walletId: w.id, discountType: 'PERCENTAGE_DESCUENTO', discountValue: 20, cap: 800, capPeriod: 'PER_TRANSACTION' }]
        }
      }
    })
    console.log('✓ Promo 8: Ualá + Uber')
  }

  // ─── 9. Banco Provincia + Axion = 15% reintegro ─────────────────
  {
    const [c, co, b] = await Promise.all([
      cat('combustible'), com('axion'), bank('bapro')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-009' },
      update: {},
      create: {
        id: 'seed-promo-009',
        title: '15% de reintegro en Axion con Banco Provincia',
        description: '15% de reintegro al cargar nafta en Axion Energy con cualquier tarjeta de Banco Provincia. Tope de $2.500 por mes.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.bancoprovincia.com.ar/beneficios',
        requirements: {
          create: [
            { bankId: b.id, cardType: 'CREDIT', discountType: 'PERCENTAGE_REINTEGRO', discountValue: 15, cap: 2500, capPeriod: 'MONTHLY' },
            { bankId: b.id, cardType: 'DEBIT', discountType: 'PERCENTAGE_REINTEGRO', discountValue: 15, cap: 2500, capPeriod: 'MONTHLY' },
          ]
        }
      }
    })
    console.log('✓ Promo 9: Banco Provincia + Axion')
  }

  // ─── 10. Brubank + Carrefour = 10% descuento supermercados ──────
  {
    const [c, co, w] = await Promise.all([
      cat('supermercados'), com('carrefour'), wallet('brubank')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-010' },
      update: {},
      create: {
        id: 'seed-promo-010',
        title: '10% de descuento en Carrefour con Brubank',
        description: 'Comprá en Carrefour y pagá con tu tarjeta Brubank para obtener 10% de descuento directo en caja. Tope de $3.000 por mes. Válido presencial y online.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.brubank.com/beneficios',
        requirements: {
          create: [{ walletId: w.id, discountType: 'PERCENTAGE_DESCUENTO', discountValue: 10, cap: 3000, capPeriod: 'MONTHLY', minPurchase: 8000 }]
        }
      }
    })
    console.log('✓ Promo 10: Brubank + Carrefour')
  }

  // ─── 11. PetCity + Modo = 20% mascotas ──────────────────────────
  {
    const [c, co, w] = await Promise.all([
      cat('petshops'), com('petcity'), wallet('modo')
    ])
    await prisma.promo.upsert({
      where: { id: 'seed-promo-011' },
      update: {},
      create: {
        id: 'seed-promo-011',
        title: '20% de descuento en PetCity con Modo',
        description: 'Comprá alimentos, accesorios y medicamentos para tu mascota en PetCity con Modo y obtené 20% de descuento. Tope de $2.000 por mes.',
        uniqueUsePerPeriod: false,
        stackable: false,
        validFrom,
        validUntil: endMes,
        validDays: 127,
        categoryId: c.id,
        commerceId: co.id,
        status: 'ACTIVE',
        sourceUrl: 'https://www.way.com.ar/beneficios',
        requirements: {
          create: [{ walletId: w.id, discountType: 'PERCENTAGE_DESCUENTO', discountValue: 20, cap: 2000, capPeriod: 'MONTHLY' }]
        }
      }
    })
    console.log('✓ Promo 11: Modo + PetCity')
  }

  console.log('\n✅ ¡Seed de promos completado! 11 promos cargadas.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
