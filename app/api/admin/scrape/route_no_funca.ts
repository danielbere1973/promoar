import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ScrapedPromo } from '@/types/scraper'

export async function POST(req: NextRequest) {
  try {
    const { promos: scrapedPromos } = await req.json() as { promos: ScrapedPromo[] }

    if (!scrapedPromos || scrapedPromos.length === 0) {
      return NextResponse.json({ error: 'No promos to process' }, { status: 400 })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUNTO 2: AGRUPAR PROMOS POR title + sourceUrl
    // Una promo puede tener múltiples descuentos (ej: "10% y 6 CSI")
    // El scraper retorna 2 ScrapedPromo, pero debemos crear 1 Promo con 2 Requirements
    // ═══════════════════════════════════════════════════════════════════════
    
    const grouped = new Map<string, ScrapedPromo[]>()
    
    for (const scraped of scrapedPromos) {
      const key = `${scraped.title}|||${scraped.sourceUrl || 'NO_URL'}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(scraped)
    }

    console.log(`[SCRAPE API] ${scrapedPromos.length} promos scrapeadas → ${grouped.size} promos únicas`)

    const createdPromos = []

    // ═══════════════════════════════════════════════════════════════════════
    // PROCESAR CADA GRUPO (1 grupo = 1 promo con N requirements)
    // ═══════════════════════════════════════════════════════════════════════
    
    for (const [groupKey, group] of grouped) {
      const first = group[0] // Usar el primero como base para datos de la promo

      // ── 1. Resolver categoria ─────────────────────────────────────────────
      let category = await prisma.category.findUnique({
        where: { slug: first.categoria || 'otros' }
      })
      
      if (!category) {
        category = await prisma.category.findFirst({
          where: { slug: 'otros' }
        })
      }
      
      if (!category) {
        console.error(`[SCRAPE] Categoría no encontrada para: ${first.categoria}`)
        continue
      }

      // ── 2. Resolver commerce (storeName) ───────────────────────────────────
      const storeName = first.storeName || 'MODO'
      let commerce = await prisma.commerce.findFirst({
        where: { 
          OR: [
            { name: { equals: storeName, mode: 'insensitive' } },
            { slug: storeName.toLowerCase().replace(/\s+/g, '-') }
          ]
        }
      })

      if (!commerce) {
        commerce = await prisma.commerce.create({
          data: {
            name: storeName,
            slug: storeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            website: first.sourceUrl || null,
          }
        })
        console.log(`[SCRAPE] Comercio creado: ${commerce.name}`)
      }

      // ── 3. Crear la PROMO (UNA VEZ) ───────────────────────────────────────
      const promo = await prisma.promo.create({
        data: {
          title: first.title,
          description: first.description || first.title,
          sourceText: first.sourceText || null,
          sourceUrl: first.sourceUrl || null,
          validFrom: first.validFrom ? new Date(first.validFrom) : new Date(),
          validUntil: first.validUntil ? new Date(first.validUntil) : null,
          validDays: first.validDays ?? 127,
          categoryId: category.id,
          commerceId: commerce.id,
          status: 'ACTIVE',
          stackable: first.stackable ?? false,
          provinces: first.provinces || [],
        }
      })

      console.log(`[SCRAPE] Promo creada: ${promo.title} (${promo.id})`)

      // ── 4. Resolver entidades (bancos, wallets, redes) ────────────────────
      
      // Bancos
      const bankNames = first.bankNames || []
      const banks = []
      for (const name of bankNames) {
        const bank = await prisma.bank.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } }
        })
        if (bank) banks.push(bank)
      }

      // Wallets
      const walletNames = first.walletNames || []
      const wallets = []
      for (const name of walletNames) {
        const wallet = await prisma.wallet.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } }
        })
        if (wallet) wallets.push(wallet)
      }

      // Card Networks
      const cardNetworkNames = first.cardNetworks || []
      const networks = []
      for (const netInfo of cardNetworkNames) {
        const netName = typeof netInfo === 'string' ? netInfo : netInfo.network
        const network = await prisma.cardNetwork.findFirst({
          where: { name: { equals: netName, mode: 'insensitive' } }
        })
        if (network) networks.push({ network, type: typeof netInfo === 'object' ? netInfo.type : null })
      }

      // ── 5. EXTRAER TODOS LOS DESCUENTOS DEL GRUPO ─────────────────────────
      // Cada item del grupo puede tener discount diferente
      const allDiscounts = group.map(g => ({
        value: parseFloat(g.discount || '0'),
        type: g.discountType || 'PERCENTAGE_DESCUENTO'
      }))

      // Remover duplicados (mismo value + type)
      const uniqueDiscounts = Array.from(
        new Map(allDiscounts.map(d => [`${d.value}-${d.type}`, d])).values()
      )

      console.log(`[SCRAPE] → ${uniqueDiscounts.length} descuentos únicos:`, uniqueDiscounts)

      // ── 6. CREAR REQUIREMENTS ─────────────────────────────────────────────
      // Combinaciones: banco × wallet × red × tipo × descuento
      
      // Si no hay bancos/wallets/redes, crear 1 requirement genérico por descuento
      if (banks.length === 0 && wallets.length === 0 && networks.length === 0) {
        for (const discount of uniqueDiscounts) {
          await prisma.promoRequirement.create({
            data: {
              promoId: promo.id,
              discountType: discount.type,
              discountValue: discount.value,
              paymentChannel: first.paymentChannel || 'ANY',
              accountType: first.accountType || 'ANY',
              cap: first.cap ? parseFloat(first.cap) : null,
              capPeriod: first.capPeriod || null,
              capTarget: first.capTarget || null,
              minPurchase: first.minPurchase ? parseFloat(first.minPurchase) : null,
            }
          })
        }
      } else {
        // Crear requirement por cada combinación
        const banksToUse = banks.length > 0 ? banks : [null]
        const walletsToUse = wallets.length > 0 ? wallets : [null]
        const networksToUse = networks.length > 0 ? networks : [{ network: null, type: null }]

        for (const bank of banksToUse) {
          for (const wallet of walletsToUse) {
            for (const netInfo of networksToUse) {
              for (const discount of uniqueDiscounts) {
                await prisma.promoRequirement.create({
                  data: {
                    promoId: promo.id,
                    bankId: bank?.id || null,
                    walletId: wallet?.id || null,
                    cardNetworkId: netInfo.network?.id || null,
                    cardType: netInfo.type || first.cardType || null,
                    discountType: discount.type,
                    discountValue: discount.value,
                    paymentChannel: first.paymentChannel || 'ANY',
                    accountType: first.accountType || 'ANY',
                    cap: first.cap ? parseFloat(first.cap) : null,
                    capPeriod: first.capPeriod || null,
                    capTarget: first.capTarget || null,
                    minPurchase: first.minPurchase ? parseFloat(first.minPurchase) : null,
                  }
                })
              }
            }
          }
        }
      }

      createdPromos.push(promo)
    }

    return NextResponse.json({ 
      success: true,
      created: createdPromos.length,
      promos: createdPromos 
    })

  } catch (error) {
    console.error('[POST /api/admin/scrape]', error)
    return NextResponse.json({ 
      error: 'Error al procesar promos',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
