import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const revalidateTagMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: any[]) => revalidateTagMock(...args),
}))

import {
  invalidatePromoDetailBySlugs,
  invalidateCommerceDetailBySlugs,
  promoDetailIdTag,
  commerceDetailIdTag,
  commerceAuxTag,
  PROMO_DETAIL_TAG,
  COMMERCE_DETAIL_TAG,
  DETAIL_INVALIDATION_BULK_THRESHOLD,
} from '@/lib/cache/detailCache'

beforeEach(() => {
  revalidateTagMock.mockClear()
})

describe('commerce-aux tag — invalidateCommerceDetailBySlugs', () => {
  it('invalida commerceAuxTag para cada comercio además de commerceDetailIdTag', async () => {
    await invalidateCommerceDetailBySlugs(['coto', 'jumbo'])

    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('coto'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('coto'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('jumbo'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('jumbo'))
  })

  it('no llama a revalidateTag si la lista está vacía', async () => {
    await invalidateCommerceDetailBySlugs([])
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('commerce-aux tag — invalidatePromoDetailBySlugs con commerceSlugs', () => {
  it('invalida commerceAuxTag para cada comercio pasado en opts.commerceSlugs', async () => {
    await invalidatePromoDetailBySlugs(['promo-a', 'promo-b'], { commerceSlugs: ['coto', 'jumbo'] })

    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-a'))
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-b'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('coto'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('jumbo'))
  })

  it('sin opts.commerceSlugs, no invalida ningún commerceAuxTag', async () => {
    await invalidatePromoDetailBySlugs(['promo-a'])

    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-a'))
    expect(revalidateTagMock).not.toHaveBeenCalledWith(expect.stringMatching(/^commerce-aux:/))
  })

  it('invalida commerceAuxTag aunque slugs de promo esté vacío (solo commerceSlugs)', async () => {
    await invalidatePromoDetailBySlugs([], { commerceSlugs: ['coto'] })
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('coto'))
  })
})

describe('alwaysBySlug — nunca cae al fallback global (ver incidente 25/11/2026)', () => {
  const manySlugs = Array.from({ length: DETAIL_INVALIDATION_BULK_THRESHOLD + 50 }, (_, i) => `promo-${i}`)
  const manyCommerceSlugs = Array.from({ length: DETAIL_INVALIDATION_BULK_THRESHOLD + 50 }, (_, i) => `comercio-${i}`)

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invalidatePromoDetailBySlugs con alwaysBySlug:true invalida por slug aunque supere el umbral', async () => {
    const promise = invalidatePromoDetailBySlugs(manySlugs, { alwaysBySlug: true })
    await vi.runAllTimersAsync()
    await promise

    expect(revalidateTagMock).not.toHaveBeenCalledWith(PROMO_DETAIL_TAG)
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-0'))
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag(`promo-${manySlugs.length - 1}`))
  })

  it('invalidateCommerceDetailBySlugs con alwaysBySlug:true invalida por slug aunque supere el umbral', async () => {
    const promise = invalidateCommerceDetailBySlugs(manyCommerceSlugs, { alwaysBySlug: true })
    await vi.runAllTimersAsync()
    await promise

    expect(revalidateTagMock).not.toHaveBeenCalledWith(COMMERCE_DETAIL_TAG)
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('comercio-0'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag(`comercio-${manyCommerceSlugs.length - 1}`))
  })

  it('sin alwaysBySlug, superar el umbral sigue cayendo al fallback global (comportamiento preexistente)', async () => {
    await invalidatePromoDetailBySlugs(manySlugs)
    expect(revalidateTagMock).toHaveBeenCalledWith(PROMO_DETAIL_TAG)
    expect(revalidateTagMock).not.toHaveBeenCalledWith(promoDetailIdTag('promo-0'))
  })

  it('el origin es solo para logging y no cambia qué tags se invalidan', async () => {
    await invalidateCommerceDetailBySlugs(['coto'], { alwaysBySlug: true, origin: 'test-origin' })
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('coto'))
  })
})

describe('throttle — tandas de ~25 llamadas por segundo (ver pedido 27/11/2026)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('procesa de a lo sumo 25 slugs por tanda, esperando 1s entre tandas', async () => {
    const slugs = Array.from({ length: 60 }, (_, i) => `promo-${i}`)

    const promise = invalidatePromoDetailBySlugs(slugs, { alwaysBySlug: true })

    // Tanda 1 (0-24) se procesa de inmediato, de forma síncrona.
    await vi.advanceTimersByTimeAsync(0)
    expect(revalidateTagMock).toHaveBeenCalledTimes(25)
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-0'))
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-24'))
    expect(revalidateTagMock).not.toHaveBeenCalledWith(promoDetailIdTag('promo-25'))

    // Tanda 2 (25-49) recién después de esperar 1s.
    await vi.advanceTimersByTimeAsync(1000)
    expect(revalidateTagMock).toHaveBeenCalledTimes(50)
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-25'))
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-49'))
    expect(revalidateTagMock).not.toHaveBeenCalledWith(promoDetailIdTag('promo-50'))

    // Tanda 3 (50-59), última — sin esperar delay extra después.
    await vi.advanceTimersByTimeAsync(1000)
    expect(revalidateTagMock).toHaveBeenCalledTimes(60)
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-59'))

    await promise
  })

  it('no espera ningún delay si la lista cabe en una sola tanda (<=25)', async () => {
    const slugs = Array.from({ length: 10 }, (_, i) => `comercio-${i}`)

    const promise = invalidateCommerceDetailBySlugs(slugs, { alwaysBySlug: true })
    await vi.advanceTimersByTimeAsync(0)

    expect(revalidateTagMock).toHaveBeenCalledTimes(20) // commerceDetailIdTag + commerceAuxTag por slug
    await promise
  })
})
