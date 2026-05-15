import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categorySlug = searchParams.get('category')
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const day = searchParams.get('day') // Single day filter (legacy/shortcut)
    const forMe = searchParams.get('for_me') === 'true'

    const session = await getServerSession()
    const email = session?.user?.email || req.headers.get('x-user-email')

    // ═══════════════════════════════════════════════════════════════════════
    // NUEVO: BYPASS PARA ADMIN/MODERATOR
    // ═══════════════════════════════════════════════════════════════════════
    const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'

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
          include: {
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

    // Filtrar promos con specificDates — mostrar solo si HOY está en las fechas
    const todayStr = today.toISOString().split('T')[0]
    filtered = filtered.filter(p => {
      if (!p.specificDates) return true
      try {
        const dates: string[] = JSON.parse(p.specificDates)
        if (!dates.length) return true
        if (view === 'week') {
          // En modo semana: mostrar si alguna fecha futura existe
          return dates.some(d => d >= todayStr)
        }
        // En modo hoy: mostrar solo si HOY está en las fechas
        return dates.includes(todayStr)
      } catch {
        return true
      }
    })


    // ═══════════════════════════════════════════════════════════════════════
    // FILTRADO POR PERFIL FINANCIERO - CON BYPASS PARA ADMIN
    // ═══════════════════════════════════════════════════════════════════════
    let userProfile = null
    let fetchedUser = null

    // ADMIN BYPASS: Si es admin, NO filtrar por perfil financiero
    if (forMe && email && !isAdmin) {
      fetchedUser = await prisma.user.findUnique({
        where: { email },
        include: {
          financialProfile: { include: { banks: true, wallets: true, cards: true } },
          savedPromos: true
        }
      })
      userProfile = fetchedUser?.financialProfile || null
    }

    if (userProfile && forMe && !isAdmin) {
      const userCards = userProfile.cards
      const savedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])

      // Función estricta de matching: verifica que el perfil del usuario
      // satisface los criterios del requirement.
      function matchesProfile(req: any): boolean {
        // ═══════════════════════════════════════════════════════════════════════
        // REGLA 1: Requisito sin restricciones → aplica para TODOS
        // ═══════════════════════════════════════════════════════════════════════
        const hasEntityConstraint = req.bankId || req.walletId
        const hasCardConstraint = req.cardNetworkId || req.cardType
        const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'

        if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) {
          return true
        }

        // ═══════════════════════════════════════════════════════════════════════
        // REGLA 2: Requirement con BANCO + WALLET → verificar por separado
        // El usuario guarda banco y wallet como cards distintas, no en una sola.
        // Ej: Fravega con Banco Corrientes + MODO + Visa Crédito:
        //   card1 = { bankId: Corrientes, cardNetworkId: Visa, cardType: CREDIT }
        //   card2 = { walletId: MODO }
        //   → ambas deben existir, pero no necesariamente en la misma card.
        // ═══════════════════════════════════════════════════════════════════════
        if (req.bankId && req.walletId) {
          // ¿Tiene una card del banco correcto con la red/tipo correctos?
          const hasBankMatch = userCards.some(card => {
            if (card.bankId !== req.bankId) return false
            if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) return false
            if (req.cardType && card.cardType !== req.cardType) return false
            if (req.segmentId && card.segmentId !== req.segmentId) return false
            if ((req.accountType === 'JUBILADO' || req.accountType === 'ANSES') && !card.isPensioner) return false
            if (req.accountType === 'HABERES' && !card.isPayroll) return false
            return true
          })
          if (!hasBankMatch) return false

          // ¿Tiene la wallet requerida?
          const hasWalletMatch = userCards.some(card => card.walletId === req.walletId)
          return hasWalletMatch
        }

        // ═══════════════════════════════════════════════════════════════════════
        // REGLA 3: Solo banco O solo wallet → match estricto en una card
        // ═══════════════════════════════════════════════════════════════════════
        return userCards.some(card => {
          // ─── Banco ────────────────────────────────────────────────────────
          if (req.bankId) {
            if (card.bankId !== req.bankId) return false
          }
          // Requirement solo wallet (sin banco) → matchear cualquier card con esa wallet
          // (incluye cards que tienen banco+wallet, ej: Galicia+MODO matchea req de solo MODO)
          else if (req.walletId && !req.bankId) {
            if (!card.walletId) return false  // la card debe tener wallet
          }

          // ─── Wallet ───────────────────────────────────────────────────────
          if (req.walletId && card.walletId !== req.walletId) return false

          // ─── Red de tarjeta ───────────────────────────────────────────────
          if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) return false

          // ─── Tipo de tarjeta ──────────────────────────────────────────────
          if (req.cardType && card.cardType !== req.cardType) return false

          // ─── Segmento bancario ────────────────────────────────────────────
          if (req.segmentId && card.segmentId !== req.segmentId) return false

          // ─── Tipo de cuenta ───────────────────────────────────────────────
          if (req.accountType === 'JUBILADO' || req.accountType === 'ANSES') {
            if (!card.isPensioner) return false
          }
          if (req.accountType === 'HABERES') {
            if (!card.isPayroll) return false
          }

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
      if (userProfile && !isAdmin) {
        const uCards = userProfile.cards
        // Reutilizar la misma lógica estricta de matchesProfile para calcular el mejor descuento
        const matching = allReqs.filter(req => {
          const hasEntityConstraint = req.bankId || req.walletId
          const hasCardConstraint = req.cardNetworkId || req.cardType
          const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'
          if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) return true

          // Banco + Wallet → verificar por separado (misma lógica que matchesProfile)
          if (req.bankId && req.walletId) {
            const hasBankMatch = uCards.some((c: any) => {
              if (c.bankId !== req.bankId) return false
              if (req.cardNetworkId && c.cardNetworkId !== req.cardNetworkId) return false
              if (req.cardType && c.cardType !== req.cardType) return false
              if (req.segmentId && c.segmentId !== req.segmentId) return false
              if ((req.accountType === 'JUBILADO' || req.accountType === 'ANSES') && !c.isPensioner) return false
              if (req.accountType === 'HABERES' && !c.isPayroll) return false
              return true
            })
            if (!hasBankMatch) return false
            return uCards.some((c: any) => c.walletId === req.walletId)
          }

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
