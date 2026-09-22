import { describe, it, expect, vi, beforeEach } from 'vitest'

// getPromos.ts instancia PrismaClient a nivel de módulo — se mockea con un
// doble que registra las llamadas ($queryRaw, findMany) para poder inspeccionar
// qué SQL/where se generó, sin necesitar una conexión real a la base.
// unstable_cache se mockea como identidad (misma técnica que
// getPromos.provinceScope.test.ts) para poder invocar getPublicPromosPage
// directamente en cada test sin que el cache de Next persista entre corridas.
const queryRawCalls: { strings: TemplateStringsArray; values: any[] }[] = []
let queryRawImpl: (strings: TemplateStringsArray, ...values: any[]) => Promise<any> = async () => []
let findManyImpl: (args: any) => Promise<any[]> = async () => []
let promoCountImpl: () => Promise<number> = async () => 0

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
    user: { findUnique: async () => null },
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
  queryRawCalls.length = 0
  queryRawImpl = async () => []
  findManyImpl = async () => []
  promoCountImpl = async () => 0
})

describe('cache segmentado por provincia (getPublicPromosPage)', () => {
  it('dos provincias distintas generan queries SQL con distinto parámetro de provincia', async () => {
    queryRawImpl = async () => [{ id: 'promo-1' }]
    findManyImpl = async () => [makePromo()]

    await getPromosData({ paginate: true, view: 'today', province: 'Córdoba' })
    await getPromosData({ paginate: true, view: 'today', province: 'Mendoza' })

    // La query de IDs candidatos (dayFiltered) es la 2da $queryRaw de cada corrida
    // (la 1ra es getActiveTodayCount) — confirmamos que el parámetro de provincia
    // viaja distinto en cada invocación, es decir, cada provincia arma su propia
    // query (y por lo tanto su propia entrada de cache, ya que `province` es
    // parte de la clave de unstable_cache).
    const idQueries = queryRawCalls.filter(c => c.values.includes('Córdoba') || c.values.includes('Mendoza'))
    expect(idQueries.length).toBe(2)
    expect(idQueries[0].values).toContain('Córdoba')
    expect(idQueries[1].values).toContain('Mendoza')
  })
})

describe('invitado con provincia sin resultados fuera de alcance', () => {
  it('una promo territorial de otra provincia no aparece para el invitado', async () => {
    queryRawImpl = async () => [{ id: 'promo-1' }]
    findManyImpl = async () => [makePromo({
      geographicScope: 'PROVINCES',
      provinces: ['Jujuy'],
      commerce: { id: 'c1', name: 'Solo Jujuy', locationModel: 'FIXED_LOCATION', branches: [{ province: 'Jujuy' }] },
    })]

    const result = await getPromosData({ paginate: true, view: 'today', province: 'Buenos Aires' })
    expect(result.promos).toHaveLength(0)
  })
})

describe('promoción nacional visible en todas las provincias', () => {
  it('geographicScope NATIONWIDE se muestra sin importar la provincia del invitado', async () => {
    queryRawImpl = async () => [{ id: 'promo-1' }]
    findManyImpl = async () => [makePromo({ geographicScope: 'NATIONWIDE' })]

    const result = await getPromosData({ paginate: true, view: 'today', province: 'Tierra del Fuego' })
    expect(result.promos).toHaveLength(1)
    expect(result.promos[0].coverageStatus).toBe('TERRITORIAL')
    expect(result.promos[0].coverageLabel).toBe('Todo el país')
  })
})

describe('promoción online sin sucursales visible cuando corresponde', () => {
  it('salesChannel ONLINE sin restricción geográfica se muestra sin depender de branches', async () => {
    queryRawImpl = async () => [{ id: 'promo-1' }]
    findManyImpl = async () => [makePromo({
      salesChannel: 'ONLINE',
      geographicScope: 'NO_GEOGRAPHIC_RESTRICTION',
      commerce: { id: 'c1', name: 'Tienda Online', locationModel: 'NO_FIXED_LOCATION', branches: [] },
    })]

    const result = await getPromosData({ paginate: true, view: 'today', province: 'Salta' })
    expect(result.promos).toHaveLength(1)
    expect(result.promos[0].coverageStatus).toBe('ONLINE')
  })
})

describe('usuario con perfil real fuera del camino cacheado', () => {
  it('forMe + guest_profile no usa getPublicPromosPage (no dispara $queryRaw de IDs)', async () => {
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1

    const guestProfile = Buffer.from(JSON.stringify({ cards: [] })).toString('base64')
    await getPromosData({
      paginate: false, // route.ts ya calcula paginate=false cuando hay guestProfileParam+forMe
      forMe: true,
      guestProfileParam: guestProfile,
      view: 'today',
    })

    // Sin $queryRaw de IDs candidatos (dayFiltered vive solo dentro de getPublicPromosPage)
    const idQueries = queryRawCalls.filter(c => c.strings.join('').includes('FROM "promos"'))
    expect(idQueries).toHaveLength(0)
  })

  it('isPublicCacheableView es false cuando hay guestProfileParam aunque paginate sea true', async () => {
    // Simula el caso borde: si algo upstream calculara paginate=true con guest_profile
    // presente, getPromosData igual debe excluirlo del path cacheado (ver isPublicCacheableView
    // en getPromos.ts) para no cachear una vista personalizada por perfil temporal.
    findManyImpl = async () => [makePromo()]
    promoCountImpl = async () => 1
    queryRawImpl = async () => [{ id: 'promo-1' }]

    const guestProfile = Buffer.from(JSON.stringify({ cards: [] })).toString('base64')
    await getPromosData({ paginate: true, guestProfileParam: guestProfile, view: 'today' })

    const idQueries = queryRawCalls.filter(c => c.strings.join('').includes('FROM "promos"'))
    expect(idQueries).toHaveLength(0)
  })
})

describe('regresión de query sin LIMIT', () => {
  it('la query SQL de IDs candidatos (dayFiltered) siempre incluye LIMIT y OFFSET', async () => {
    queryRawImpl = async () => []
    findManyImpl = async () => []

    await getPromosData({ paginate: true, view: 'today', province: 'Buenos Aires', pageSize: 500, page: 2 })

    const idQuery = queryRawCalls.find(c => c.strings.join('').includes('FROM "promos"') && c.strings.join('').includes('ORDER BY'))
    expect(idQuery).toBeDefined()
    const sql = idQuery!.strings.join('')
    expect(sql).toMatch(/LIMIT/)
    expect(sql).toMatch(/OFFSET/)
    expect(idQuery!.values).toContain(500) // pageSize
  })
})
