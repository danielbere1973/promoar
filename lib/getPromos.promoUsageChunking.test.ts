import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regresión del bug P2035 (21/8/2026): con pools grandes de promos filtradas
// (ej. Home v2 con lat/lng amplios), reqIds podía superar el límite de bind
// variables de Postgres (~32767) en promoUsage.findMany({ requirementId: { in: reqIds } }),
// tirando "too many bind variables in prepared statement". Fix: reqIds se
// dedupea y se trocea en chunks muy por debajo del límite antes de consultar.
// Mismo patrón de mocks que getPromos.adminProfileMatching.test.ts.
const promoUsageFindManyCalls: any[] = []
let findManyImpl: (args: any) => Promise<any[]> = async () => []
let promoCountImpl: () => Promise<number> = async () => 0
let userFindUniqueImpl: (args: any) => Promise<any> = async () => null

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: async () => [],
    promo: {
      findMany: (args: any) => findManyImpl(args),
      count: () => promoCountImpl(),
    },
    user: { findUnique: (args: any) => userFindUniqueImpl(args) },
    commerce: { findMany: async () => [] },
    bankSegment: { findMany: async () => [] },
    promoUsage: {
      findMany: (args: any) => {
        promoUsageFindManyCalls.push(args)
        return []
      },
    },
    financialMatchIndex: { findMany: async () => [] },
  },
}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))
vi.mock('@/lib/promoUsage', () => ({ getCurrentPeriod: () => 'MONTHLY' }))
vi.mock('@/lib/cache/promosCache', () => ({ PROMOS_PUBLIC_TAG: 'promos-public' }))

const { getPromosData } = await import('./getPromos')

const BANK_ID = 'bank-x'
const TOTAL_PROMOS = 40_000 // fuerza reqIds.length muy por encima de 32767

function makeCandidatePromos() {
  return Array.from({ length: TOTAL_PROMOS }, (_, i) => ({
    id: `promo-${i}`,
    validDays: 127,
    specificDates: null,
    provinces: [],
    salesChannel: 'PHYSICAL',
    geographicScope: 'UNKNOWN',
    isCSIOnly: false,
    maxDiscountPct: 20,
    commerce: {
      id: `commerce-${i}`,
      name: `Comercio ${i}`,
      locationModel: 'FIXED_LOCATION',
      branches: [],
      activePromoCount: 1,
    },
    requirements: [
      {
        id: `req-${i}`,
        bankId: BANK_ID,
        walletId: null,
        cardNetworkId: null,
        cardType: null,
        discountValue: 20,
        cap: null,
        capUnlimited: true,
        discountType: 'PERCENTAGE',
      },
    ],
  }))
}

const USER_WITH_PROFILE = {
  addressState: null,
  financialProfile: {
    banks: [],
    wallets: [],
    cards: [{ bankId: BANK_ID, walletId: null, cardNetworkId: null, cardType: 'CREDIT', segmentId: null, cardSegmentId: null, isPensioner: false, isPayroll: false }],
  },
  savedPromos: [],
}

beforeEach(() => {
  promoUsageFindManyCalls.length = 0
  findManyImpl = async () => makeCandidatePromos()
  promoCountImpl = async () => TOTAL_PROMOS
  userFindUniqueImpl = async () => USER_WITH_PROFILE
})

describe('promoUsage.findMany — chunking de reqIds (fix P2035)', () => {
  it('no envía un solo chunk con más de 32767 bind variables', async () => {
    await getPromosData(
      { forMe: true, view: 'week', paginate: false },
      'user@example.com',
      false,
    )

    expect(promoUsageFindManyCalls.length).toBeGreaterThan(1)
    for (const call of promoUsageFindManyCalls) {
      expect(call.where.requirementId.in.length).toBeLessThanOrEqual(32767)
    }
  })

  it('cubre todos los requirementIds a través de los chunks combinados, sin duplicados', async () => {
    await getPromosData(
      { forMe: true, view: 'week', paginate: false },
      'user@example.com',
      false,
    )

    const allIds = promoUsageFindManyCalls.flatMap(call => call.where.requirementId.in)
    expect(new Set(allIds).size).toBe(allIds.length) // sin duplicados entre/dentro de chunks
    expect(allIds.length).toBe(TOTAL_PROMOS) // un requirement por promo en este fixture
  })
})
