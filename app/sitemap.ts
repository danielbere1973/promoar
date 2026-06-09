import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                  lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/promos`,      lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${BASE_URL}/finanzas`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/perfil`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE_URL}/login`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/registro`,    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', slug: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  }).catch(() => [])

  const promoRoutes: MetadataRoute.Sitemap = promos.map(p => ({
    url: `${BASE_URL}/promos/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const [banks, wallets] = await Promise.all([
    prisma.bank.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.wallet.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }).catch(() => []),
  ])

  const bankRoutes: MetadataRoute.Sitemap = [...banks, ...wallets].map(e => ({
    url: `${BASE_URL}/bancos/${e.slug}`,
    lastModified: e.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

  const commerces = await prisma.commerce.findMany({
    where: { active: true, instagramUrl: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { name: 'asc' },
  }).catch(() => [])

  const commerceRoutes: MetadataRoute.Sitemap = commerces.map(c => ({
    url: `${BASE_URL}/comercios/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticRoutes, ...bankRoutes, ...commerceRoutes, ...promoRoutes]
}
