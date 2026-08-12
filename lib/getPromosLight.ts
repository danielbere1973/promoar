// SPIKE (spike/two-stage-hydration-recommendations) — no integrado, no tocar
// fuera de esta rama. Ver diseno-two-stage-hydration.md para el diseño
// aprobado por CPO y validacion-two-stage-hydration.md para el resultado.
//
// Camino alternativo, aislado, para /api/promos/recommended: en vez de
// hidratar TODAS las promos candidatas con sus relaciones completas
// (category, commerce, requirements→bank/wallet/cardNetwork) y recién
// después rankear, esta función:
//   1. Trae candidatas con un SELECT liviano (columnas escalares + FKs,
//      sin objetos relacionados, salvo locationModel/branches.province que
//      el filtro geográfico ADR-001 necesita).
//   2. Corre matchesProfile()/userBestDiscount() (misma lógica que
//      getPromos.ts, sin cambios) sobre ese payload liviano.
//   3. Devuelve las promos livianas filtradas — el caller aplica
//      rankForHome() y recién ahí hidrata completas solo las 3 finalistas.
//
// No reemplaza getPromosData() ni el path de /api/promos — es exclusivo del
// Recommendation Block mientras se mide el spike.

import { prisma } from '@/lib/prisma'
import {
  getCandidatePromosForProfile,
  normalizeProvince,
  describeProvinceScope,
  NATIONAL_COVERAGE_THRESHOLD,
} from '@/lib/getPromos'

export interface LightPerf {
  candidateQueryMs: number
  candidateRows: number
  candidateHitLimit: boolean
  rankingHydrationMs: number
  profileMatchMs: number
}

export interface LightPromo {
  id: string
  categoryId: string
  commerceId: string
  salesChannel: string
  geographicScope: string
  provinces: string[]
  validDays: number
  validUntil: Date | null
  specificDates: string | null
  isSaved: boolean
  userBestDiscount: any
  requirements: any[]
  coverageStatus?: string
  coverageLabel?: string
}

const MODO_WALLET_ID = 'cmnulzh04000aqlkk8mnpzo46'
const CUENTA_DNI_WALLET_ID = '5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4'
const BANCO_PROVINCIA_ID = 'cmnulzeoy0007qlkk1oepw305'

/**
 * Etapa 1 del two-stage hydration: candidate selection (sin cambios, ya
 * aprobado) + hidratación liviana + gate financiero + gate geográfico.
 * Devuelve promos "livianas" (sin category/commerce/bank/wallet/cardNetwork
 * hidratados) ya filtradas y con userBestDiscount calculado — listas para
 * pasar a rankForHome().
 */
