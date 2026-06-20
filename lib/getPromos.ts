import { prisma } from '@/lib/prisma'

// Normaliza nombres de provincia para comparar texto libre (perfil de usuario)
// contra nombres de Nominatim (CommerceBranch.province): sin acentos, minúsculas,
// y alias comunes de CABA / Buenos Aires.
function normalizeProvince(s: string): string {
  const n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  if (['caba', 'capital federal', 'ciudad de buenos aires', 'ciudad autonoma de buenos aires', 'ciudad autonoma de bs. as.', 'ciudad autonoma de bs as'].includes(n)) {
    return 'caba'
  }
  if (['buenos aires', 'bs as', 'bs. as.', 'pba', 'provincia de buenos aires', 'gba', 'gran buenos aires'].includes(n)) {
    return 'buenos aires'
  }
  return n
}

// Por encima de esta cantidad de provincias distintas con sucursales, se considera
// que el comercio tiene cobertura nacional y no se filtra por ubicación.
const NATIONAL_COVERAGE_THRESHOLD = 4

export interface PromoQueryParams {
  categorySlug?: string | null
  categorySlugs?: string[]
  day?: string | null
  forMe?: boolean
  bankIds?: string[]
  walletIds?: string[]
  networkIds?: string[]
  channels?: string[]
  capPeriods?: string[]
  hasCap?: string | null
  capMin?: number | null
  capMax?: number | null
  dateFromStr?: string | null
  dateToStr?: string | null
  dayIndices?: number[]
  view?: string | null
  discountRanges?: string[]
  hasInstallments?: string | null
  commerceIds?: string[]
  searchMode?: string | null
  province?: string | null
  guestProfileParam?: string | null
  /** Limita la cantidad de promos consultadas (usado para el preview SSR). */
  take?: number
  /** Activar paginación keyset (invitados sin filtros). */
  paginate?: boolean
  /** Página 1-based para paginación (default 1). */
  page?: number
  /** Cantidad de promos por página (default 500). */
  pageSize?: number
}

export async function getPromosData(params: PromoQueryParams, email?: string | null, isAdmin?: boolean) {
  const {
    categorySlug = null,
    categorySlugs = [],
    day = null,
    forMe = false,
    bankIds,
    walletIds,
    networkIds,
    channels,
    capPeriods,
    hasCap = null,
    capMin = null,
    capMax = null,
    dateFromStr = null,
    dateToStr = null,
    dayIndices,
    view = null,
    discountRanges = [],
    hasInstallments = null,
    commerceIds,
    searchMode = 'startsWith',
    province: paramProvince = null,
    guestProfileParam = null,
    take,
    paginate = false,
    page = 1,
    pageSize = 500,
  } = params

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

  const paginateOrderBy = paginate
    ? [
        { isCSIOnly: 'asc' as const },
        { maxDiscountPct: { sort: 'desc' as const, nulls: 'last' as const } },
        { id: 'asc' as const },
      ]
    : undefined

  const [promos, totalCount] = await Promise.all([
    prisma.promo.findMany({
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
            activePromoCount: true,
            branches: { select: { province: true }, where: { province: { not: null } } },
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
      orderBy: paginateOrderBy ?? (take ? [{ isFeatured: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' }),
      ...(paginate ? { take: pageSize, skip: (page - 1) * pageSize } : take ? { take } : {}),
    }),
    prisma.promo.count({ where }),
  ])

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


  // ── Filtro geográfico: comercios regionales sin sucursales en la provincia del usuario ──
  // Solo aplica si conocemos la provincia del usuario (perfil o ?province=) y el comercio
  // tiene sucursales con provincia cargada (CommerceBranch.province, ver punto 10 CLAUDE.md).
  // Si no hay datos de sucursales, o si el comercio tiene presencia en muchas provincias
  // (cadena nacional), no se filtra. Admins ven todo sin filtro geográfico.
  if (userProvince && !isAdmin) {
    const userProvinceNorm = normalizeProvince(userProvince)
    filtered = filtered.filter(promo => {
      const branches = (promo as any).commerce?.branches as { province: string | null }[] | undefined
      if (!branches?.length) return true

      const provinces = new Set(branches.map(b => normalizeProvince(b.province as string)))
      if (provinces.size >= NATIONAL_COVERAGE_THRESHOLD) return true

      return provinces.has(userProvinceNorm)
    })
  }
  // Ya no se necesita `branches` en la respuesta
  for (const p of filtered) {
    if ((p as any).commerce) delete (p as any).commerce.branches
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTRADO POR PERFIL FINANCIERO - CON BYPASS PARA ADMIN
  // ═══════════════════════════════════════════════════════════════════════
  let userProfile = null

  // Guest profile: perfil temporal sin registro (viene en query param base64)
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

  // Para el path paginado (invitados sin filtros), el orden viene de la DB y no hay dedup por tier.
  // Solo se aplican los filtros JS de bitmask y specificDates (ya aplicados en `filtered`).
  if (paginate) {
    return { promos: filtered as any[], totalCount, hasMore: totalCount > page * pageSize }
  }

  // ── Ordenamiento (path no-paginado: usuarios con perfil o filtros complejos) ────────────
  // Popularidad de comercio: cantidad de promos en el resultado actual
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

  return { promos: orderedPromos, totalCount, hasMore: false }
}
