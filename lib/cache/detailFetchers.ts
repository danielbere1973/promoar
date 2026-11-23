import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { PROMO_DETAIL_TAG, promoDetailIdTag, COMMERCE_DETAIL_TAG, commerceDetailIdTag } from '@/lib/cache/detailCache'
// Módulo interno de Next (no es parte del API público de `next/cache`), pero es
// el mismo que unstable_cache usa para leer `store.urlPathname` — ver nota en
// withPathnameStore más abajo sobre por qué hace falta tocarlo directamente.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { staticGenerationAsyncStorage } = require('next/dist/client/components/static-generation-async-storage.external')

/**
 * Corre `fn` dentro de un store con `urlPathname` forzado a `pathname`.
 *
 * Por qué hace falta esto: `unstable_cache` arma su `cacheKey` a partir de
 * `cb.toString() + keyParts + JSON.stringify(args)` (confirmado leyendo
 * node_modules/next/dist/server/web/spec-extension/unstable-cache.js) — ese
 * cálculo es idéntico sin importar quién llama, así que NO es la causa del
 * bug de "warm escribe, la página no lo encuentra". Pero además construye un
 * `fetchUrl` (`unstable_cache ${store.urlPathname}...`) que manda como header
 * a la Data Cache en cada GET/SET (ver node_modules/next/dist/server/lib/
 * incremental-cache/fetch-cache.js). El handler de caché real de Vercel es
 * cerrado — no podemos confirmar desde acá si particiona por ese header —
 * pero sin forzarlo, cuando esta función corre desde
 * app/api/internal/warm-detail/route.ts, `store.urlPathname` es
 * "/api/internal/warm-detail" (el pathname del propio endpoint), mientras que
 * cuando corre desde la página real es "/promos/<slug>" o "/comercios/<slug>".
 * Forzándolo acá, el warm job escribe bajo el mismo `urlPathname` que la
 * página usaría, eliminando esa posible causa de divergencia sin depender de
 * verificar el código cerrado de Vercel.
 */
function withPathnameStore<T>(pathname: string, fn: () => Promise<T>): Promise<T> {
  const existingStore = staticGenerationAsyncStorage.getStore()
  return staticGenerationAsyncStorage.run({ ...existingStore, urlPathname: pathname }, fn)
}

// Log temporal, SOLO producción — borrar junto con el resto de esta nota una
// vez confirmado en los logs de Vercel que warm y página usan el mismo
// urlPathname (ver CLAUDE.md / PR del fix para el procedimiento de verificación).
function logEffectivePathname(context: string, pathname: string) {
  if (process.env.NODE_ENV === 'production') {
    console.log(`[cache-key-debug] ${context} urlPathname=${pathname}`)
  }
}

// Extraído de app/promos/[slug]/page.tsx y app/comercios/[slug]/page.tsx (antes
// acopladas al page.tsx de cada ruta) para que app/api/internal/warm-detail/route.ts
// pueda llamar exactamente a la misma función — mismo keyParts, mismos tags, mismo
// revalidate — que usan las páginas. Si hubiera dos implementaciones (una en el page,
// otra en el endpoint), Next.js las trataría como entradas de caché distintas y
// calentar desde el endpoint no tendría ningún efecto sobre lo que ve la página.

// unstable_cache exige un array de tags estático por función — no puede depender
// del resultado (acá no se conoce el promo.id hasta resolver el slug). Por eso se
// usa una factory: un unstable_cache nuevo por slug, con el tag `promo:<slug>` ya
// armado en ese momento. Next.js dedupea por keyParts + argumentos reales, no por
// identidad del closure, así que llamar a la factory de nuevo con el mismo slug en
// otro request (o desde el endpoint de warm) reusa la misma entrada de caché.
export function makeGetPromoBySlug(slug: string) {
  return unstable_cache(
    async (slug: string) => {
      if (process.env.NODE_ENV === 'production') console.log(`[cache-miss] promo-detail ${slug}`)
      const promo = await prisma.promo.findUnique({
        where: { slug },
        include: {
          commerce: true,
          category: true,
          requirements: {
            include: { bank: true, wallet: true, cardNetwork: true },
            orderBy: { discountValue: 'desc' },
          },
        },
      })
      return promo
    },
    ['promo-detail-by-slug'],
    { tags: [PROMO_DETAIL_TAG, promoDetailIdTag(slug)], revalidate: 259200 },
  )
}

// cache() de React dedupea esta llamada DENTRO de un mismo request — ver el
// comentario original en app/promos/[slug]/page.tsx para el detalle completo.
export const getCachedPromoBySlug = cache(async (slug: string) => {
  const store = staticGenerationAsyncStorage.getStore()
  logEffectivePathname('page promo-detail', store?.urlPathname ?? '(sin store)')
  return makeGetPromoBySlug(slug)(slug)
})

/**
 * Para app/api/internal/warm-detail/route.ts exclusivamente: llama a
 * makeGetPromoBySlug pero forzando `store.urlPathname` a "/promos/<slug>",
 * el mismo valor que tendría si la llamada viniera de la página real. Ver
 * withPathnameStore más arriba para el por qué.
 */
export async function warmGetPromoBySlug(slug: string) {
  const pathname = `/promos/${slug}`
  logEffectivePathname('warm promo-detail', pathname)
  return withPathnameStore(pathname, () => makeGetPromoBySlug(slug)(slug))
}

// Mismo patrón que makeGetPromoBySlug, para app/comercios/[slug]/page.tsx.
export function makeGetCommerceBySlug(slug: string) {
  return unstable_cache(
    async (slug: string) => {
      if (process.env.NODE_ENV === 'production') console.log(`[cache-miss] comercio-detail ${slug}`)
      return prisma.commerce.findUnique({
        where: { slug },
        include: {
          defaultCategory: true,
          _count: { select: { branches: true } },
        },
      }).catch(() => null)
    },
    ['commerce-detail-by-slug'],
    { tags: [COMMERCE_DETAIL_TAG, commerceDetailIdTag(slug)], revalidate: 259200 },
  )
}

export const getCachedCommerceBySlug = cache(async (slug: string) => {
  const store = staticGenerationAsyncStorage.getStore()
  logEffectivePathname('page comercio-detail', store?.urlPathname ?? '(sin store)')
  return makeGetCommerceBySlug(slug)(slug)
})

/** Igual que warmGetPromoBySlug pero para app/comercios/[slug]/page.tsx. */
export async function warmGetCommerceBySlug(slug: string) {
  const pathname = `/comercios/${slug}`
  logEffectivePathname('warm comercio-detail', pathname)
  return withPathnameStore(pathname, () => makeGetCommerceBySlug(slug)(slug))
}