export async function getLightRecommendationCandidates(params: {
  email?: string | null
  guestProfileParam?: string | null
  province?: string | null
  isAdmin?: boolean
}): Promise<{ promos: LightPromo[]; perf: LightPerf }> {
  const { email, guestProfileParam, province: paramProvince, isAdmin = false } = params
  const perfStart = Date.now()

  let userProvince: string | null = null
  let fetchedUser: any = null

  if (email) {
    fetchedUser = await prisma.user.findUnique({
      where: { email },
      select: {
        addressState: true,
        financialProfile: { include: { banks: true, wallets: true, cards: true } },
        savedPromos: { select: { promoId: true } },
      },
    })
    userProvince = paramProvince || fetchedUser?.addressState || null
  } else {
    userProvince = paramProvince ?? null
  }

  const userProfile = fetchedUser?.financialProfile ?? null

  let guestCards: any[] | null = null
  if (!userProfile && guestProfileParam) {
    try {
      const decoded = JSON.parse(Buffer.from(guestProfileParam, 'base64').toString('utf-8'))
      if (Array.isArray(decoded?.cards)) guestCards = decoded.cards
    } catch {}
  }

  const effectiveCards = userProfile?.cards ?? guestCards ?? []
  const walletVirtualCards = (userProfile?.wallets ?? [])
    .filter((w: any) => w.walletId !== MODO_WALLET_ID)
    .map((w: any) => ({
      walletId: w.walletId, bankId: null, cardNetworkId: null,
      cardType: 'ACCOUNT', cardSegmentId: null, segmentId: null,
      cardTier: null, isPayroll: false, isPensioner: false,
    }))
  const userCards = [...effectiveCards, ...walletVirtualCards]

  const tierToSegmentId = new Map<string, string>()
  if (userProfile) {
    const allSegments = await prisma.bankSegment.findMany({ select: { id: true, name: true } })
    for (const seg of allSegments) tierToSegmentId.set(seg.name.toUpperCase(), seg.id)
  }

  const candidateUserBankIds = Array.from(new Set(
    [...effectiveCards, ...(userProfile?.banks ?? [])].map((c: any) => c.bankId).filter((id: any): id is string => !!id)
  ))
  const candidateUserWalletIds = Array.from(new Set(
    [...effectiveCards, ...(userProfile?.wallets ?? [])].map((c: any) => c.walletId).filter((id: any): id is string => !!id)
  ))
  const savedPromoIds: string[] = fetchedUser ? fetchedUser.savedPromos.map((sp: any) => sp.promoId) : []
  const savedSet = new Set(savedPromoIds)

  const candidates = await getCandidatePromosForProfile({
    dayBit: null, // view='week' — el gate de vigencia de "hoy" lo re-aplica rankForHome()
    province: userProvince,
    userBankIds: candidateUserBankIds,
    userWalletIds: candidateUserWalletIds,
    savedPromoIds,
  })

  const perf: LightPerf = {
    candidateQueryMs: candidates.queryMs,
    candidateRows: candidates.ids.length,
    candidateHitLimit: candidates.hitLimit,
    rankingHydrationMs: 0,
    profileMatchMs: 0,
  }

  if (!candidates.ids.length) {
    perf.rankingHydrationMs = 0
    return { promos: [], perf }
  }

  const hydrationT0 = Date.now()
  const rows = await prisma.promo.findMany({
    where: { id: { in: candidates.ids } },
    select: {
      id: true,
      categoryId: true,
      commerceId: true,
      salesChannel: true,
      geographicScope: true,
      provinces: true,
      validDays: true,
      validUntil: true,
      specificDates: true,
      commerce: {
        select: {
          locationModel: true,
          ...(userProvince && !isAdmin
            ? { branches: { select: { province: true }, where: { province: { not: null } } } }
            : {}),
        },
      },
      requirements: {
        select: {
          id: true,
          bankId: true, walletId: true, cardNetworkId: true, cardType: true,
          segmentId: true, cardSegmentId: true, cardTier: true, accountType: true,
          discountValue: true, discountType: true, cap: true, capUnlimited: true,
        },
      },
    },
  })
  perf.rankingHydrationMs = Date.now() - hydrationT0

  const orderIndex = new Map(candidates.ids.map((id, i) => [id, i]))
  rows.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))

  // ── Gate geográfico (ADR-001) — misma lógica que getPromos.ts:710-780, sobre payload liviano ──
  let geoFiltered = rows as any[]
  if (userProvince && !isAdmin) {
    const userProvinceNorm = normalizeProvince(userProvince)
    geoFiltered = rows.filter((promo: any) => {
      const salesChannel = promo.salesChannel ?? 'UNKNOWN'
      const geographicScope = promo.geographicScope ?? 'UNKNOWN'
      const locationModel = promo.commerce?.locationModel ?? 'UNKNOWN'

      if (salesChannel === 'ONLINE') {
        if (geographicScope === 'NO_GEOGRAPHIC_RESTRICTION' || geographicScope === 'NATIONWIDE') {
          promo.coverageStatus = 'ONLINE'
          return true
        }
        if (geographicScope === 'PROVINCES') {
          const ps = promo.provinces as string[]
          if (!ps?.length) { promo.coverageStatus = 'UNKNOWN'; return true }
          const matches = ps.some(p => normalizeProvince(p) === userProvinceNorm || ['todas', 'all'].includes(normalizeProvince(p)))
          if (matches) promo.coverageStatus = 'ONLINE'
          return matches
        }
        promo.coverageStatus = 'ONLINE'
        return true
      }

      if (locationModel === 'MOBILE_SERVICE' || locationModel === 'NO_FIXED_LOCATION') {
        promo.coverageStatus = 'ONLINE'
        return true
      }

      if (geographicScope === 'NATIONWIDE') {
        promo.coverageStatus = 'TERRITORIAL'
        promo.coverageLabel = 'Todo el país'
        return true
      }

      if (geographicScope === 'PROVINCES') {
        const ps = promo.provinces as string[]
        if (!ps?.length) { promo.coverageStatus = 'UNKNOWN'; return true }
        const matches = ps.some(p => normalizeProvince(p) === userProvinceNorm || ['todas', 'all'].includes(normalizeProvince(p)))
        if (matches) {
          promo.coverageStatus = 'TERRITORIAL'
          promo.coverageLabel = describeProvinceScope(ps)
        }
        return matches
      }

      const branches = promo.commerce?.branches as { province: string | null }[] | undefined
      if (!branches?.length) { promo.coverageStatus = 'UNKNOWN'; return true }
      const branchProvinces = new Set(branches.map(b => normalizeProvince(b.province as string)))

      if (locationModel === 'UNKNOWN' && branchProvinces.size >= NATIONAL_COVERAGE_THRESHOLD) {
        promo.coverageStatus = 'TERRITORIAL'
        promo.coverageLabel = describeProvinceScope(Array.from(branchProvinces))
        return true
      }

      const hasNearbyBranch = branchProvinces.has(userProvinceNorm)
      if (hasNearbyBranch) promo.coverageStatus = 'NEARBY'
      return hasNearbyBranch
    })
  }
  for (const p of geoFiltered) delete p.commerce // ya no hace falta el objeto commerce liviano

  // Filtro de specificDates (mismo criterio que getPromos.ts:676-692, view='week')
  const todayStr = new Date().toISOString().split('T')[0]
  geoFiltered = geoFiltered.filter((p: any) => {
    if (!p.specificDates) return true
    try {
      const dates: string[] = JSON.parse(p.specificDates)
      if (!dates.length) return true
      return dates.some(d => d >= todayStr)
    } catch {
      return true
    }
  })

  // ── Gate financiero (matchesProfile) — misma lógica exacta que getPromos.ts:850-948 ──
  const matchesProfile = (req: any): boolean => {
    const hasEntityConstraint = req.bankId || req.walletId
    const hasCardConstraint = req.cardNetworkId || req.cardType
    const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'
    if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) return false

    if (req.bankId && req.walletId) {
      const isCuentaDniReq = req.walletId === CUENTA_DNI_WALLET_ID && req.bankId === BANCO_PROVINCIA_ID
      if (isCuentaDniReq) {
        return userCards.some((card: any) => card.walletId === CUENTA_DNI_WALLET_ID)
      }
      const hasBankMatch = userCards.some((card: any) => {
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
      return userCards.some((card: any) => card.walletId === req.walletId)
    }

    return userCards.some((card: any) => {
      if (req.bankId) {
        if (card.bankId !== req.bankId) return false
      } else if (req.walletId && !req.bankId) {
        if (!card.walletId) return false
      }
      if (req.walletId && card.walletId !== req.walletId) return false
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
  }

  const profileMatchStart = Date.now()
  const matched = geoFiltered.filter((promo: any) => {
    if (savedSet.has(promo.id)) return true
    if (!promo.requirements.length) return false
    return promo.requirements.some((req: any) => matchesProfile(req))
  })
  perf.profileMatchMs = Date.now() - profileMatchStart

  // ── userBestDiscount — misma lógica exacta que getPromos.ts:1034-1089 ──
  const finalPromos: LightPromo[] = matched.map((p: any) => {
    const allReqs = p.requirements ?? []
    let userBestDiscount = null
    const matching = allReqs.filter((req: any) => {
      const hasEntityConstraint = req.bankId || req.walletId
      const hasCardConstraint = req.cardNetworkId || req.cardType
      const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'
      if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) return true

      if (req.bankId && req.walletId) {
        const hasBankMatch = userCards.some((c: any) => {
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
        return userCards.some((c: any) => c.walletId === req.walletId)
      }

      return userCards.some((c: any) => {
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

    return {
      id: p.id,
      categoryId: p.categoryId,
      commerceId: p.commerceId,
      salesChannel: p.salesChannel,
      geographicScope: p.geographicScope,
      provinces: p.provinces,
      validDays: p.validDays,
      validUntil: p.validUntil,
      specificDates: p.specificDates,
      isSaved: savedSet.has(p.id),
      userBestDiscount,
      requirements: p.requirements,
      coverageStatus: p.coverageStatus,
      coverageLabel: p.coverageLabel,
    }
  })

  // ── Deduplicación por tier — misma lógica exacta que getPromos.ts:1085-1105 ──
  // Si el usuario matchea una promo con cardTier para un banco+comercio, ocultar
  // la promo genérica del mismo banco+comercio (evita mostrar ambas).
  let dedupedPromos = finalPromos
  if (userProfile || guestCards) {
    const tierKeys = new Set<string>()
    for (const p of finalPromos) {
      for (const r of p.requirements ?? []) {
        if (r.cardTier) tierKeys.add(`${p.commerceId}|${r.bankId}`)
      }
    }
    if (tierKeys.size > 0) {
      dedupedPromos = finalPromos.filter(p => {
        const reqs = p.requirements ?? []
        const hasTier = reqs.some((r: any) => r.cardTier)
        const hasGeneric = reqs.some((r: any) => !r.cardTier && tierKeys.has(`${p.commerceId}|${r.bankId}`))
        return !(hasGeneric && !hasTier)
      })
    }
  }

  // ── Ordenamiento — misma lógica exacta que getPromos.ts:1113-1165 ──
  // El oráculo (getPromosData) devuelve las promos en este orden (popularidad
  // de categoría → tipo → % descuento → alfabético) ANTES de pasarlas a
  // rankForHome(). rankForHome() desempata por posición de array cuando dos
  // promos tienen el mismo score (ej. mismo % de descuento) — sin este mismo
  // orden de entrada, los empates se resuelven distinto entre ambos paths.
  const commerceIds = Array.from(new Set(dedupedPromos.map(p => p.commerceId)))
  const categoryIds = Array.from(new Set(dedupedPromos.map(p => p.categoryId)))
  const [commerceRows, categoryRows] = await Promise.all([
    prisma.commerce.findMany({ where: { id: { in: commerceIds } }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, slug: true } }),
  ])
  const commerceNameById = new Map(commerceRows.map(c => [c.id, c.name]))
  const categorySlugById = new Map(categoryRows.map(c => [c.id, c.slug]))

  const promoData = dedupedPromos.map(p => {
    const maxPct = (p.requirements ?? []).reduce((max: number, r: any) => {
      if (r.discountType === 'CUOTAS_SIN_INTERES' || r.discountType === 'NXM') return max
      return Math.max(max, r.discountValue ?? 0)
    }, 0)
    const maxCsi = (p.requirements ?? []).reduce((max: number, r: any) => {
      if (r.discountType !== 'CUOTAS_SIN_INTERES') return max
      return Math.max(max, r.discountValue ?? 0)
    }, 0)
    const hasNxm: boolean = (p.requirements ?? []).some((r: any) => r.discountType === 'NXM')
    const catSlug: string = categorySlugById.get(p.categoryId) ?? ''
    const name: string = commerceNameById.get(p.commerceId) ?? ''
    const hasMainDiscount = maxPct > 0 || hasNxm
    const type = hasMainDiscount && maxCsi > 0 ? 2 : hasMainDiscount ? 1 : 3
    return { p, maxPct, maxCsi, catSlug, name, type }
  })

  const catCounts: Record<string, number> = {}
  for (const d of promoData) {
    if (d.type !== 3) catCounts[d.catSlug] = (catCounts[d.catSlug] ?? 0) + 1
  }

  const orderedPromos = [...promoData].sort((a, b) => {
    if (a.type === 3 && b.type !== 3) return 1
    if (b.type === 3 && a.type !== 3) return -1
    if (a.type === 3 && b.type === 3) return b.maxCsi - a.maxCsi
    const catDiff = (catCounts[b.catSlug] ?? 0) - (catCounts[a.catSlug] ?? 0)
    if (catDiff !== 0) return catDiff
    if (a.type !== b.type) return a.type - b.type
    if (b.maxPct !== a.maxPct) return b.maxPct - a.maxPct
    return a.name.localeCompare(b.name, 'es')
  }).map(d => d.p)

  return { promos: orderedPromos, perf }
}

/**
 * Etapa 2: hidrata completas SOLO las promos cuyos ids se pasan (pensado
 * para el Top 3 ya decidido por rankForHome()). Reordena explícitamente el
 * resultado según `ids` — Prisma/Postgres no garantizan el orden de un
 * `where: { id: { in } } `.
 */
export async function hydrateFinalPromos(ids: string[], userProvince: string | null, isAdmin: boolean) {
  if (!ids.length) return []
  const rows = await prisma.promo.findMany({
    where: { id: { in: ids } },
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
          locationModel: true,
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
  })
  const byId = new Map(rows.map(r => [r.id, r]))
  return ids.map(id => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r)
}
