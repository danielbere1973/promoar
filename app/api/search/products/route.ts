import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { SEARCH_PRODUCTS_TAG } from '@/lib/cache/promosCache'

export const dynamic = 'force-dynamic'

const MAX_QUERY_LENGTH = 60
const CANDIDATE_TAKE = 2000

// Búsqueda de productos: "¿qué comercios venden carteras?"
// Busca en el catálogo scrapeado (CommerceProduct) y devuelve los comercios
// que lo venden junto con sus promos activas, filtradas por perfil financiero
// si el usuario pidió "para mí". Precios NO se modelan acá — ver CLAUDE.md punto 9
// (deben consultarse en línea, nunca scrapearse).
// Ignora acentos al comparar — "cafe" debe matchear "Café" y viceversa.
function normalizeAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Word-boundary check con soporte de singular/plural en español
function normalizeWord(w: string): string {
  return normalizeAccents(w).trim()
}

function wordMatchesTerm(word: string, term: string): boolean {
  if (word === term) return true
  // Singular / Plural en español (corbata <-> corbatas, libro <-> libros)
  if (word.endsWith('s') && word.slice(0, -1) === term) return true
  if (term.endsWith('s') && term.slice(0, -1) === word) return true
  // Plurales en -es (pantalon <-> pantalones, botin <-> botines)
  if (word.endsWith('es') && word.slice(0, -2) === term) return true
  if (term.endsWith('es') && term.slice(0, -2) === word) return true
  return false
}

function hasWordMatch(text: string | null, term: string): boolean {
  if (!text) return false
  const t = normalizeAccents(text)
  const normTerm = normalizeAccents(term)
  // Tokenizar por caracteres no alfanuméricos
  const words = t.split(/[^a-z0-9]+/).filter(Boolean)
  return words.some(w => wordMatchesTerm(w, normTerm))
}

const STOP_WORDS = new Set(['para', 'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'con', 'sin', 'en', 'a'])

type CandidateRow = { commerceId: string; categoria: string; subcategoria: string | null; productos: string | null }
type CommerceNameMatch = { commerceId: string; commerceName: string }

// Etapa cara y 100% pública (no depende de usuario/perfil, ver PASO 1 punto c):
// candidate set por texto normalizado. Antes era un findMany sin WHERE que
// traía toda la tabla CommerceProduct en cada request — ahora un WHERE por
// OR de `contains` (DB, insensitive) por cada término + la query completa
// acota el candidate set antes de traerlo, y el resultado se cachea por
// query normalizada (TTL 10min, invalidado por SEARCH_PRODUCTS_TAG).
function getCachedCandidates(qLower: string, searchTerms: string[]) {
  return unstable_cache(
    async (qLower: string, searchTerms: string[]): Promise<CandidateRow[]> => {
      if (process.env.NODE_ENV === 'production') console.log(`[cache-miss] search-products ${qLower}`)
      const orConditions = [qLower, ...searchTerms].map(term => ({
        OR: [
          { categoria: { contains: term, mode: 'insensitive' as const } },
          { subcategoria: { contains: term, mode: 'insensitive' as const } },
          { productos: { contains: term, mode: 'insensitive' as const } },
        ],
      }))
      return prisma.commerceProduct.findMany({
        where: { OR: orConditions.flatMap(c => c.OR) },
        select: { commerceId: true, categoria: true, subcategoria: true, productos: true },
        take: CANDIDATE_TAKE,
      })
    },
    ['search-products-candidates'],
    { tags: [SEARCH_PRODUCTS_TAG], revalidate: 600 },
  )(qLower, searchTerms)
}

// Match directo por nombre de comercio (ej. "freddo", "farmacity") — antes
// este endpoint solo buscaba en CommerceProduct (categoría/producto), así
// que un comercio sin productos cuyo nombre contenga el término (el caso
// común: casi ningún producto dice "Freddo" en su categoría) nunca aparecía
// pese a tener promos activas. Universo de Commerce es mucho más chico que
// CommerceProduct — igual se cachea por consistencia con el mismo tag/TTL.
function getCachedCommerceNameMatches(qLower: string) {
  return unstable_cache(
    async (qLower: string): Promise<CommerceNameMatch[]> => {
      if (process.env.NODE_ENV === 'production') console.log(`[cache-miss] search-commerce-name ${qLower}`)
      const rows = await prisma.commerce.findMany({
        where: { name: { contains: qLower, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: 200,
      })
      return rows.map(r => ({ commerceId: r.id, commerceName: r.name }))
    },
    ['search-products-commerce-name'],
    { tags: [SEARCH_PRODUCTS_TAG], revalidate: 600 },
  )(qLower)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const qRaw = searchParams.get('q')?.trim()
    const forMe = searchParams.get('for_me') === 'true'

    if (!qRaw || qRaw.length < 2) {
      return NextResponse.json({ commerces: [] })
    }
    if (qRaw.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ commerces: [] })
    }

    const q = qRaw
    const qLower = normalizeAccents(q)
    const words = qLower.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    const searchTerms = words.length > 0 ? words : [qLower]

    // El filtro de acento-insensibilidad + word-boundary exacto sigue en JS
    // (hasWordMatch) porque Prisma/Postgres `contains`+`insensitive` solo
    // ignora mayúsculas, no acentos — el WHERE de arriba solo acota el
    // candidate set, no reemplaza este filtro fino.
    const [allMatches, commerceNameMatches] = await Promise.all([
      getCachedCandidates(qLower, searchTerms),
      getCachedCommerceNameMatches(qLower),
    ])

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
      const normCategoria = m.categoria ? normalizeAccents(m.categoria) : ''
      if (normCategoria === qLower) rel = 3
      else if (matchedTerms.some(t => hasWordMatch(m.categoria, t) && normCategoria.split(/[\s|,]+/).some(w => w.trim() === t))) rel = 3
      else if (matchedTerms.some(t => hasWordMatch(m.subcategoria, t))) rel = 2
      if (rel > currentRel) relevanceByCommerce.set(m.commerceId, rel)
    }

    // Match directo por nombre de comercio (ej. "Freddo", "Farmacity") — se
    // suma al candidate set de arriba aunque el comercio no tenga ningún
    // producto cuyo texto matchee. Relevancia máxima (3): coincidir con el
    // nombre del comercio es una señal más fuerte que coincidir con una
    // categoría de producto. No pisa un rel/wordMatchCount ya puesto por
    // match de producto, solo lo sube si corresponde.
    for (const m of commerceNameMatches) {
      if (!matchedCategoriesByCommerce.has(m.commerceId)) {
        matchedCategoriesByCommerce.set(m.commerceId, new Set<string>())
      }
      const currentRel = relevanceByCommerce.get(m.commerceId) ?? 0
      if (3 > currentRel) relevanceByCommerce.set(m.commerceId, 3)
      const termSet = wordMatchCountByCommerce.get(m.commerceId) ?? new Set<string>()
      termSet.add(qLower)
      wordMatchCountByCommerce.set(m.commerceId, termSet)
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
