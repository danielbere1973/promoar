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
