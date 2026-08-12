import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'

export const PROMOS_PUBLIC_TAG = 'promos-public'
export const CATALOG_VERSION_KEY = 'catalogVersion'

/**
 * Incrementa SiteConfig.catalogVersion de forma atómica (UPDATE en el propio
 * Postgres, no read-modify-write en app). RecommendationSnapshot compara este
 * valor contra el que tenía al generarse para saber si el catálogo cambió
 * desde entonces — a diferencia de revalidateTag(), esto debe persistir sí o
 * sí, por eso se await-ea y cualquier falla se loguea explícitamente en vez
 * de tragarse en un catch silencioso.
 */
async function bumpCatalogVersion(): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO site_config (key, value)
    VALUES (${CATALOG_VERSION_KEY}, '1')
    ON CONFLICT (key) DO UPDATE SET value = (site_config.value::int + 1)::text
  `
}

/**
 * Invalida la caché pública de /api/promos (rama invitado sin filtros) y
 * bumpea catalogVersion para que los RecommendationSnapshot existentes se
 * detecten como stale. revalidateTag sigue siendo best-effort (fallback de
 * TTL de 10min si falla); el bump de catalogVersion NO lo es — su falla se
 * loguea aparte y explícitamente porque determina staleness de snapshots.
 */
export async function invalidatePublicPromosCache(): Promise<void> {
  try {
    revalidateTag(PROMOS_PUBLIC_TAG)
  } catch (error) {
    console.error('[promos-cache] revalidateTag failed, relying on 10min TTL fallback', error)
  }

  try {
    await bumpCatalogVersion()
  } catch (error) {
    console.error('[promos-cache] bumpCatalogVersion FAILED — RecommendationSnapshot staleness detection is now unreliable until this succeeds', error)
  }
}
