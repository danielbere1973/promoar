import { revalidateTag } from 'next/cache'

export const PROMOS_PUBLIC_TAG = 'promos-public'

/**
 * Invalida la caché pública de /api/promos (rama invitado sin filtros).
 * Nunca debe hacer fallar la escritura que la dispara — un fallo acá solo
 * implica que el TTL de red de seguridad (10 min, ver getPublicPromosPage)
 * sirve datos desactualizados hasta su próximo vencimiento natural.
 */
export function invalidatePublicPromosCache() {
  try {
    revalidateTag(PROMOS_PUBLIC_TAG)
  } catch (error) {
    console.error('[promos-cache] revalidateTag failed, relying on 10min TTL fallback', error)
  }
}
