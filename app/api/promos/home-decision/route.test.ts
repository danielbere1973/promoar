import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeProximityContextHash } from './route'

// CPO Final Gate — Seguridad endpoint antes de push (12/8/2026). Caso negativo
// explícito pedido: "intento de pedir Home Decision para otro usuario
// manipulando request/query/header → debe ser imposible o ignorado". El
// vector real es el header `x-user-email` (lo setea PromosClient.tsx en el
// browser, sin validación server-side — ver /api/promos/route.ts, que sí lo
// acepta como fallback). Este endpoint fue corregido para leer identidad
// exclusivamente del JWT verificado por getAuthToken(); este test prueba
// que un request SIN sesión pero CON el header spoofeado a otro usuario no
// obtiene el perfil de ese usuario.
//
// Reescrito — CPO Approval "Tus rubros" (16/8/2026): la ruta ahora resuelve
// declaredUniverse (userRubroPreference + homeRubro), calcula 4 hashes de
// vigencia y lee/escribe HomeDecisionSnapshot para usuarios autenticados.
// Los mocks de Prisma se amplían para cubrir esa superficie; el mock de
// @/lib/rubroPreferences deja correr resolveDeclaredUniverse real (función
// pura, ya cubierta por rubroPreferences.test.ts) y solo mockea las dos
// funciones con I/O.

let tokenImpl: () => Promise<any> = async () => null
let getPromosDataCalls: any[] = []
let userFindUniqueCalls: any[] = []
let snapshotUpsertCalls: any[] = []
let existingSnapshot: any = null

vi.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => tokenImpl(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (args: any) => {
        userFindUniqueCalls.push(args)
        return Promise.resolve(args.where.email === 'userA@example.com' ? { id: 'user-a-id' } : null)
      },
    },
    userRubroPreference: {
      findMany: async () => [],
    },
    homeRubro: {
      findMany: async () => [],
    },
    financialProfile: {
      findUnique: async () => null,
    },
    savedPromo: {
      findMany: async () => [],
    },
    homeDecisionSnapshot: {
      findUnique: async () => existingSnapshot,
      upsert: (args: any) => {
        snapshotUpsertCalls.push(args)
        return Promise.resolve({ id: 'snapshot-1', ...args.create })
      },
    },
    promo: {
      aggregate: async () => ({ _max: { updatedAt: null } }),
      count: async () => 0,
    },
  },
}))

vi.mock('@/lib/getPromos', () => ({
  getPromosData: (params: any, email: any, isAdmin: any) => {
    getPromosDataCalls.push({ params, email, isAdmin })
    // Usuario A (autenticado real) tiene 1 promo matcheada a su perfil.
    // Si el server confiara en el header spoofeado, "vería" el perfil del
    // usuario B en su lugar — este mock no tiene forma de distinguirlos
    // salvo por el email que efectivamente le llega como argumento, que es
    // justo lo que este test verifica.
    return Promise.resolve({ promos: email === 'userA@example.com' ? [{ id: 'promo-1' }] : [] })
  },
}))

let nearbyImpl: () => Promise<Record<string, { count: number; minDistKm: number }>> = async () => ({})

vi.mock('@/lib/nearbyBranches', () => ({
  getNearbyBranchesByCommerce: (...args: any[]) => nearbyImpl(),
}))

// getDeclaredActivePreferences/getActiveHomeRubroIds son I/O (Prisma) — se
// mockean acá. resolveDeclaredUniverse NO se mockea: es función pura, se
// importa real desde el módulo real (no hay entry en este vi.mock), así que
// route.ts la ejecuta contra los datos devueltos por los otros mocks.
vi.mock('@/lib/rubroPreferences', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rubroPreferences')>('@/lib/rubroPreferences')
  return {
    ...actual,
    getDeclaredActivePreferences: async () => [],
    getActiveHomeRubroIds: async () => new Set<string>(),
  }
})

vi.mock('@/lib/decisionEngineV2', () => ({
  buildHomeDecisionPayload: (promos: any[]) => ({
    status: promos.length ? 'ok' : 'all_empty',
    rubros: [],
    missingProfile: null,
    generatedAt: new Date().toISOString(),
    latencyMs: 0,
    engineVersion: 'decision-engine-v2.0.0',
  }),
}))

let GET: typeof import('./route').GET

