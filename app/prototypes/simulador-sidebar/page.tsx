import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import SidebarSimulatorView from './SidebarSimulatorView'
import { FourLevelsCatalog, CatalogEntity } from '@/app/components/SimulatorPaymentSelector'
import { CombustiblePromoItem, FuelBrand } from '@/app/ahorro_interactivo/combustible/CombustibleSimulator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Simulador con Filtros en Árbol Lateral | PromoAR',
  description: 'Prototipo interactivo con filtros multiselección en árbol lateral y comparador en vivo siempre a la vista.',
}

const BENEFIT_CLUB_SLUGS = new Set([
  'club-la-nacion',
  'clarin-365',
  'clarin-365-plus',
  'comunidad-coto',
])

const POPULAR_BANK_SLUGS = [
  'galicia',
  'banco-nacion',
  'santander',
  'bbva',
  'macro',
  'ciudad',
  'credicoop',
  'banco-provincia',
  'patagonia',
  'supervielle',
  'icbc',
  'banco-cordoba',
]

const CARD_ORDER = ['visa', 'mastercard', 'amex', 'cabal', 'maestro']

const NON_FUEL_REGEX = /\b(lubricant|lubricentro|aceite|boxes|vino|vinos|espumante|espumantes|vinoteca|tienda\s+full|tiendas\s+ypf\s+full|ypf\s+full|tienda\s+spot|spot!|cafeter[ií]a|lavado|indumentaria|zapatilla|zapatillas|calzado|remera|pantal[oó]n|moda|colch[oó]n|armer[ií]a|growler)\b/i

function isFuelValid(title: string, desc: string | null, commerceName: string, catSlug?: string | null): boolean {
  const full = `${commerceName || ''} ${title || ''} ${desc || ''}`
  if (NON_FUEL_REGEX.test(full)) return false
  if (catSlug && ['indumentaria', 'deportes', 'hogar', 'tecnologia', 'gastronomia', 'automotores', 'otros'].includes(catSlug)) {
    const isExplicitFuel = /\b(puma\s+energy|combustible|combustibles|nafta|estaci[oó]n\s+de\s+servicio|estaciones\s+de\s+servicio)\b/i.test(full)
    if (!isExplicitFuel) return false
  }
  return true
}

function resolveFuelBrands(commerceName: string, title: string, desc: string | null): FuelBrand[] {
  const full = `${commerceName || ''} ${title || ''} ${desc || ''}`.toLowerCase()
  const brands: FuelBrand[] = []

  if (/\bypf\b/i.test(full)) brands.push('YPF')
  if (/\baxion\b/i.test(full)) brands.push('Axion')
  if (/\bshell\b/i.test(full)) brands.push('Shell')

  if (/\b(?:puma\s+energy|puma)\b/i.test(full)) {
    if (
      /\b(?:energy|combustible|combustibles|nafta|estaci|estaciones)\b/i.test(full) ||
      commerceName.toLowerCase().includes('puma')
    ) {
      brands.push('Puma')
    }
  }

  if (brands.length === 0) {
    const c = (commerceName || '').toLowerCase()
    const t = (title || '').toLowerCase()
    if (
      c.includes('combustible') ||
      c.includes('estaciones de servicio') ||
      t.includes('combustible') ||
      t.includes('nafta')
    ) {
      return ['YPF', 'Axion', 'Shell', 'Puma']
    }
  }

  return brands
}

function extractCap(title: string, desc: string | null): number | null {
  const full = `${title} ${desc || ''}`
  const match = full.match(/tope(?:\s+de(?:\s+reintegro)?)?[:\s]*\$?\s*([0-9]+(?:\.[0-9]{3})*)/i)
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/\./g, ''), 10)
    if (!isNaN(num) && num > 500 && num < 100000) return num
  }
  return null
}

function bitmaskToDayNames(bitmask: number): string[] {
  if (bitmask >= 127) return ['Todos los días']
  const map: [number, string][] = [
    [2, 'Lunes'],
    [4, 'Martes'],
    [8, 'Miércoles'],
    [16, 'Jueves'],
    [32, 'Viernes'],
    [64, 'Sábados'],
    [1, 'Domingos'],
  ]
  const res: string[] = []
  for (const [bit, name] of map) {
    if ((bitmask & bit) !== 0) res.push(name)
  }
  return res.length ? res : ['Todos los días']
}

