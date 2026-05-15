import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categorySlug = searchParams.get('category')
    const day = searchParams.get('day') // Single day filter (legacy/shortcut)
    const forMe = searchParams.get('for_me') === 'true'

    const session = await getServerSession()
    const email = session?.user?.email || req.headers.get('x-user-email')

    // advanced filters
    const bankIds = searchParams.get('banks')?.split(',').filter(Boolean)
    const walletIds = searchParams.get('wallets')?.split(',').filter(Boolean)
    const networkIds = searchParams.get('networks')?.split(',').filter(Boolean)
    const channels = searchParams.get('channels')?.split(',').filter(Boolean) as any[]
    const capPeriods = searchParams.get('capPeriods')?.split(',').filter(Boolean) as any[]
    const hasCap = searchParams.get('hasCap')
    const capMin = searchParams.get('capMin') ? parseFloat(searchParams.get('capMin')!) : null
    const capMax = searchParams.get('capMax') ? parseFloat(searchParams.get('capMax')!) : null
    const dateFromStr = searchParams.get('dateFrom')
    const dateToStr = searchParams.get('dateTo')
    const dayIndices = searchParams.get('days')?.split(',').filter(Boolean).map(d => parseInt(d))
    const view = searchParams.get('view') // 'today' | 'week'

    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

    // Auto-expiration logic: Lazy update active promos that have already expired
    // We only expire if the validUntil date is strictly before the START of today.
    try {
      await prisma.promo.updateMany({
        where: {
          status: 'ACTIVE',
          validUntil: { lt: startOfToday }
        },
        data: {
          status: 'EXPIRED'
        }
      })
    } catch (e) {
      console.error('Error in auto-expiration logic:', e)
    }

    // Default to today if no specific day filter is provided
    const defaultDayBit = 1 << today.getDay()

    // Construct Prisma where clause
    const where: any = {
      status: 'ACTIVE',
      // Time validity: simplified
      validFrom: { lte: today },
      OR: [
        { validUntil: null },
        { validUntil: { gte: startOfToday } }
      ]
    }

    if (email) {
      const userObj = await prisma.user.findUnique({ where: { email }, select: { addressState: true } })
      if (userObj?.addressState) {
        where.AND = [
          {
            OR: [
              { provinces: { hasSome: ['Todas', 'TODAS', userObj.addressState] } },
              { provinces: { isEmpty: true } }
            ]
          }
        ]
      }
    }

    if (categorySlug && categorySlug !== 'todos') {
      where.category = { slug: categorySlug }
    }

    if (dateFromStr) where.validFrom = { ...where.validFrom, gte: new Date(dateFromStr) }
    if (dateToStr) where.validUntil = { ...where.validUntil, lte: new Date(dateToStr) }

    // Requirements based filters (nested)
    const reqFilter: any = {}
    if (bankIds?.length) reqFilter.bankId = { in: bankIds }
    if (walletIds?.length) reqFilter.walletId = { in: walletIds }
    if (networkIds?.length) reqFilter.cardNetworkId = { in: networkIds }
    if (channels?.length) reqFilter.paymentChannel = { in: channels }
    if (capPeriods?.length) reqFilter.capPeriod = { in: capPeriods }

    if (hasCap === 'true') reqFilter.cap = { not: null }
    if (hasCap === 'false') reqFilter.cap = null

    if (capMin !== null || capMax !== null) {
      reqFilter.cap = { ...reqFilter.cap, gte: capMin ?? undefined, lte: capMax ?? undefined }
    }

    if (Object.keys(reqFilter).length > 0) {
      where.requirements = { some: reqFilter }
    }

    const promos = await prisma.promo.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true, icon: true, color: true } },
        commerce: { select: { name: true, slug: true } },
        requirements: {
          select: {
            id: true,
            bankId: true,
            walletId: true,
            cardNetworkId: true,
            cardType: true,
            paymentChannel: true,
            accountType: true,
            discountType: true,
            discountValue: true,  // ← ESTO ES LO QUE FALTA
            cap: true,
            capPeriod: true,
            capTarget: true,
            minPurchase: true,
            nxmN: true,
            nxmM: true,
            note: true,
            bank: { select: { name: true } },
            wallet: { select: { name: true } },
            cardNetwork: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Day bitmask filtering
    let filtered = promos
    if (dayIndices?.length) {
      const bitmask = dayIndices.reduce((mask, d) => mask | (1 << d), 0)
      filtered = filtered.filter(p => (p.validDays & bitmask) !== 0)
    } else if (day !== null) {
      const dayBit = 1 << parseInt(day)
      filtered = filtered.filter(p => (p.validDays & dayBit) !== 0)
    } else if (view !== 'week') {
      // DEFAULT: Filter by today unless view is 'week'
      filtered = filtered.filter(p => (p.validDays & defaultDayBit) !== 0)
    }

    // ─── Match Engine Personalizado CORREGIDO ─────────────────────────────────
    // Filtra promos según el perfil financiero del usuario de forma estricta.
    // Un requirement PASA si el usuario tiene alguna tarjeta/cuenta que cumpla
    // TODOS los criterios del requirement (banco, wallet, red, tipo, segmento, account type).
    let userProfile = null
    let fetchedUser = null
    if (forMe && email) {
      fetchedUser = await prisma.user.findUnique({
        where: { email },
        include: {
          financialProfile: { include: { banks: true, wallets: true, cards: true } },
          savedPromos: true
        }
      })
      userProfile = fetchedUser?.financialProfile || null
    }

    if (userProfile && forMe) {
      const userCards = userProfile.cards
      const savedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])

      // Función estricta de matching: verifica que alguna card del usuario
      // satisface TODOS los criterios del requirement.
      function matchesProfile(req: any): boolean {
        // ═══════════════════════════════════════════════════════════════════════
        // REGLA 1: Requisito sin restricciones → aplica para TODOS
        // ═══════════════════════════════════════════════════════════════════════
        const hasEntityConstraint = req.bankId || req.walletId
        const hasCardConstraint = req.cardNetworkId || req.cardType
        const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'

        // Si el requirement no tiene NINGUNA restricción → es universal
        if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) {
          return true
        }

        // ═══════════════════════════════════════════════════════════════════════
        // REGLA 2: Buscar match estricto en las cards del usuario
        // ═══════════════════════════════════════════════════════════════════════
        return userCards.some(card => {
          // ─── 2.1 Validación de BANCO ───────────────────────────────────────
          // Si el requirement especifica un banco, la card DEBE tener ese banco
          if (req.bankId) {
            if (card.bankId !== req.bankId) return false
          }
          // CASO ESPECIAL: Requirement tiene wallet pero NO banco
          // → Solo matchear cards que NO tengan banco (evita falsos positivos)
          else if (req.walletId && !req.bankId) {
            // Si la card tiene banco, NO matchea (porque el requirement no pidió banco)
            if (card.bankId) return false
          }

          // ─── 2.2 Validación de WALLET ──────────────────────────────────────
          // Si el requirement especifica wallet, la card DEBE tener ese wallet
          if (req.walletId && card.walletId !== req.walletId) {
            return false
          }

          // ─── 2.3 Validación de RED DE TARJETA ──────────────────────────────
          // Si el requirement especifica red (Visa/Master/Amex), la card debe ser de esa red
          if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) {
            return false
          }

          // ─── 2.4 Validación de TIPO DE TARJETA ─────────────────────────────
          // Crédito / Débito / Prepago
          if (req.cardType && card.cardType !== req.cardType) {
            return false
          }

          // ─── 2.5 Validación de SEGMENTO BANCARIO ───────────────────────────
          // Ej: Select, Black, Platinum
          if (req.segmentId && card.segmentId !== req.segmentId) {
            return false
          }

          // ─── 2.6 Validación de TIPO DE CUENTA ──────────────────────────────
          // JUBILADO y ANSES son el mismo universo (ANSES administra jubilaciones)
          if (req.accountType === 'JUBILADO' || req.accountType === 'ANSES') {
            if (!card.isPensioner) return false
          }
          // HABERES = cuenta sueldo
          if (req.accountType === 'HABERES') {
            if (!card.isPayroll) return false
          }

          // Si pasó todas las validaciones → MATCH
          return true
        })
      }

      filtered = filtered.filter(promo => {
        // Las promos guardadas siempre se muestran (favoritos del usuario)
        if (savedSet.has(promo.id)) return true

        // Sin requirements → datos incompletos del scraper, NO mostrar en "Mis promos"
        if (!promo.requirements.length) return false

        // La promo aplica si AL MENOS UN requirement coincide con el perfil
        return promo.requirements.some(req => matchesProfile(req))
      })
    }

    // ─── Enriquecimiento final de promos ──────────────────────────────────────
    const finalSavedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])
    const finalPromos = filtered.map(p => {
      const allReqs = p.requirements ?? []
      const globalMaxDiscount = allReqs.length > 0 ? allReqs.reduce((max, r) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, allReqs[0]) : null

      let userBestDiscount = null
      if (userProfile) {
        const uCards = userProfile.cards
        // Reutilizar la misma lógica estricta de matchesProfile para calcular el mejor descuento
        const matching = allReqs.filter(req => {
          const hasEntityConstraint = req.bankId || req.walletId
          const hasCardConstraint = req.cardNetworkId || req.cardType
          const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'
          if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) return true

          return uCards.some((c: any) => {
            if (req.bankId) {
              if (c.bankId !== req.bankId) return false
            } else if (req.walletId && !req.bankId) {
              if (c.bankId) return false
            }
            if (req.walletId && c.walletId !== req.walletId) return false
            if (req.cardNetworkId && c.cardNetworkId !== req.cardNetworkId) return false
            if (req.cardType && c.cardType !== req.cardType) return false
            if (req.segmentId && c.segmentId !== req.segmentId) return false
            if ((req.accountType === 'JUBILADO' || req.accountType === 'ANSES') && !c.isPensioner) return false
            if (req.accountType === 'HABERES' && !c.isPayroll) return false
            return true
          })
        })

        if (matching.length) {
          userBestDiscount = matching.reduce((max: any, r: any) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, matching[0])
        }
      }

      return { ...p, isSaved: finalSavedSet.has(p.id), globalMaxDiscount, userBestDiscount }
    })

    return NextResponse.json({ promos: finalPromos })
  } catch (error) {
    console.error('[GET /api/promos]', error)
    return NextResponse.json({ error: 'Error al obtener promos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      title, description,
      uniqueUsePerPeriod, maxUsesPerPeriod, stackable, stackableNote,
      validFrom, validUntil, validDays, validDaysNote,
      validFromHour, validToHour,
      categoryId, commerceId, requirements,
      status, sourceUrl, sourceNote, provinces,
    } = body

    const promo = await prisma.promo.create({
      data: {
        title,
        description,
        uniqueUsePerPeriod: uniqueUsePerPeriod ?? false,
        maxUsesPerPeriod: maxUsesPerPeriod ? parseInt(maxUsesPerPeriod) : null,
        stackable: stackable ?? false,
        stackableNote: stackableNote || null,
        validFrom: new Date(validFrom),
        validUntil: validUntil ? new Date(validUntil) : null,
        validDays: validDays ?? 127, // 127 = todos los dias
        validDaysNote: validDaysNote || null,
        validFromHour: validFromHour ? parseInt(validFromHour) : null,
        validToHour: validToHour ? parseInt(validToHour) : null,
        categoryId,
        commerceId,
        status: status ?? 'ACTIVE',
        sourceUrl: sourceUrl || null,
        sourceNote: sourceNote || null,
        provinces: Array.isArray(provinces) ? provinces : [],
        requirements: requirements?.length
          ? {
            create: requirements.map((r: any) => ({
              bankId: r.bankId || null,
              walletId: r.walletId || null,
              cardNetworkId: r.cardNetworkId || null,
              cardType: r.cardType || null,
              paymentChannel: r.paymentChannel || 'ANY',
              accountType: r.accountType || 'ANY',
              segment: r.segment || null,
              discountType: r.discountType || 'PERCENTAGE_REINTEGRO',
              discountValue: r.discountValue ? parseFloat(r.discountValue) : 0,
              nxmN: r.nxmN ? parseInt(r.nxmN) : null,
              nxmM: r.nxmM ? parseInt(r.nxmM) : null,
              minPurchase: r.minPurchase ? parseFloat(r.minPurchase) : null,
              cap: r.cap ? parseFloat(r.cap) : null,
              capPeriod: r.capPeriod || null,
              capTarget: (r.capTarget as 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION') || (r.cap ? 'USER' : null),
              note: r.note || null,
            })),
          }
          : undefined,
      },
      include: {
        category: true,
        commerce: true,
        requirements: true,
      },
    })

    return NextResponse.json({ promo }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/promos]', error)
    return NextResponse.json({ error: 'Error al crear promo' }, { status: 500 })
  }
}
