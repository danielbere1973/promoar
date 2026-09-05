import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import SupermercadosSimulator, {
  SupermarketPromoItem,
  SupermarketBrand,
  CatalogEntity,
  FourLevelsCatalog,
  SupermarketRequirement,
} from './SupermercadosSimulator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Simulador de Ahorro en Supermercados | PromoAR',
  description: '¿En qué supermercado te conviene comprar hoy? Seleccioná tus bancos, billeteras, tarjetas o clubes de beneficios y calculá tu ahorro real en Coto, Carrefour, Jumbo, ChangoMás, Día, Disco y Vea.',
  openGraph: {
    title: 'Simulador de Ahorro en Supermercados | PromoAR',
    description: 'Calculá en qué supermercado pagás menos hoy según tus tarjetas y billeteras. Coto vs Carrefour vs Jumbo vs ChangoMás vs Día.',
    url: 'https://promoar.com.ar/ahorro-interactivo/supermercados',
    siteName: 'PromoAR',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Simulador de Ahorro en Supermercados | PromoAR',
    description: '¿Con qué tarjeta te conviene hacer la compra del súper esta semana? Elegí tus tarjetas y mirá el podio en vivo.',
  },
}

// Extracción de tope de reintegro en pesos a partir del texto o descripción
function extractCap(title: string, desc: string | null): number | null {
  const full = `${title} ${desc || ''}`
  const match = full.match(/tope(?:\s+de(?:\s+reintegro)?)?[:\s]*\$?\s*([0-9]+(?:\.[0-9]{3})*)/i)
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/\./g, ''), 10)
    if (!isNaN(num) && num > 500 && num < 150000) return num
  }
  return null
}

// Mapeo canónico a las cadenas líderes de supermercados
function resolveSupermarketBrands(commerceName: string, title: string, desc: string | null, commerceSlug: string): SupermarketBrand[] {
  const full = `${commerceName || ''} ${title || ''} ${desc || ''} ${commerceSlug || ''}`.toLowerCase()
  const brands: SupermarketBrand[] = []

  if (/\bcoto\b/i.test(full)) brands.push('Coto')
  if (/\bcarrefour\b/i.test(full)) brands.push('Carrefour')
  if (/\bjumbo\b/i.test(full)) brands.push('Jumbo')
  if (/\bchangomas\b|\bchango\s*m[aá]s\b/i.test(full)) brands.push('Changomas')
  if (/\b(?:supermercados\s+)?dia\b|\bd[ií]a%\b/i.test(full)) brands.push('Dia')
  if (/\bdisco\b/i.test(full)) brands.push('Disco')
  if (/\bvea\b/i.test(full)) brands.push('Vea')

  // Promociones especiales Cencosud (aplicables a Jumbo, Disco y Vea)
  if (brands.length === 0 && /\bcencosud\b/i.test(full)) {
    brands.push('Jumbo', 'Disco', 'Vea')
  }

  return brands
}

// Días de la semana desde bitmask (1 = Dom, 2 = Lun, 4 = Mar, 8 = Mié, 16 = Jue, 32 = Vie, 64 = Sáb)
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

export default async function SupermercadosSimulatorPage() {
  const session = await getServerSession(authOptions)

  let userProfileCatalog: FourLevelsCatalog | null = null
  let initialUserMethods: string[] = []
  let userInfo: { name: string | null; email: string | null } | null = null

  // 1. Cargar catálogo general de las 4 categorías disponibles en PromoAR
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

  // 2. Si el usuario está autenticado, cargar EXCLUSIVAMENTE sus productos registrados
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

      // Bancos del perfil
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

      // Billeteras y tarjetas de beneficios del perfil
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

      // Tarjetas (redes) y entidades vinculadas
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

  // 3. Obtenemos todas las promociones activas de supermercados con sus requisitos
  const rawPromos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { category: { slug: 'supermercados' } },
        {
          commerce: {
            slug: {
              in: [
                'coto',
                'carrefour',
                'jumbo',
                'changomas',
                'dia',
                'supermercados-dia',
                'disco',
                'vea',
              ],
            },
          },
        },
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
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
      requirements: {
        select: {
          cap: true,
          bank: {
            select: {
              name: true,
              slug: true,
            },
          },
          wallet: {
            select: {
              name: true,
              slug: true,
            },
          },
          cardNetwork: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: [
      { isFeatured: 'desc' },
      { maxDiscountPct: 'desc' },
    ],
  })

  // Normalizamos las promociones a los supermercados compatibles
  const promos: SupermarketPromoItem[] = []

  for (const p of rawPromos) {
    const brands = resolveSupermarketBrands(p.commerce.name, p.title, p.description, p.commerce.slug)
    if (brands.length === 0) continue

    const discountPct = p.maxDiscountPct || 10

    // Prioridad 1: tope estructurado en requirements
    let cap: number | null = null
    for (const r of p.requirements) {
      if (typeof r.cap === 'number' && r.cap > 0 && r.cap < 200000) {
        if (cap === null || r.cap > cap) {
          cap = r.cap
        }
      }
    }
    // Prioridad 2: inferir del texto si no está estructurado
    if (cap === null) {
      cap = extractCap(p.title, p.description)
    }

    const days = bitmaskToDayNames(p.validDays)

    // Requerimientos estructurados
    const fullText = `${p.title} ${p.description || ''} ${p.commerce.name} ${p.sourceUrl || ''}`.toLowerCase()
    const requiresModo = fullText.includes('modo') || fullText.includes('semana nacion') || fullText.includes('semananacion')
    const requiresClubLaNacion = fullText.includes('club la nacion') || fullText.includes('club la nación')
    const requiresClarin365 = fullText.includes('clarin 365') || fullText.includes('clarín 365') || fullText.includes('365 plus')
    const requiresComunidadCoto = fullText.includes('comunidad coto') || fullText.includes('comunidad-coto')

    const requirements: SupermarketRequirement[] = p.requirements.map(r => {
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

    if (requirements.length === 0) {
      if (requiresModo) {
        requirements.push({
          bankName: null,
          bankSlug: null,
          walletName: 'MODO',
          walletSlug: 'modo',
          cardNetworkName: null,
          cardNetworkSlug: null,
        })
      }
      if (requiresClubLaNacion) {
        requirements.push({
          bankName: null,
          bankSlug: null,
          walletName: 'Club La Nacion',
          walletSlug: 'club-la-nacion',
          cardNetworkName: null,
          cardNetworkSlug: null,
        })
      }
      if (requiresClarin365) {
        requirements.push({
          bankName: null,
          bankSlug: null,
          walletName: 'Clarín 365',
          walletSlug: 'clarin-365',
          cardNetworkName: null,
          cardNetworkSlug: null,
        })
      }
      if (requiresComunidadCoto) {
        requirements.push({
          bankName: null,
          bankSlug: null,
          walletName: 'Comunidad Coto',
          walletSlug: 'comunidad-coto',
          cardNetworkName: null,
          cardNetworkSlug: null,
        })
      }
    }

    // Inyectamos la promo para cada cadena a la que aplica
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
        logoUrl: p.commerce.logoUrl,
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#0A1428] text-slate-100 selection:bg-[#D94F2B]/30">
      <SupermercadosSimulator
        initialPromos={promos}
        fullCatalog={fullCatalog}
        userProfileCatalog={userProfileCatalog}
        initialUserMethods={initialUserMethods}
        userInfo={userInfo}
      />
    </main>
  )
}
