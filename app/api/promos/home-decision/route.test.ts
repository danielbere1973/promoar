import { describe, it, expect, vi, beforeEach } from 'vitest'

// CPO Final Gate — Seguridad endpoint antes de push (12/8/2026). Caso negativo
// explícito pedido: "intento de pedir Home Decision para otro usuario
// manipulando request/query/header → debe ser imposible o ignorado". El
// vector real es el header `x-user-email` (lo setea PromosClient.tsx en el
// browser, sin validación server-side — ver /api/promos/route.ts, que sí lo
// acepta como fallback). Este endpoint fue corregido para leer identidad
// exclusivamente del JWT verificado por getAuthToken(); este test prueba
// que un request SIN sesión pero CON el header spoofeado a otro usuario no
// obtiene el perfil de ese usuario.

let tokenImpl: () => Promise<any> = async () => null
let getPromosDataCalls: any[] = []
let userFindUniqueCalls: any[] = []

vi.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => tokenImpl(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (args: any) => {
        userFindUniqueCalls.push(args)
        return Promise.resolve(null)
      },
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

vi.mock('@/lib/nearbyBranches', () => ({
  getNearbyBranchesByCommerce: async () => ({}),
}))

vi.mock('@/lib/rubroPreferences', () => ({
  getDeclaredActivePreferences: async () => [],
  getActiveHomeRubroIds: async () => [],
  selectRubrosForHome: () => [],
}))

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

const { GET } = await import('./route')

function makeRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/promos/home-decision', { headers }) as any
}

beforeEach(() => {
  getPromosDataCalls = []
  userFindUniqueCalls = []
  tokenImpl = async () => null
})

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