export default async function SimuladorSidebarPage() {
  const session = await getServerSession(authOptions)

  let userProfileCatalog: FourLevelsCatalog | null = null
  let initialUserMethods: string[] = []
  let userInfo: { name: string | null; email: string | null } | null = null

  // 1. Cargar catálogo de bancos, billeteras y redes
  const [rawBanks, rawWallets, rawNetworks] = await Promise.all([
    prisma.bank.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        _count: { select: { promoRequirements: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.wallet.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        _count: { select: { promoRequirements: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.cardNetwork.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const catalogBanks: CatalogEntity[] = rawBanks.map(b => ({
    id: b.slug,
    slug: b.slug,
    name: b.name,
    logoUrl: b.logoUrl,
    type: 'bank' as const,
    popular: POPULAR_BANK_SLUGS.includes(b.slug) || (b._count?.promoRequirements || 0) >= 15,
  })).sort((a, b) => {
    if (a.popular && !b.popular) return -1
    if (!a.popular && b.popular) return 1
    return a.name.localeCompare(b.name, 'es')
  })

  const catalogWallets: CatalogEntity[] = rawWallets
    .filter(w => !BENEFIT_CLUB_SLUGS.has(w.slug))
    .map(w => ({
      id: w.slug,
      slug: w.slug,
      name: w.name,
      logoUrl: w.logoUrl,
      type: 'wallet' as const,
      popular: true,
    }))

  const catalogBenefits: CatalogEntity[] = rawWallets
    .filter(w => BENEFIT_CLUB_SLUGS.has(w.slug))
    .map(w => ({
      id: w.slug,
      slug: w.slug,
      name: w.name,
      logoUrl: w.logoUrl,
      type: 'benefit' as const,
      popular: true,
    }))

  const catalogCards: CatalogEntity[] = rawNetworks
    .filter(c => CARD_ORDER.includes(c.slug) || ['tarjeta-shopping', 'cabal', 'maestro'].includes(c.slug))
    .map(c => ({
      id: c.slug,
      slug: c.slug,
      name: c.name,
      type: 'card' as const,
      popular: true,
    }))
    .sort((a, b) => {
      const ai = CARD_ORDER.indexOf(a.slug)
      const bi = CARD_ORDER.indexOf(b.slug)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.name.localeCompare(b.name, 'es')
    })

  const fullCatalog: FourLevelsCatalog = {
    banks: catalogBanks,
    wallets: catalogWallets,
    cards: catalogCards,
    benefits: catalogBenefits,
  }

  // 2. Si el usuario está autenticado, cargar sus productos registrados
  if (session?.user?.email) {
    userInfo = {
      name: session.user.name || null,
      email: session.user.email,
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        financialProfile: {
          include: {
            banks: { include: { bank: true } },
            wallets: { include: { wallet: true } },
            cards: {
              include: {
                bank: true,
                wallet: true,
                cardNetwork: true,
              },
            },
          },
        },
      },
    })

    if (user?.financialProfile) {
      const uBanksMap = new Map<string, CatalogEntity>()
      const uWalletsMap = new Map<string, CatalogEntity>()
      const uCardsMap = new Map<string, CatalogEntity>()
      const uBenefitsMap = new Map<string, CatalogEntity>()
      const methodsSet = new Set<string>()

      user.financialProfile.banks.forEach(b => {
        if (b.bank?.slug) {
          const slug = b.bank.slug.toLowerCase()
          methodsSet.add(slug)
          uBanksMap.set(slug, {
            id: slug,
            slug,
            name: b.bank.name,
            logoUrl: b.bank.logoUrl,
            type: 'bank',
            popular: true,
          })
        }
      })

      user.financialProfile.wallets.forEach(w => {
        if (w.wallet?.slug) {
          const slug = w.wallet.slug.toLowerCase()
          methodsSet.add(slug)
          if (BENEFIT_CLUB_SLUGS.has(slug)) {
            uBenefitsMap.set(slug, {
              id: slug,
              slug,
              name: w.wallet.name,
              logoUrl: w.wallet.logoUrl,
              type: 'benefit',
              popular: true,
            })
          } else {
            uWalletsMap.set(slug, {
              id: slug,
              slug,
              name: w.wallet.name,
              logoUrl: w.wallet.logoUrl,
              type: 'wallet',
              popular: true,
            })
          }
        }
      })

      user.financialProfile.cards.forEach(c => {
        if (c.cardNetwork?.slug) {
          const slug = c.cardNetwork.slug.toLowerCase()
          methodsSet.add(slug)
          uCardsMap.set(slug, {
            id: slug,
            slug,
            name: c.cardNetwork.name,
            type: 'card',
            popular: true,
          })
        }
        if (c.bank?.slug) {
          const slug = c.bank.slug.toLowerCase()
          methodsSet.add(slug)
          if (!uBanksMap.has(slug)) {
            uBanksMap.set(slug, {
              id: slug,
              slug,
              name: c.bank.name,
              logoUrl: c.bank.logoUrl,
              type: 'bank',
              popular: true,
            })
          }
        }
        if (c.wallet?.slug) {
          const slug = c.wallet.slug.toLowerCase()
          methodsSet.add(slug)
          if (BENEFIT_CLUB_SLUGS.has(slug)) {
            if (!uBenefitsMap.has(slug)) {
              uBenefitsMap.set(slug, {
                id: slug,
                slug,
                name: c.wallet.name,
                logoUrl: c.wallet.logoUrl,
                type: 'benefit',
                popular: true,
              })
            }
          } else {
            if (!uWalletsMap.has(slug)) {
              uWalletsMap.set(slug, {
                id: slug,
                slug,
                name: c.wallet.name,
                logoUrl: c.wallet.logoUrl,
                type: 'wallet',
                popular: true,
              })
            }
          }
        }
      })

      userProfileCatalog = {
        banks: Array.from(uBanksMap.values()),
        wallets: Array.from(uWalletsMap.values()),
        cards: Array.from(uCardsMap.values()),
        benefits: Array.from(uBenefitsMap.values()),
      }
      initialUserMethods = Array.from(methodsSet)
    }
  }

  // 3. Consultar promociones activas reales
  const rawPromos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { category: { slug: 'combustible' } },
        {
          commerce: {
            slug: {
              in: [
                'ypf',
                'shell',
                'axion',
                'axion-energy',
                'puma-energy',
                'app-ypf',
                'combustibles',
                'estaciones-de-servicio-adheridas',
                'estaciones-de-servicio-que-acepten-modo',
              ],
            },
          },
        },
        { title: { contains: 'combustible', mode: 'insensitive' } },
        { title: { contains: 'nafta', mode: 'insensitive' } },
        { title: { contains: 'puma energy', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      sourceUrl: true,
      maxDiscountPct: true,
      validDays: true,
      isFeatured: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
      commerce: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
      requirements: {
        select: {
          cap: true,
          bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
          wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
          cardNetwork: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: [
      { maxDiscountPct: { sort: 'desc', nulls: 'last' } },
    ],
  })

  const promos: CombustiblePromoItem[] = []

  for (const p of rawPromos) {
    if (!isFuelValid(p.title, p.description, p.commerce.name, p.category?.slug)) continue

    const brands = resolveFuelBrands(p.commerce.name, p.title, p.description)
    if (brands.length === 0) continue

    const discountPct = p.maxDiscountPct || 10

    let cap: number | null = null
    for (const r of p.requirements) {
      if (typeof r.cap === 'number' && r.cap > 0 && r.cap < 200000) {
        if (cap === null || r.cap > cap) cap = r.cap
      }
    }
    if (cap === null) cap = extractCap(p.title, p.description)

    const days = bitmaskToDayNames(p.validDays)
    const fullText = `${p.title} ${p.description || ''} ${p.commerce.name} ${p.sourceUrl || ''}`.toLowerCase()
    const requiresModo = fullText.includes('modo') || fullText.includes('semana nacion') || fullText.includes('semananacion')

    const requirements = p.requirements.map(r => {
      let walletSlug = r.wallet?.slug || null
      let walletName = r.wallet?.name || null
      if (!walletSlug && requiresModo) {
        walletSlug = 'modo'
        walletName = 'MODO'
      }
      return {
        bankName: r.bank?.name || null,
        bankSlug: r.bank?.slug || null,
        walletName,
        walletSlug,
        cardNetworkName: r.cardNetwork?.name || null,
        cardNetworkSlug: r.cardNetwork?.slug || null,
      }
    })

    if (requiresModo && !requirements.some(r => r.walletSlug === 'modo')) {
      requirements.push({
        bankName: null,
        bankSlug: null,
        walletName: 'MODO',
        walletSlug: 'modo',
        cardNetworkName: null,
        cardNetworkSlug: null,
      })
    }

    for (const brand of brands) {
      promos.push({
        id: `${p.id}-${brand}`,
        brand,
        title: p.title,
        description: p.description,
        discountPct,
        capAmount: cap,
        validDays: days,
        validDaysBitmask: p.validDays,
        requirements,
        isFeatured: p.isFeatured,
        logoUrl: p.commerce.logoUrl || null,
      })
    }
  }

  return (
    <SidebarSimulatorView
      initialPromos={promos}
      fullCatalog={fullCatalog}
      userProfileCatalog={userProfileCatalog}
      initialUserMethods={initialUserMethods}
      userInfo={userInfo}
    />
  )
}
