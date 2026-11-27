import { describe, it, expect, vi, beforeEach } from 'vitest'

// Paridad de universo warm-detail con sitemap.ts (27/11/2026). El bug real:
// el criterio de comercios usaba `activePromoCount: { gt: 0 }` (contador
// denormalizado) en vez de `promos: { some: { status: 'ACTIVE' } }` (el
// mismo que ya usa app/sitemap.ts para decidir indexabilidad) — auditoría en
// prod mostró 5/8 comercios con el contador en 0 pero con promos ACTIVE
// reales, que entraban al sitemap pero no al universo de warm. Este test
// solo verifica la SHAPE del where que se manda a Prisma, no corre contra
// una DB real.

process.env.VTEX_SESSION_SECRET = 'test-secret'

let commerceFindManyArgs: any = null
let promoFindManyArgs: any = null

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commerce: {
      findMany: async (args: any) => {
        commerceFindManyArgs = args
        return [{ slug: 'comercio-a' }, { slug: 'comercio-b' }]
      },
    },
    promo: {
      findMany: async (args: any) => {
        promoFindManyArgs = args
        return [{ slug: 'promo-a' }]
      },
    },
  },
}))

vi.mock('@/lib/cache/detailFetchers', () => ({
  makeGetPromoBySlug: () => async () => null,
  makeGetCommerceBySlug: () => async () => null,
}))

let GET: typeof import('./route').GET

beforeEach(async () => {
  commerceFindManyArgs = null
  promoFindManyArgs = null
  if (!GET) {
    ;({ GET } = await import('./route'))
  }
})

function makeRequest(query: string, headers: Record<string, string> = { Authorization: 'Bearer test-secret' }) {
  return new Request(`http://localhost/api/internal/warm-detail${query}`, { headers }) as any
}

describe('GET /api/internal/warm-detail', () => {
  it('sin Bearer correcto → 401, sin tocar Prisma', async () => {
    const res: any = await GET(makeRequest('', {}))
    expect(res.status).toBe(401)
    expect(commerceFindManyArgs).toBeNull()
  })

  it('comercios: filtra por promos ACTIVE en vivo, no por activePromoCount', async () => {
    await GET(makeRequest('?type=comercio'))
    expect(commerceFindManyArgs.where).toEqual({ promos: { some: { status: 'ACTIVE' } } })
    expect(commerceFindManyArgs.where).not.toHaveProperty('activePromoCount')
  })

  it('comercios: sigue ordenando por activePromoCount desc (ranking para --limit), aunque el where ya no lo use', async () => {
    await GET(makeRequest('?type=comercio&limit=10'))
    expect(commerceFindManyArgs.orderBy).toEqual([{ activePromoCount: 'desc' }, { id: 'asc' }])
    expect(commerceFindManyArgs.take).toBe(10)
  })

  it('promos: sigue filtrando por status ACTIVE (sin cambios)', async () => {
    await GET(makeRequest('?type=promo'))
    expect(promoFindManyArgs.where).toEqual({ status: 'ACTIVE', slug: { not: null } })
  })

  it('sin "type": pide ambas listas y devuelve promoSlugs + commerceSlugs', async () => {
    const res: any = await GET(makeRequest(''))
    const body = await res.json()
    expect(body.commerceSlugs).toEqual(['comercio-a', 'comercio-b'])
    expect(body.promoSlugs).toEqual(['promo-a'])
    expect(commerceFindManyArgs.where).toEqual({ promos: { some: { status: 'ACTIVE' } } })
  })
})
