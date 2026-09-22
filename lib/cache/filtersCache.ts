import { revalidateTag } from 'next/cache'

export const CATEGORIES_PUBLIC_TAG = 'categories-public'
export const ENTITIES_PUBLIC_TAG = 'entities-public'
export const SITE_CONFIG_PUBLIC_TAG = 'site-config-public'

/**
 * Invalida la caché pública de /api/categories (rama for_me=false).
 * Nunca debe hacer fallar la escritura que la dispara — un fallo acá solo
 * implica que el TTL de red de seguridad (ver route.ts) sirve counts
 * desactualizados hasta su próximo vencimiento natural.
 */
export function invalidateCategoriesCache() {
  try {
    revalidateTag(CATEGORIES_PUBLIC_TAG)
  } catch (error) {
    console.error('[categories-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

/**
 * Invalida la caché pública de /api/public/entities (bancos, billeteras,
 * redes, segmentos, monedas, tipos de cuenta).
 */
export function invalidateEntitiesCache() {
  try {
    revalidateTag(ENTITIES_PUBLIC_TAG)
  } catch (error) {
    console.error('[entities-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

/**
 * Invalida la caché pública de /api/site-config. Se llama de forma inmediata
 * tras cada escritura desde el admin (no depender del TTL acá): el admin
 * espera ver el valor reflejado enseguida.
 */
export function invalidateSiteConfigCache() {
  try {
    revalidateTag(SITE_CONFIG_PUBLIC_TAG)
  } catch (error) {
    console.error('[site-config-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}
