import { describe, it, expect, vi, beforeEach } from 'vitest'

// GET/PUT /api/perfil/rubros — CPO Approval "Tus rubros" (16/8/2026), punto 3 de la
// propuesta técnica. Tests de aceptación #22-29 de
// propuesta-tecnica-etapa1-tus-rubros-15-8-2026.md §6. Mismo patrón de mocks que
// home-decision/route.test.ts: next-auth/jwt mockeado, prisma mockeado con un store
// en memoria para userRubroPreference (para poder verificar reactivación de la misma
// fila vs. creación de una nueva, y que SUPPRESSED nunca hace DELETE).

let tokenImpl: () => Promise<any> = async () => null

interface PrefRow {
  id: string
  userId: string
  rubroId: string
  source: 'DECLARED' | 'INFERRED'
  status: 'ACTIVE' | 'SUPPRESSED'
  suppressedAt: Date | null
}

let prefRows: PrefRow[] = []
let homeRubros: { id: string; active: boolean }[] = []
let nextId = 1

const ALL_CATALOG_IDS = [
  'supermercados', 'combustible', 'farmacias', 'gastronomia', 'indumentaria',
  'transporte', 'tecnologia', 'hogar', 'salud-y-belleza', 'viajes-y-turismo',
]

vi.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => tokenImpl(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: async (args: any) =>
        args.where.email === 'userA@example.com' ? { id: 'user-a-id' } : null,
    },
    homeRubro: {
      findMany: async (args: any) => {
        if (args?.where?.id?.in) {
          const ids: string[] = args.where.id.in
          return homeRubros.filter(r => ids.includes(r.id))
        }
        return homeRubros
      },
    },
    userRubroPreference: {
      findMany: async (args: any) => {
        return prefRows.filter(r => {
          if (r.userId !== args.where.userId) return false
          if (args.where.source && r.source !== args.where.source) return false
          if (args.where.status && r.status !== args.where.status) return false
          return true
        })
      },
      create: async (args: any) => {
        const row: PrefRow = {
          id: `pref-${nextId++}`,
          userId: args.data.userId,
          rubroId: args.data.rubroId,
          source: args.data.source,
          status: args.data.status,
          suppressedAt: null,
        }
        prefRows.push(row)
        return row
      },
      updateMany: async (args: any) => {
        let count = 0
        for (const row of prefRows) {
          if (
            row.userId === args.where.userId &&
            row.rubroId === args.where.rubroId &&
            row.source === args.where.source
          ) {
            if (args.data.status !== undefined) row.status = args.data.status
            if ('suppressedAt' in args.data) row.suppressedAt = args.data.suppressedAt
            count++
          }
        }
        return { count }
      },
    },
    $transaction: async (ops: Promise<any>[]) => Promise.all(ops),
  },
}))

vi.mock('@/lib/rubroCatalog', () => ({
  RUBRO_CATALOG: ALL_CATALOG_IDS.map(id => ({
    id,
    label: id,
    icon: null,
    categoryIds: [],
    categorySlugs: [id],
  })),
}))

let GET: typeof import('./route').GET
let PUT: typeof import('./route').PUT

beforeEach(async () => {
  tokenImpl = async () => null
  prefRows = []
  homeRubros = ALL_CATALOG_IDS.map(id => ({ id, active: true }))
  nextId = 1
  if (!GET) {
    ;({ GET, PUT } = await import('./route'))
  }
})

function makeGetRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/perfil/rubros', { headers }) as any
}

function makePutRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/perfil/rubros', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as any
}

describe('GET /api/perfil/rubros', () => {
  it('#22 sin sesión → 401', async () => {
    tokenImpl = async () => null
    const res: any = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('#23 con sesión, usuario sin preferencias declaradas → declared: [], universe trae los 10 con active resuelto', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    const res: any = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.declared).toEqual([])
    expect(body.universe).toHaveLength(10)
    expect(body.universe.every((r: any) => r.active === true)).toBe(true)
  })
})

