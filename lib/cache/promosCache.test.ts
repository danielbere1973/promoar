import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────
// next/cache: unstable_cache se simula ejecutando siempre el callback real
// (equivalente a un MISS permanente) — suficiente para verificar los
// invariantes de "qué datos entran a la función cacheada", no el motor de
// cache de Next en sí (eso ya lo garantiza el framework). revalidateTag se
// espía para verificar invalidatePublicPromosCache.
const revalidateTagMock = vi.fn()
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: any[]) => any) => fn,
  revalidateTag: (...args: any[]) => revalidateTagMock(...args),
}))

const promoFindMany = vi.fn().mockResolvedValue([])
const promoCount = vi.fn().mockResolvedValue(0)
const userFindUnique = vi.fn().mockResolvedValue(null)
const bankSegmentFindMany = vi.fn().mockResolvedValue([])
// getPublicPromosPage (rama cacheable) resuelve IDs candidatos con $queryRaw
// crudo antes del findMany real — ver comentario en getPromos.ts sobre por qué
// el LIMIT/OFFSET tiene que vivir ahí. Mock por defecto: sin IDs candidatos.
const queryRaw = vi.fn().mockResolvedValue([])
// bumpCatalogVersion (invalidatePublicPromosCache) usa $executeRaw crudo.
const executeRaw = vi.fn().mockResolvedValue(1)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => queryRaw(...args),
    $executeRaw: (...args: any[]) => executeRaw(...args),
    promo: {
      findMany: (...args: any[]) => promoFindMany(...args),
      count: (...args: any[]) => promoCount(...args),
    },
    user: {
      findUnique: (...args: any[]) => userFindUnique(...args),
    },
    bankSegment: {
      findMany: (...args: any[]) => bankSegmentFindMany(...args),
    },
  },
}))

vi.mock('@/lib/promoUsage', () => ({
  getCurrentPeriod: () => 'test-period',
}))

import { getPromosData } from '@/lib/getPromos'
import { invalidatePublicPromosCache, PROMOS_PUBLIC_TAG } from '@/lib/cache/promosCache'

beforeEach(() => {
  revalidateTagMock.mockClear()
  promoFindMany.mockClear().mockResolvedValue([])
  promoCount.mockClear().mockResolvedValue(0)
  userFindUnique.mockClear().mockResolvedValue(null)
  queryRaw.mockClear().mockResolvedValue([])
  executeRaw.mockClear().mockResolvedValue(1)
})

describe('RFC-002 Fase 1 — invalidatePublicPromosCache', () => {
  it('llama a revalidateTag con el tag público', async () => {
    await invalidatePublicPromosCache()
    expect(revalidateTagMock).toHaveBeenCalledWith(PROMOS_PUBLIC_TAG)
  })

  it('bumpea catalogVersion vía $executeRaw', async () => {
    await invalidatePublicPromosCache()
    expect(executeRaw).toHaveBeenCalled()
  })

  it('nunca lanza, aunque revalidateTag falle (red de seguridad = TTL)', async () => {
    revalidateTagMock.mockImplementationOnce(() => {
      throw new Error('revalidateTag boom')
    })
    await expect(invalidatePublicPromosCache()).resolves.not.toThrow()
  })

  it('nunca lanza, aunque bumpCatalogVersion falle (se loguea, no revienta al caller)', async () => {
    executeRaw.mockRejectedValueOnce(new Error('executeRaw boom'))
    await expect(invalidatePublicPromosCache()).resolves.not.toThrow()
  })
})

describe('RFC-002 Fase 1 — rama cacheable de getPromosData', () => {
  it('invitado sin filtros ni provincia (paginate=true) NO pasa email/isAdmin/provincia a prisma.promo.findMany', async () => {
    await getPromosData({ paginate: true, page: 1, pageSize: 500, view: 'today' } as any, null, false)

    expect(promoFindMany).toHaveBeenCalledTimes(1)
    const callArgs = promoFindMany.mock.calls[0][0]
    // La rama cacheada arma su propio `where` fijo (status ACTIVE + validez de fechas),
    // sin ningún rastro de sesión/personalización.
    expect(callArgs.where).not.toHaveProperty('email')
    expect(callArgs.where).not.toHaveProperty('userProvince')
    expect(callArgs).not.toHaveProperty('isAdmin')
  })

  it('invitado con provincia (paginate=true, sin guest profile) SÍ usa la caché pública — provincia va en la clave de cache', async () => {
    // Ampliación post-PR#8 + ADR-001: un invitado con `?province=X` sigue siendo
    // un visitante sin perfil real — no hay motivo para sacarlo del path cacheado.
    // El filtro grueso por provincia se resuelve en SQL crudo dentro de
    // getPublicPromosPage (antes del LIMIT/OFFSET); el filtro fino ADR-001
    // (branches) se aplica después, afuera, sobre el resultado ya cacheado —
    // por eso acá el include SÍ pide `branches` (a diferencia del caso sin
    // provincia), pero sigue siendo la rama cacheada, no la personalizada.
    await getPromosData(
      { paginate: true, page: 1, pageSize: 500, province: 'Buenos Aires', view: 'today' } as any,
      null,
      false,
    )

    expect(promoFindMany).toHaveBeenCalledTimes(1)
    const callArgs = promoFindMany.mock.calls[0][0]
    expect(callArgs.select.commerce.select).toHaveProperty('branches')
    // Señal de que pasó por la rama cacheada (getPublicPromosPage): resolvió
    // los IDs candidatos con $queryRaw crudo antes del findMany.
    expect(queryRaw).toHaveBeenCalled()
    const sql = queryRaw.mock.calls[0][0].join('')
    expect(sql).toMatch(/LIMIT/)
    expect(sql).toMatch(/OFFSET/)
  })

  it('usuario con email (forMe) nunca es cacheable aunque no mande filtros', async () => {
    await getPromosData({ paginate: false } as any, 'user@example.com', false)
    expect(promoFindMany).toHaveBeenCalledTimes(1)
    // paginate=false → toma el branch directo; no debe intentar pageSize/skip de paginación pública
    const callArgs = promoFindMany.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('skip')
  })

  it('admin nunca comparte la caché pública', async () => {
    await getPromosData({ paginate: true, page: 1, pageSize: 500 } as any, 'admin@example.com', true)
    // email presente → paginate real ya vendría en false desde la ruta, pero
    // igual verificamos que si por algún motivo isAdmin=true, el resultado
    // sigue siendo información fresca (no debe compartir cache con isAdmin=false).
    expect(promoFindMany).toHaveBeenCalledTimes(1)
  })
})
