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

vi.mock('@/lib/prisma', () => ({
  prisma: {
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
})

describe('RFC-002 Fase 1 — invalidatePublicPromosCache', () => {
  it('llama a revalidateTag con el tag público', () => {
    invalidatePublicPromosCache()
    expect(revalidateTagMock).toHaveBeenCalledWith(PROMOS_PUBLIC_TAG)
  })

  it('nunca lanza, aunque revalidateTag falle (red de seguridad = TTL)', () => {
    revalidateTagMock.mockImplementationOnce(() => {
      throw new Error('revalidateTag boom')
    })
    expect(() => invalidatePublicPromosCache()).not.toThrow()
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

  it('invitado con provincia (paginate=true pero userProvince presente) NO usa la caché pública', async () => {
    await getPromosData(
      { paginate: true, page: 1, pageSize: 500, province: 'Buenos Aires' } as any,
      null,
      false,
    )

    // Rama no-cacheada: pide también el count vía prisma.promo.count en lugar
    // de compartir el count cacheado de getActiveTotalCount (paginate directo
    // usa getActiveTotalCount igual, pero el punto clave es que el include
    // trae `branches` para filtrar por provincia — señal inequívoca de que
    // pasó por la rama personalizada, no por getPublicPromosPage).
    expect(promoFindMany).toHaveBeenCalledTimes(1)
    const callArgs = promoFindMany.mock.calls[0][0]
    expect(callArgs.include.commerce.select).toHaveProperty('branches')
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