describe('PUT /api/perfil/rubros', () => {
  it('#24 agregando un rubro nuevo a declared → crea fila DECLARED/ACTIVE nueva, response refleja el estado', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    const res: any = await PUT(makePutRequest({ declared: ['tecnologia'] }))
    const body = await res.json()
    expect(body.declared).toEqual(['tecnologia'])
    expect(prefRows).toHaveLength(1)
    expect(prefRows[0]).toMatchObject({ rubroId: 'tecnologia', source: 'DECLARED', status: 'ACTIVE' })
  })

  it('#25 quitando un rubro previamente declarado → la fila pasa a SUPPRESSED con suppressedAt, nunca se borra', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    await PUT(makePutRequest({ declared: ['tecnologia', 'hogar'] }))
    const res: any = await PUT(makePutRequest({ declared: ['hogar'] }))
    const body = await res.json()

    expect(body.declared).toEqual(['hogar'])
    expect(prefRows).toHaveLength(2) // nunca se borra la fila
    const tecRow = prefRows.find(r => r.rubroId === 'tecnologia')!
    expect(tecRow.status).toBe('SUPPRESSED')
    expect(tecRow.suppressedAt).not.toBeNull()
  })

  it('#26 re-agregando un rubro SUPPRESSED → reactiva la misma fila (mismo id), no crea una segunda', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    await PUT(makePutRequest({ declared: ['tecnologia'] }))
    const firstId = prefRows[0].id
    await PUT(makePutRequest({ declared: [] })) // suprime
    expect(prefRows.find(r => r.rubroId === 'tecnologia')!.status).toBe('SUPPRESSED')

    await PUT(makePutRequest({ declared: ['tecnologia'] })) // reactiva
    const tecRows = prefRows.filter(r => r.rubroId === 'tecnologia')
    expect(tecRows).toHaveLength(1)
    expect(tecRows[0].id).toBe(firstId)
    expect(tecRows[0].status).toBe('ACTIVE')
    expect(tecRows[0].suppressedAt).toBeNull()
  })

  it('#27 con un id fuera de RUBRO_CATALOG → 400, sin efectos secundarios', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    const res: any = await PUT(makePutRequest({ declared: ['tecnologia', 'rubro-inventado'] }))
    expect(res.status).toBe(400)
    expect(prefRows).toHaveLength(0)
  })

  it('#28 agregando un rubro active=false que el usuario NO tenía declarado → 400; mantener uno inactivo ya declarado no falla', async () => {
    tokenImpl = async () => ({ email: 'userA@example.com', role: 'USER' })
    homeRubros = homeRubros.map(r => (r.id === 'viajes-y-turismo' ? { ...r, active: false } : r))

    const resAdd: any = await PUT(makePutRequest({ declared: ['viajes-y-turismo'] }))
    expect(resAdd.status).toBe(400)
    expect(prefRows).toHaveLength(0)

    // Ahora lo declara mientras estaba activo, luego el rubro pasa a inactivo, y un PUT
    // que lo mantiene sin tocarlo no debe fallar.
    homeRubros = homeRubros.map(r => (r.id === 'viajes-y-turismo' ? { ...r, active: true } : r))
    await PUT(makePutRequest({ declared: ['viajes-y-turismo'] }))
    homeRubros = homeRubros.map(r => (r.id === 'viajes-y-turismo' ? { ...r, active: false } : r))

    const resKeep: any = await PUT(makePutRequest({ declared: ['viajes-y-turismo'] }))
    expect(resKeep.status).toBe(200)
    const body = await resKeep.json()
    expect(body.declared).toEqual(['viajes-y-turismo'])
  })

  it('#29 sin sesión pero con header x-user-email spoofeado a otro usuario → 401, nunca lee ni escribe preferencias de terceros', async () => {
    tokenImpl = async () => null
    const res: any = await PUT(makePutRequest({ declared: ['tecnologia'] }, { 'x-user-email': 'userA@example.com' }))
    expect(res.status).toBe(401)
    expect(prefRows).toHaveLength(0)
  })
})
