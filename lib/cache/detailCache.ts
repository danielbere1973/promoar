import { revalidateTag } from 'next/cache'

export const PROMO_DETAIL_TAG = 'promos-detail'
export const COMMERCE_DETAIL_TAG = 'comercios-detail'
export const BANK_DETAIL_TAG = 'bancos-detail'

/**
 * Invalida toda la caché de páginas de detalle de promos (/promos/[slug]).
 * Invalidación por dominio, no por slug individual (RFC-004): más simple,
 * a costo de invalidar todos los slugs cacheados ante cualquier cambio.
 */
export function invalidatePromoDetailCache() {
  try {
    revalidateTag(PROMO_DETAIL_TAG)
  } catch (error) {
    console.error('[promo-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

/**
 * Invalida toda la caché de páginas de detalle de comercios (/comercios/[slug]).
 */
export function invalidateCommerceDetailCache() {
  try {
    revalidateTag(COMMERCE_DETAIL_TAG)
  } catch (error) {
    console.error('[commerce-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

/**
 * Invalida toda la caché de páginas de detalle de bancos/billeteras (/bancos/[slug]).
 */
export function invalidateBankDetailCache() {
  try {
    revalidateTag(BANK_DETAIL_TAG)
  } catch (error) {
    console.error('[bank-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}