beforeEach(async () => {
  getPromosDataCalls = []
  userFindUniqueCalls = []
  snapshotUpsertCalls = []
  existingSnapshot = null
  tokenImpl = async () => null
  nearbyImpl = async () => ({})
  if (!GET) {
    ;({ GET } = await import('./route'))
  }
})

function makeRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/promos/home-decision', { headers }) as any
}

describe('GET /api/promos/home-decision — identidad e impersonación', () => {
  it('sin sesión y sin header spoofeado: no hay identidad, respuesta incomplete_profile, getPromosData nunca se llama con un email', async () => {
    tokenImpl = async () => null
    const req = makeRequest()
    const res: any = await GET(req)
    const body = await res.json()
    expect(body.status).toBe('incomplete_profile')
    expect(getPromosDataCalls).toHaveLength(0)
  })

  it('caso negativo explícito: sin sesión pero con header x-user-email spoofeado a un usuario real → el spoofing es ignorado, no se filtra por ese perfil', async () => {
    tokenImpl = async () => null // sin cookie de sesión válida
    const req = makeRequest({ 'x-user-email': 'userB-victima@example.com' })
    const res: any = await GET(req)
    const body = await res.json()

    // El endpoint debe tratar este request como sin identidad (mismo
    // resultado que sin header alguno) — el header no debe llegar a
    // getPromosData como el email a matchear.
    expect(getPromosDataCalls.every((c) => c.email !== 'userB-victima@example.com')).toBe(true)
    expect(body.status).toBe('incomplete_profile')
  })

  it('con sesión real de usuario A pero header x-user-email spoofeado a usuario B → se usa el email del JWT (A), el header se ignora', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    const req = makeRequest({ 'x-user-email': 'userB-victima@example.com' })
    await GET(req)

    expect(getPromosDataCalls).toHaveLength(1)
    expect(getPromosDataCalls[0].email).toBe('userA@example.com')
    expect(getPromosDataCalls[0].email).not.toBe('userB-victima@example.com')
  })

  it('con sesión real: forceProfileMatching siempre viaja en true, pero atado al email del propio token (nunca a un userId/email de terceros pasado por query)', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    const req = makeRequest()
    await GET(req)

    expect(getPromosDataCalls[0].params.forceProfileMatching).toBe(true)
    expect(getPromosDataCalls[0].email).toBe('userA@example.com')
  })

  it('comportamiento admin: rol viene exclusivamente del JWT verificado, no de headers/query', async () => {
    tokenImpl = async () => ({ email: 'admin@example.com', role: 'ADMIN' })
    const req = makeRequest({ 'x-user-role': 'ADMIN' }) // header arbitrario, no debería tener ningún efecto
    await GET(req)

    expect(getPromosDataCalls[0].isAdmin).toBe(true)
    expect(getPromosDataCalls[0].email).toBe('admin@example.com')
  })

  it('guest_profile es self-describing: no dispara lookup de otro usuario por id/email', async () => {
    tokenImpl = async () => null
    const req = makeRequest()
    const url = new URL(req.url)
    url.searchParams.set('guest_profile', Buffer.from(JSON.stringify({ banks: ['x'] })).toString('base64'))
    const reqWithGuest = new Request(url.toString()) as any

    await GET(reqWithGuest)

    // Sin email, nunca se consulta prisma.user.findUnique — guest_profile no
    // resuelve a ningún registro de usuario real.
    expect(userFindUniqueCalls).toHaveLength(0)
  })
})

// CPO decisión 17/8/2026: proximityContextHash pasa a ser columna propia,
// separada de decisionContextHash, y debe representar el contexto real de
// cercanía (commerceId + minDistKm + count) — antes solo incluía minDistKm.
// Estos 6 casos son los pedidos explícitamente por el CPO.
describe('computeProximityContextHash', () => {
  it('mismo contexto → mismo hash', () => {
    const a = { c1: { count: 2, minDistKm: 0.8 }, c2: { count: 1, minDistKm: 3.1 } }
    const b = { c1: { count: 2, minDistKm: 0.8 }, c2: { count: 1, minDistKm: 3.1 } }
    expect(computeProximityContextHash(a)).toBe(computeProximityContextHash(b))
  })

  it('cambia minDistKm → invalida (hash distinto)', () => {
    const a = { c1: { count: 2, minDistKm: 0.8 } }
    const b = { c1: { count: 2, minDistKm: 1.2 } }
    expect(computeProximityContextHash(a)).not.toBe(computeProximityContextHash(b))
  })

  it('cambia count → invalida (hash distinto), aunque minDistKm sea igual', () => {
    const a = { c1: { count: 2, minDistKm: 0.8 } }
    const b = { c1: { count: 3, minDistKm: 0.8 } }
    expect(computeProximityContextHash(a)).not.toBe(computeProximityContextHash(b))
  })

  it('null/sin proximidad → contexto determinístico (mismo sentinel siempre)', () => {
    expect(computeProximityContextHash({})).toBe('no-proximity-context')
    expect(computeProximityContextHash({})).toBe(computeProximityContextHash({}))
  })
})

