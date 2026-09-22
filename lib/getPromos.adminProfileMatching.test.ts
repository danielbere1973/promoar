import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regresión del bug "Home v2 siempre vacía para cuentas ADMIN" (13/8/2026):
// getPromosData apaga el cálculo de userBestDiscount cuando isAdmin=true (el
// catálogo/backoffice no debe filtrar por perfil), pero decisionEngineV2 usa
// userBestDiscount para puntuar — con isAdmin=true, todo score quedaba en 0
// sin importar el perfil financiero real de la cuenta. forceProfileMatching
// es el parámetro explícito que separa "rol/permisos" de "modo de matching
// para recomendaciones personales" (ver comentario en PromoQueryParams).
// Mismo patrón de mocks que getPromos.coverageIntegration.test.ts.
const queryRawCalls: { strings: TemplateStringsArray; values: any[] }[] = []
let queryRawImpl: (strings: TemplateStringsArray, ...values: any[]) => Promise<any> = async () => []
let findManyImpl: (args: any) => Promise<any[]> = async () => []
let promoCountImpl: () => Promise<number> = async () => 0
let userFindUniqueImpl: (args: any) => Promise<any> = async () => null

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (strings: TemplateStringsArray, ...values: any[]) => {
      queryRawCalls.push({ strings, values })
      return queryRawImpl(strings, ...values)
    },
    promo: {
      findMany: (args: any) => findManyImpl(args),
      count: () => promoCountImpl(),
    },
    user: { findUnique: (args: any) => userFindUniqueImpl(args) },
    commerce: { findMany: async () => [] },
    bankSegment: { findMany: async () => [] },
    promoUsage: { findMany: async () => [] },
    financialMatchIndex: { findMany: async () => [] },
  },
}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))
vi.mock('@/lib/promoUsage', () => ({ getCurrentPeriod: () => 'MONTHLY' }))
vi.mock('@/lib/cache/promosCache', () => ({ PROMOS_PUBLIC_TAG: 'promos-public' }))

const { getPromosData } = await import('./getPromos')

const REQUIREMENT_ID = 'req-visa-banco-x'
const BANK_ID = 'bank-x'

function makeCandidatePromo() {
  return {
    id: 'promo-1',
    validDays: 127,
    specificDates: null,
    provinces: [],
    salesChannel: 'PHYSICAL',
    geographicScope: 'UNKNOWN',
    isCSIOnly: false,
    maxDiscountPct: 20,
    commerce: {
      id: 'commerce-1',
      name: 'Comercio Test',
      locationModel: 'FIXED_LOCATION',
      branches: [],
      activePromoCount: 1,
    },
    requirements: [
      { id: REQUIREMENT_ID, bankId: BANK_ID, walletId: null, cardNetworkId: null, cardType: null, discountValue: 20, cap: null, capUnlimited: true, discountType: 'PERCENTAGE' },
    ],
  }
}

// Perfil financiero con una tarjeta del banco que matchea el requirement de la
// promo — así userBestDiscount solo queda no-null si el matching realmente corrió.
const ADMIN_USER_WITH_PROFILE = {
  addressState: null,
  financialProfile: {
    banks: [],
    wallets: [],
    cards: [{ bankId: BANK_ID, walletId: null, cardNetworkId: null, cardType: 'CREDIT', segmentId: null, cardSegmentId: null, isPensioner: false, isPayroll: false }],
  },
  savedPromos: [],
}

beforeEach(() => {
  queryRawCalls.length = 0
  queryRawImpl = async () => [{ id: 'promo-1' }] // candidate selection query
  findManyImpl = async () => [makeCandidatePromo()]
  promoCountImpl = async () => 1
  userFindUniqueImpl = async () => ADMIN_USER_WITH_PROFILE
})

describe('forceProfileMatching — cuenta ADMIN con perfil financiero', () => {
  it('sin forceProfileMatching, isAdmin=true deja userBestDiscount en null (comportamiento actual de catálogo/backoffice)', async () => {
    const result: any = await getPromosData(
      { forMe: true, view: 'week', paginate: false },
      'admin@example.com',
      true, // isAdmin
    )
    expect(result.promos).toHaveLength(1)
    expect(result.promos[0].userBestDiscount).toBeNull()
  })

  it('con forceProfileMatching=true, isAdmin=true SÍ calcula userBestDiscount real (Home v2)', async () => {
    const result: any = await getPromosData(
      { forMe: true, view: 'week', paginate: false, forceProfileMatching: true },
      'admin@example.com',
      true, // isAdmin
    )
    expect(result.promos).toHaveLength(1)
    expect(result.promos[0].userBestDiscount).not.toBeNull()
    expect(result.promos[0].userBestDiscount.id).toBe(REQUIREMENT_ID)
  })

  it('usuario no-admin no se ve afectado por el flag (mismo resultado con o sin forceProfileMatching)', async () => {
    const withoutFlag: any = await getPromosData(
      { forMe: true, view: 'week', paginate: false },
      'user@example.com',
      false,
    )
    const withFlag: any = await getPromosData(
      { forMe: true, view: 'week', paginate: false, forceProfileMatching: true },
      'user@example.com',
      false,
    )
    expect(withoutFlag.promos[0].userBestDiscount?.id).toBe(REQUIREMENT_ID)
    expect(withFlag.promos[0].userBestDiscount?.id).toBe(REQUIREMENT_ID)
  })
})
