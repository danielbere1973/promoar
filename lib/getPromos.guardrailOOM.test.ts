import { describe, it, expect, vi, beforeEach } from 'vitest'

// Guardrail OOM (cpo-a-cto-aprobacion-rfc-guardrail-oom-y-autorizacion-spike-25-8-2026.md):
// tests que inspeccionan los `args` reales pasados a `prisma.promo.findMany`
// (no solo el resultado) — la clase de bug que motivó este guardrail (findMany
// sin `take` para forMe=true + perfil vacío) es estructuralmente invisible si
// solo se verifica el array de promos devuelto. Mismo patrón de mock que
// getPromos.coverageIntegration.test.ts.
const findManyCalls: any[] = []
let findManyImpl: (args: any) => Promise<any[]> = async () => []
let promoCountImpl: () => Promise<number> = async () => 0
let userFindUniqueImpl: (args: any) => Promise<any> = async () => null

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: async () => [],
    promo: {
      findMany: (args: any) => {
        findManyCalls.push(args)
        return findManyImpl(args)
      },
      count: () => promoCountImpl(),
    },
    user: { findUnique: (args: any) => userFindUniqueImpl(args) },
    commerce: { findMany: async () => [] },
    bankSegment: { findMany: async () => [] },
    financialMatchIndex: { findMany: async () => [] },
  },
}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))
vi.mock('@/lib/promoUsage', () => ({ getCurrentPeriod: () => 'MONTHLY' }))
vi.mock('@/lib/cache/promosCache', () => ({ PROMOS_PUBLIC_TAG: 'promos-public' }))

const { getPromosData } = await import('./getPromos')

function makePromo(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'promo-1',
    validDays: 127,
    specificDates: null,
    provinces: [],
    salesChannel: 'PHYSICAL',
    geographicScope: 'UNKNOWN',
    isCSIOnly: false,
    maxDiscountPct: 10,
    commerce: {
      id: 'commerce-1',
      name: 'Comercio Test',
      locationModel: 'FIXED_LOCATION',
      branches: [],
      activePromoCount: 1,
    },
    requirements: [],
    ...overrides,
  }
}

beforeEach(() => {
  findManyCalls.length = 0
  findManyImpl = async () => []
  promoCountImpl = async () => 0
  userFindUniqueImpl = async () => null
})

describe('guardrail OOM — usuario logueado con for_me=true y perfil vacío', () => {
  it('findMany recibe un take acotado (hard cap) en vez de quedar sin límite', async () => {
    userFindUniqueImpl = async () => ({
      addressState: null,
      financialProfile: { banks: [], wallets: [], cards: [] },
      savedPromos: [],
    })
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1

    await getPromosData({ paginate: false, forMe: true, view: 'today' }, 'user@test.com', false)

    expect(findManyCalls).toHaveLength(1)
    expect(findManyCalls[0].take).toBeDefined()
    expect(findManyCalls[0].take).toBeLessThanOrEqual(200)
  })

  it('findMany recibe un take acotado cuando financialProfile es null (nunca completó el perfil)', async () => {
    userFindUniqueImpl = async () => ({
      addressState: null,
      financialProfile: null,
      savedPromos: [],
    })
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1

    await getPromosData({ paginate: false, forMe: true, view: 'today' }, 'user@test.com', false)

    expect(findManyCalls[0].take).toBeDefined()
    expect(findManyCalls[0].take).toBeLessThanOrEqual(200)
  })

  it('responde con profileIncomplete=true', async () => {
    userFindUniqueImpl = async () => ({
      addressState: null,
      financialProfile: { banks: [], wallets: [], cards: [] },
      savedPromos: [],
    })
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1

    const result = await getPromosData({ paginate: false, forMe: true, view: 'today' }, 'user@test.com', false)

    expect((result as any).profileIncomplete).toBe(true)
  })
})

describe('guardrail OOM — usuario logueado con for_me=true y perfil completo (sin regresión)', () => {
  it('profileIncomplete es false cuando hay al menos una tarjeta efectiva', async () => {
    userFindUniqueImpl = async () => ({
      addressState: null,
      financialProfile: { banks: [], wallets: [], cards: [{ bankId: 'bank-1', walletId: null, cardNetworkId: 'net-1' }] },
      savedPromos: [],
    })
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1

    const result = await getPromosData({ paginate: false, forMe: true, view: 'today' }, 'user@test.com', false)

    expect((result as any).profileIncomplete).toBe(false)
  })
})

describe('guardrail OOM — hard cap genérico no afecta paths ya acotados', () => {
  it('invitado sin filtros (paginate=true) acota vía where.id:in (LIMIT del SQL crudo), no vía el hard cap de findMany', async () => {
    // paginate=true entra por getPublicPromosPage (cacheada): el acotado real
    // pasa por el LIMIT/OFFSET del $queryRaw de IDs candidatos, no por `take`
    // en este findMany — where.id ya viene restringido a como máximo pageSize
    // ids. Confirma que el guardrail de esta rama (Opción C, hard cap en
    // `take`) no interfiere con el mecanismo de paginación ya existente.
    findManyImpl = async () => [makePromo()]

    await getPromosData({ paginate: true, view: 'today', pageSize: 500 })

    expect(findManyCalls).toHaveLength(1)
    expect(findManyCalls[0].take).toBeUndefined()
    expect(findManyCalls[0].where.id).toBeDefined()
  })

  it('profileIncomplete es false para invitado sin forMe', async () => {
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1

    const result = await getPromosData({ paginate: false, forMe: false, view: 'today' })

    expect((result as any).profileIncomplete).toBe(false)
    // Sin forMe, no hay guardrail que active el hard cap por esta causa —
    // pero el hard cap genérico igual debe estar presente como red de
    // seguridad (Opción C: A+B combinadas).
    expect(findManyCalls[0].take).toBeDefined()
  })
})
