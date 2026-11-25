import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  it('invalida commerceAuxTag para cada comercio además de commerceDetailIdTag', () => {
    invalidateCommerceDetailBySlugs(['coto', 'jumbo'])

    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('coto'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('coto'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('jumbo'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('jumbo'))
  })

  it('no llama a revalidateTag si la lista está vacía', () => {
    invalidateCommerceDetailBySlugs([])
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('commerce-aux tag — invalidatePromoDetailBySlugs con commerceSlugs', () => {
  it('invalida commerceAuxTag para cada comercio pasado en opts.commerceSlugs', () => {
    invalidatePromoDetailBySlugs(['promo-a', 'promo-b'], { commerceSlugs: ['coto', 'jumbo'] })

    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-a'))
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-b'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('coto'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('jumbo'))
  })

  it('sin opts.commerceSlugs, no invalida ningún commerceAuxTag', () => {
    invalidatePromoDetailBySlugs(['promo-a'])

    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-a'))
    expect(revalidateTagMock).not.toHaveBeenCalledWith(expect.stringMatching(/^commerce-aux:/))
  })

  it('invalida commerceAuxTag aunque slugs de promo esté vacío (solo commerceSlugs)', () => {
    invalidatePromoDetailBySlugs([], { commerceSlugs: ['coto'] })
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag('coto'))
  })
})

describe('alwaysBySlug — nunca cae al fallback global (ver incidente 25/11/2026)', () => {
  const manySlugs = Array.from({ length: DETAIL_INVALIDATION_BULK_THRESHOLD + 50 }, (_, i) => `promo-${i}`)
  const manyCommerceSlugs = Array.from({ length: DETAIL_INVALIDATION_BULK_THRESHOLD + 50 }, (_, i) => `comercio-${i}`)

  it('invalidatePromoDetailBySlugs con alwaysBySlug:true invalida por slug aunque supere el umbral', () => {
    invalidatePromoDetailBySlugs(manySlugs, { alwaysBySlug: true })

    expect(revalidateTagMock).not.toHaveBeenCalledWith(PROMO_DETAIL_TAG)
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag('promo-0'))
    expect(revalidateTagMock).toHaveBeenCalledWith(promoDetailIdTag(`promo-${manySlugs.length - 1}`))
  })

  it('invalidateCommerceDetailBySlugs con alwaysBySlug:true invalida por slug aunque supere el umbral', () => {
    invalidateCommerceDetailBySlugs(manyCommerceSlugs, { alwaysBySlug: true })

    expect(revalidateTagMock).not.toHaveBeenCalledWith(COMMERCE_DETAIL_TAG)
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('comercio-0'))
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceAuxTag(`comercio-${manyCommerceSlugs.length - 1}`))
  })

  it('sin alwaysBySlug, superar el umbral sigue cayendo al fallback global (comportamiento preexistente)', () => {
    invalidatePromoDetailBySlugs(manySlugs)
    expect(revalidateTagMock).toHaveBeenCalledWith(PROMO_DETAIL_TAG)
    expect(revalidateTagMock).not.toHaveBeenCalledWith(promoDetailIdTag('promo-0'))
  })

  it('el origin es solo para logging y no cambia qué tags se invalidan', () => {
    invalidateCommerceDetailBySlugs(['coto'], { alwaysBySlug: true, origin: 'test-origin' })
    expect(revalidateTagMock).toHaveBeenCalledWith(commerceDetailIdTag('coto'))
  })
})
