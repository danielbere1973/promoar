import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { PROMO_DETAIL_TAG, promoDetailIdTag, COMMERCE_DETAIL_TAG, commerceDetailIdTag } from '@/lib/cache/detailCache'

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
  return makeGetPromoBySlug(slug)(slug)
})

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
  return makeGetCommerceBySlug(slug)(slug)
})
