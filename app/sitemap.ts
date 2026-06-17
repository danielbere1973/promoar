import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const BATCH_SIZE = 5000

export const revalidate = 3600

export async function generateSitemaps() {
  const count = await prisma.promo.count({
    where: { slug: { not: null }, status: { in: ['ACTIVE', 'EXPIRED'] } },
  })
  const promoBatches = Math.ceil(count / BATCH_SIZE)
  return [
    { id: 0 }, // estáticas + bancos + comercios
    ...Array.from({ length: promoBatches }, (_, i) => ({ id: i + 1 })),
  ]
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Sitemap 0: estáticas + finanzas + bancos + billeteras + comercios
  if (id === 0) {
    const staticRoutes: MetadataRoute.Sitemap = [
      { url: BASE_URL,                  lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
      { url: `${BASE_URL}/promos`,      lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
      { url: `${BASE_URL}/perfil`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
      { url: `${BASE_URL}/login`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
      { url: `${BASE_URL}/registro`,    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    ]

    const finanzasRoutes: MetadataRoute.Sitemap = [
      { url: `${BASE_URL}/finanzas/divisas`,      lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
      { url: `${BASE_URL}/finanzas/cauciones`,    lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
      { url: `${BASE_URL}/finanzas/plazo-fijo`,   lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/acciones-ar`,  lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/acciones-usa`, lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/indices`,      lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/lecaps`,       lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/bonos`,        lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/cedears`,      lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
      { url: `${BASE_URL}/finanzas/ons`,          lastModified: now, changeFrequency: 'daily',  priority: 0.8 },
    ]

    const [banks, wallets] = await Promise.all([
      prisma.bank.findMany({ where: { active: true }, select: { slug: true } }).catch(() => []),
      prisma.wallet.findMany({ where: { active: true }, select: { slug: true } }).catch(() => []),
    ])

    const bankRoutes: MetadataRoute.Sitemap = [...banks, ...wallets].map(e => ({
      url: `${BASE_URL}/bancos/${e.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }))

    const commerces = await prisma.commerce.findMany({
      where: { active: true, promos: { some: { status: 'ACTIVE' } } },
      select: { slug: true },
      orderBy: { name: 'asc' },
    }).catch(() => [])

    const commerceRoutes: MetadataRoute.Sitemap = commerces.map(c => ({
      url: `${BASE_URL}/comercios/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    return [...staticRoutes, ...finanzasRoutes, ...bankRoutes, ...commerceRoutes]
  }

  // Sitemaps 1+: promos en lotes de BATCH_SIZE
  const skip = (id - 1) * BATCH_SIZE
  const promos = await prisma.promo.findMany({
    where: { slug: { not: null }, status: { in: ['ACTIVE', 'EXPIRED'] } },
    select: { slug: true, updatedAt: true, status: true },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: BATCH_SIZE,
    skip,
  }).catch(() => [])

  return promos.map(p => ({
    url: `${BASE_URL}/promos/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: p.status === 'ACTIVE' ? 0.6 : 0.3,
  }))
}
