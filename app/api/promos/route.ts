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
    const categorySlugs = searchParams.get('categories')
      ?.split(',')
      .map(s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      .filter(Boolean) ?? []
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
    const discountRanges = searchParams.get('discountRanges')?.split(',').filter(Boolean) ?? []
    const hasInstallments = searchParams.get('hasInstallments') // 'true' | 'false' | null
    const commerceIds = searchParams.get('commerces')?.split(',').filter(Boolean)

    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

    // Auto-expiration: se maneja en background, no bloquea el request
    prisma.promo.updateMany({
      where: { status: 'ACTIVE', validUntil: { lt: startOfToday } },
      data: { status: 'EXPIRED' }
    }).catch(() => {})

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

    // Filtro por provincia: usuario logueado con addressState, o guest con param ?province=
    const paramProvince = searchParams.get('province')
    let userProvince: string | null = null
    let fetchedUser: any = null

    if (email) {
      // Una sola query: traemos provincia + perfil completo de una vez (evita doble hit a DB)
      const userObj = await prisma.user.findUnique({
        where: { email },
        select: {
          addressState: true,
          financialProfile: { include: { banks: true, wallets: true, cards: true } },
          savedPromos: { select: { promoId: true } },
        }
      })
      userProvince = paramProvince || userObj?.addressState || null
      // Pre-asignar si forMe y no admin (evita segunda query más adelante)
      if (forMe && !isAdmin && userObj?.financialProfile) {
        fetchedUser = userObj as any
      }
    } else {
      userProvince = paramProvince
    }

    if (userProvince) {
      where.AND = [
        {
          OR: [
            { provinces: { hasSome: ['Todas', 'TODAS', userProvince] } },
            { provinces: { isEmpty: true } }
          ]
        }
      ]
    }

    if (categorySlugs.length > 0) {
      where.category = { slug: { in: categorySlugs, not: 'sin-categoria' } }
    } else if (categorySlug && categorySlug !== 'todos') {
      where.category = { slug: categorySlug }
    }

    if (commerceIds?.length) {
      const searchMode = searchParams.get('searchMode') || 'startsWith' // startsWith | contains | exact
      where.commerce = {
        OR: commerceIds.map(name => {
          if (searchMode === 'exact')      return { name: { equals: name, mode: 'insensitive' as const } }
          if (searchMode === 'contains')   return { name: { contains: name, mode: 'insensitive' as const } }
          return { name: { startsWith: name, mode: 'insensitive' as const } }
        })
      }
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
        commerce: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            instagramUrl: true,
          },
        },
        requirements: {
          include: {
            bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
            wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
            cardNetwork: { select: { id: true, name: true, slug: true } },
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

    // Guest profile: perfil temporal sin registro (viene en query param base64)
    const guestProfileParam = searchParams.get('guest_profile')
    let guestCards: any[] | null = null
    if (guestProfileParam) {
      try {
        const decoded = JSON.parse(Buffer.from(guestProfileParam, 'base64').toString('utf-8'))
        if (Array.isArray(decoded?.cards)) guestCards = decoded.cards
      } catch {}
    }

    // ADMIN BYPASS: Si es admin, NO filtrar por perfil financiero
    // Mapa cardTier → segmentId: para matchear tiers (Selecta, Eminent) con segmentos del perfil
    const tierToSegmentId = new Map<string, string>()
    if (forMe && email && !isAdmin) {
      // fetchedUser ya fue cargado arriba junto con la provincia (evita segunda query)
      if (!fetchedUser) {
        fetchedUser = await prisma.user.findUnique({
          where: { email },
          select: {
            addressState: true,
            financialProfile: { include: { banks: true, wallets: true, cards: true } },
            savedPromos: { select: { promoId: true } },
          }
        }) as any
      }
      userProfile = (fetchedUser as any)?.financialProfile || null

      // Cargar segmentos bancarios en paralelo con otras operaciones si es necesario
      if (userProfile) {
        const allSegments = await prisma.bankSegment.findMany({ select: { id: true, name: true } })
        for (const seg of allSegments) {
          tierToSegmentId.set(seg.name.toUpperCase(), seg.id)
        }
      }
    }

    // Usar guest profile si no hay usuario logueado con perfil en DB
    const effectiveCards = userProfile?.cards ?? (guestCards && forMe ? guestCards : null)

    // Tarjetas virtuales desde UserWallet (para matching cuando el usuario solo tiene wallets)
    const walletVirtualCards = (userProfile?.wallets ?? []).map((w: any) => ({
      walletId: w.walletId, bankId: null, cardNetworkId: null,
      cardType: 'ACCOUNT', cardSegmentId: null, segmentId: null,
      cardTier: null, isPayroll: false, isPensioner: false,
    }))

    const hasProfile = forMe && !isAdmin && (effectiveCards || walletVirtualCards.length > 0)

    if (hasProfile) {
      const userCards = [...(effectiveCards ?? []), ...walletVirtualCards]
      const savedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])

      // Función estricta de matching: verifica que el perfil del usuario
      // satisface los criterios del requirement.
      const matchesProfile = (req: any): boolean => {
        // ═══════════════════════════════════════════════════════════════════════
        // REGLA 1: Requisito sin restricciones → aplica para TODOS
        // ═══════════════════════════════════════════════════════════════════════
        const hasEntityConstraint = req.bankId || req.walletId
        const hasCardConstraint = req.cardNetworkId || req.cardType
        const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'

        if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) {
          return false // Con perfil activo, requerir match explícito
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
          // REGLA ESPECIAL: Si el requirement pide Banco Provincia + Cuenta DNI,
          // basta con que el usuario tenga Cuenta DNI (implica tener cuenta en Banco Provincia)
          const CUENTA_DNI_WALLET_ID = '5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4'
          const BANCO_PROVINCIA_ID = 'cmnulzeoy0007qlkk1oepw305'
          const isCuentaDniReq = req.walletId === CUENTA_DNI_WALLET_ID && req.bankId === BANCO_PROVINCIA_ID
          if (isCuentaDniReq) {
            return userCards.some(card => card.walletId === CUENTA_DNI_WALLET_ID)
          }

          // ¿Tiene una card del banco correcto con la red/tipo correctos?
          const hasBankMatch = userCards.some(card => {
            if (card.bankId !== req.bankId) return false
            if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) return false
            if (req.cardType && card.cardType !== req.cardType) return false
            if (req.segmentId && card.segmentId !== req.segmentId) return false
            if (req.cardSegmentId && card.cardSegmentId !== req.cardSegmentId) return false
            if (req.cardTier && !req.cardSegmentId) {
              const requiredSegId = tierToSegmentId.get(req.cardTier)
              if (requiredSegId && card.segmentId !== requiredSegId) return false
            }
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

          // ─── Segmento de tarjeta (ej: Visa Gold, AmEx Black Macro Selecta) ──
          if (req.cardSegmentId && card.cardSegmentId !== req.cardSegmentId) return false

          // ─── Tier (SELECTA, EMINENT) → solo si no hay cardSegmentId específico
          // Si cardSegmentId ya validó el segmento (que implica el tier), no re-chequear
          if (req.cardTier && !req.cardSegmentId) {
            const requiredSegId = tierToSegmentId.get(req.cardTier)
            if (requiredSegId && card.segmentId !== requiredSegId) return false
          }

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

    // ── Filtro rango de descuento ─────────────────────────────────────────
    if (discountRanges.length > 0) {
      filtered = filtered.filter(promo => {
        const maxVal = promo.requirements.reduce((max, r) => {
          if (r.discountType === 'CUOTAS_SIN_INTERES' || r.discountType === 'NXM') return max
          return Math.max(max, r.discountValue ?? 0)
        }, 0)
        return discountRanges.some((range: string) => {
          if (range === '0-10')  return maxVal > 0 && maxVal <= 10
          if (range === '10-20') return maxVal > 10 && maxVal <= 20
          if (range === '20-30') return maxVal > 20 && maxVal <= 30
          if (range === '30+')   return maxVal > 30
          return false
        })
      })
    }

    // ── Filtro cuotas sin interés ─────────────────────────────────────────
    if (hasInstallments === 'true') {
      filtered = filtered.filter(promo =>
        promo.requirements.some(r => r.discountType === 'CUOTAS_SIN_INTERES')
      )
    } else if (hasInstallments === 'false') {
      filtered = filtered.filter(promo =>
        promo.requirements.every(r => r.discountType !== 'CUOTAS_SIN_INTERES')
      )
    }

    // ─── Enriquecimiento final de promos ──────────────────────────────────────
    const finalSavedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])
    const finalPromos = filtered.map(p => {
      const allReqs = p.requirements ?? []
      const globalMaxDiscount = allReqs.length > 0 ? allReqs.reduce((max, r) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, allReqs[0]) : null

      let userBestDiscount = null
      if (!isAdmin) {
        const uCards = [...(effectiveCards ?? []), ...walletVirtualCards]
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
              if (req.cardSegmentId && c.cardSegmentId !== req.cardSegmentId) return false
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
              if (!c.walletId) return false
            }
            if (req.walletId && c.walletId !== req.walletId) return false
            if (req.cardNetworkId && c.cardNetworkId !== req.cardNetworkId) return false
            if (req.cardType && c.cardType !== req.cardType) return false
            if (req.segmentId && c.segmentId !== req.segmentId) return false
            if (req.cardSegmentId && c.cardSegmentId !== req.cardSegmentId) return false
            if (req.cardTier && !req.cardSegmentId) {
              const requiredSegId = tierToSegmentId.get(req.cardTier)
              if (requiredSegId && c.segmentId !== requiredSegId) return false
            }
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

    // ── Deduplicación por tier: si el usuario matchea una promo con cardTier
    // para un banco+comercio, ocultar la promo genérica del mismo banco+comercio
    let dedupedPromos = finalPromos
    if (forMe && effectiveCards) {
      // Encontrar todos los (commerceId, bankId) que tienen al menos una promo con tier
      const tierKeys = new Set<string>()
      for (const p of finalPromos) {
        for (const r of (p as any).requirements ?? []) {
          if (r.cardTier) tierKeys.add(`${(p as any).commerceId}|${r.bankId}`)
        }
      }
      if (tierKeys.size > 0) {
        dedupedPromos = finalPromos.filter(p => {
          const reqs = (p as any).requirements ?? []
          const hasTier    = reqs.some((r: any) => r.cardTier)
          const hasGeneric = reqs.some((r: any) => !r.cardTier && tierKeys.has(`${(p as any).commerceId}|${r.bankId}`))
          // Descartar promos puramente genéricas cuando existe una con tier para el mismo banco+comercio
          return !(hasGeneric && !hasTier)
        })
      }
    }

    // ── Ordenamiento ──────────────────────────────────────────────────────
    // Popularidad de comercio: cantidad de promos en el resultado actual (sin _count subquery)
    const commercePromoCount: Record<string, number> = {}
    for (const p of dedupedPromos) {
      const cname = (p as any).commerce?.name ?? ''
      commercePromoCount[cname] = (commercePromoCount[cname] ?? 0) + 1
    }

    // 1. Métricas por promo
    const promoData = dedupedPromos.map(p => {
      const maxPct = (p as any).requirements.reduce((max: number, r: any) => {
        if (r.discountType === 'CUOTAS_SIN_INTERES' || r.discountType === 'NXM') return max
        return Math.max(max, r.discountValue ?? 0)
      }, 0)
      const maxCsi = (p as any).requirements.reduce((max: number, r: any) => {
        if (r.discountType !== 'CUOTAS_SIN_INTERES') return max
        return Math.max(max, r.discountValue ?? 0)
      }, 0)
      const hasNxm: boolean = (p as any).requirements.some((r: any) => r.discountType === 'NXM')
      const catSlug: string = (p as any).category?.slug ?? ''
      const name: string = (p as any).commerce?.name ?? ''
      const commercePopularity: number = commercePromoCount[name] ?? 0
      // Tipo: 1 = % o NXM (sin CSI), 2 = (% o NXM) + CSI, 3 = solo CSI
      const hasMainDiscount = maxPct > 0 || hasNxm
      const type = hasMainDiscount && maxCsi > 0 ? 2 : hasMainDiscount ? 1 : 3
      return { p, maxPct, maxCsi, catSlug, commercePopularity, name, type }
    })

    // 2. Popularidad de categoría = nº de promos tipo 1 y 2 (con %) de esa categoría
    const catCounts: Record<string, number> = {}
    for (const d of promoData) {
      if (d.type !== 3) catCounts[d.catSlug] = (catCounts[d.catSlug] ?? 0) + 1
    }

    // 3. Ordenar:
    //    Grupos 1 y 2 (con %): catPopularity DESC → commercePopularity DESC → mayor descuento DESC → alfabético
    //    Grupo 3 (solo CSI): al final, ordenado por más cuotas DESC
    const orderedPromos = [...promoData].sort((a, b) => {
      // CSI solo siempre va al final
      if (a.type === 3 && b.type !== 3) return 1
      if (b.type === 3 && a.type !== 3) return -1

      // Dentro del grupo CSI: más cuotas primero
      if (a.type === 3 && b.type === 3) {
        return b.maxCsi - a.maxCsi
      }

      // Grupos 1 y 2: popularidad de categoría primero
      const catDiff = (catCounts[b.catSlug] ?? 0) - (catCounts[a.catSlug] ?? 0)
      if (catDiff !== 0) return catDiff

      // Luego popularidad de comercio
      if (b.commercePopularity !== a.commercePopularity) return b.commercePopularity - a.commercePopularity

      // Luego mayor descuento %
      if (b.maxPct !== a.maxPct) return b.maxPct - a.maxPct

      return a.name.localeCompare(b.name, 'es')
    }).map(d => d.p)

    return NextResponse.json({ promos: orderedPromos })
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
      status, sourceUrl, sourceNote, commerceNote, provinces,
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
        commerceNote: commerceNote || null,
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