describe('GET /api/promos/home-decision — invalidación por proximidad (columna propia)', () => {
  it('cambia solo el origen GPS pero el contexto efectivo (nearbyByCommerceId) es igual → no invalida', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    // Dos coordenadas GPS distintas que, tras resolver sucursales cercanas,
    // producen exactamente el mismo nearbyByCommerceId — el hash debe
    // depender del mapa derivado, no de lat/lng crudos.
    nearbyImpl = async () => ({ 'commerce-1': { count: 2, minDistKm: 0.5 } })

    const req1 = makeRequest()
    const url1 = new URL(req1.url)
    url1.searchParams.set('lat', '-34.60')
    url1.searchParams.set('lng', '-58.38')
    await GET(new Request(url1.toString()) as any)
    const firstUpsertProximity = snapshotUpsertCalls[0].create.proximityContextHash
    existingSnapshot = { id: 'snapshot-1', ...snapshotUpsertCalls[0].create }

    const req2 = makeRequest()
    const url2 = new URL(req2.url)
    url2.searchParams.set('lat', '-34.61') // origen GPS distinto
    url2.searchParams.set('lng', '-58.39')
    await GET(new Request(url2.toString()) as any)

    // Mismo nearbyByCommerceId efectivo → mismo proximityContextHash → no se
    // dispara un segundo upsert (vigente=true, se sirve del snapshot).
    expect(snapshotUpsertCalls).toHaveLength(1)
    expect(firstUpsertProximity).toBe(computeProximityContextHash({ 'commerce-1': { count: 2, minDistKm: 0.5 } }))
  })

  it('transición sin proximidad → proximidad real → invalida', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })

    nearbyImpl = async () => ({})
    const req1 = makeRequest()
    await GET(req1)
    expect(snapshotUpsertCalls).toHaveLength(1)
    expect(snapshotUpsertCalls[0].create.proximityContextHash).toBe('no-proximity-context')
    existingSnapshot = { id: 'snapshot-1', ...snapshotUpsertCalls[0].create }

    nearbyImpl = async () => ({ 'commerce-1': { count: 1, minDistKm: 1.0 } })
    const req2 = makeRequest()
    const url2 = new URL(req2.url)
    url2.searchParams.set('lat', '-34.60')
    url2.searchParams.set('lng', '-58.38')
    await GET(new Request(url2.toString()) as any)

    // Cambió de sin-proximidad a proximidad real → segundo upsert disparado.
    expect(snapshotUpsertCalls).toHaveLength(2)
    expect(snapshotUpsertCalls[1].create.proximityContextHash).not.toBe('no-proximity-context')
  })
})

describe('GET /api/promos/home-decision — cache HomeDecisionSnapshot', () => {
  it('usuario autenticado sin snapshot previo: calcula el payload y lo guarda vía upsert', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    existingSnapshot = null
    const req = makeRequest()
    await GET(req)

    expect(snapshotUpsertCalls).toHaveLength(1)
    expect(snapshotUpsertCalls[0].where.userId).toBe('user-a-id')
  })

  it('guest (guest_profile sin sesión) nunca pasa por el cache de snapshot', async () => {
    tokenImpl = async () => null
    const req = makeRequest()
    const url = new URL(req.url)
    url.searchParams.set('guest_profile', Buffer.from(JSON.stringify({ banks: ['x'] })).toString('base64'))
    const reqWithGuest = new Request(url.toString()) as any

    await GET(reqWithGuest)

    expect(snapshotUpsertCalls).toHaveLength(0)
  })
})
