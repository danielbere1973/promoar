import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

export const dynamic = 'force-dynamic'

// Búsqueda de productos: "¿qué comercios venden carteras?"
// Busca en el catálogo scrapeado (CommerceProduct) y devuelve los comercios
// que lo venden junto con sus promos activas, filtradas por perfil financiero
// si el usuario pidió "para mí". Precios NO se modelan acá — ver CLAUDE.md punto 9
// (deben consultarse en línea, nunca scrapearse).
// Word-boundary check: ensures "litera" doesn't match inside "literatura"
function hasWordMatch(text: string | null, term: string): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  const idx = t.indexOf(term)
  if (idx === -1) return false
  const before = idx === 0 || !/[a-záéíóúñü]/.test(t[idx - 1])
  const after = idx + term.length >= t.length || !/[a-záéíóúñü]/.test(t[idx + term.length])
  return before && after
}

const STOP_WORDS = new Set(['para', 'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'con', 'sin', 'en', 'a'])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const forMe = searchParams.get('for_me') === 'true'

    if (!q || q.length < 2) {
      return NextResponse.json({ commerces: [] })
    }

    const qLower = q.toLowerCase()
    const words = qLower.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    const searchTerms = words.length > 0 ? words : [qLower]

    // Build OR conditions for all search terms across all fields
    const orConditions = searchTerms.flatMap(term => [
      { categoria: { contains: term, mode: 'insensitive' as const } },
      { subcategoria: { contains: term, mode: 'insensitive' as const } },
      { productos: { contains: term, mode: 'insensitive' as const } },
    ])

    const allMatches = await prisma.commerceProduct.findMany({
      where: { OR: orConditions },
      select: { commerceId: true, categoria: true, subcategoria: true, productos: true },
    })

    // Filter out word-boundary false positives and score by how many search terms match
    const matchedCategoriesByCommerce = new Map<string, Set<string>>()
    const relevanceByCommerce = new Map<string, number>()
    const wordMatchCountByCommerce = new Map<string, Set<string>>()

    for (const m of allMatches) {
      // Check each search term with word boundaries
      const matchedTerms = searchTerms.filter(term =>
        hasWordMatch(m.categoria, term) ||
        hasWordMatch(m.subcategoria, term) ||
        hasWordMatch(m.productos, term)
      )
      if (matchedTerms.length === 0) continue

      const set = matchedCategoriesByCommerce.get(m.commerceId) ?? new Set<string>()
      set.add(m.subcategoria || m.categoria)
      matchedCategoriesByCommerce.set(m.commerceId, set)

      const termSet = wordMatchCountByCommerce.get(m.commerceId) ?? new Set<string>()
      matchedTerms.forEach(t => termSet.add(t))
      wordMatchCountByCommerce.set(m.commerceId, termSet)

      const currentRel = relevanceByCommerce.get(m.commerceId) ?? 0
      let rel = 1
      if (m.categoria?.toLowerCase() === qLower) rel = 3
      else if (matchedTerms.some(t => hasWordMatch(m.categoria, t) && m.categoria!.toLowerCase().split(/[\s|,]+/).some(w => w.trim() === t))) rel = 3
      else if (matchedTerms.some(t => hasWordMatch(m.subcategoria, t))) rel = 2
      if (rel > currentRel) relevanceByCommerce.set(m.commerceId, rel)
    }

    const matches = allMatches.filter(m => matchedCategoriesByCommerce.has(m.commerceId))
    const commerceIds = Array.from(matchedCategoriesByCommerce.keys())

    // ── Perfil financiero del usuario (mismo criterio que /api/promos) ──────
    const session = await getServerSession()
    const email = session?.user?.email || req.headers.get('x-user-email')
    const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'

    // Guest profile: perfil temporal sin registro (viene en query param base64)
    const guestProfileParam = searchParams.get('guest_profile')
    let guestCards: any[] | null = null
    if (guestProfileParam) {
      try {
        const decoded = JSON.parse(Buffer.from(guestProfileParam, 'base64').toString('utf-8'))
        if (Array.isArray(decoded?.cards)) guestCards = decoded.cards
      } catch {}
    }

    let userCards: any[] = []
    const tierToSegmentId = new Map<string, string>()
    if (forMe && email && !isAdmin) {
      const userObj = await prisma.user.findUnique({
        where: { email },
        select: { financialProfile: { include: { banks: true, wallets: true, cards: true } } },
      })
      const profile = userObj?.financialProfile
      if (profile) {
        const walletVirtualCards = (profile.wallets ?? []).map((w: any) => ({
          walletId: w.walletId, bankId: null, cardNetworkId: null,
          cardType: 'ACCOUNT', cardSegmentId: null, segmentId: null,
          cardTier: null, isPayroll: false, isPensioner: false,
        }))
        userCards = [...(profile.cards ?? []), ...walletVirtualCards]
      }
    } else if (forMe && !email && guestCards?.length) {
      userCards = guestCards
    }

    if (userCards.length > 0) {
      const allSegments = await prisma.bankSegment.findMany({ select: { id: true, name: true } })
      for (const seg of allSegments) tierToSegmentId.set(seg.name.toUpperCase(), seg.id)
    }

    const hasProfile = forMe && !isAdmin && userCards.length > 0

    // Misma lógica estricta de matching que /api/promos (REGLA 1-3)
    const matchesProfile = (req: any): boolean => {
      const hasEntityConstraint = req.bankId || req.walletId
      const hasCardConstraint = req.cardNetworkId || req.cardType
      const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'
      if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) return false

      if (req.bankId && req.walletId) {
        const CUENTA_DNI_WALLET_ID = '5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4'
        const BANCO_PROVINCIA_ID = 'cmnulzeoy0007qlkk1oepw305'
        const isCuentaDniReq = req.walletId === CUENTA_DNI_WALLET_ID && req.bankId === BANCO_PROVINCIA_ID
        if (isCuentaDniReq) {
          return userCards.some(card => card.walletId === CUENTA_DNI_WALLET_ID)
        }

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
        return userCards.some(card => card.walletId === req.walletId)
      }

      return userCards.some(card => {
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
        if (req.accountType === 'JUBILADO' || req.accountType === 'ANSES') {
          if (!card.isPensioner) return false
        }
        if (req.accountType === 'HABERES') {
          if (!card.isPayroll) return false
        }
        return true
      })
    }

    // ── Comercios + sus promos activas ──────────────────────────────────────
    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

    const commerces = await prisma.commerce.findMany({
      where: { id: { in: commerceIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        promos: {
          where: {
            status: 'ACTIVE',
            category: { slug: { not: 'sin-categoria' } },
            validFrom: { lte: today },
            OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
          },
          include: {
            category: { select: { name: true, slug: true, icon: true, color: true } },
            requirements: {
              include: {
                bank: { select: { id: true, name: true, logoUrl: true } },
                wallet: { select: { id: true, name: true, logoUrl: true } },
                cardNetwork: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    })

    const results = commerces.map(c => {
      let promos = c.promos
      if (hasProfile) {
        promos = promos.filter(p => p.requirements.length > 0 && p.requirements.some(r => matchesProfile(r)))
      }
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logoUrl,
        matchedCategories: Array.from(matchedCategoriesByCommerce.get(c.id) ?? []),
        promoCount: promos.length,
        promos,
      }
    })

    // Más palabras de la query que matchean primero, luego relevancia, luego promos
    results.sort((a, b) => {
      const wordsA = wordMatchCountByCommerce.get(a.id)?.size ?? 0
      const wordsB = wordMatchCountByCommerce.get(b.id)?.size ?? 0
      if (wordsB !== wordsA) return wordsB - wordsA
      const relA = relevanceByCommerce.get(a.id) ?? 1
      const relB = relevanceByCommerce.get(b.id) ?? 1
      if (relB !== relA) return relB - relA
      if (b.promoCount !== a.promoCount) return b.promoCount - a.promoCount
      return a.name.localeCompare(b.name, 'es')
    })

    return NextResponse.json({ commerces: results })
  } catch (error) {
    console.error('[GET /api/search/products]', error)
    return NextResponse.json({ error: 'Error al buscar productos' }, { status: 500 })
  }
}
