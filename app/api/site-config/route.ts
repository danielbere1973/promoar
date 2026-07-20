import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { SITE_CONFIG_PUBLIC_TAG } from '@/lib/cache/filtersCache'

export const dynamic = 'force-dynamic'

const getSiteConfigCached = unstable_cache(
  async () => {
    console.log('[site-config-cache] MISS — ejecutando query real')
    const configs = await prisma.siteConfig.findMany()
    const result: Record<string, string> = {}
    for (const c of configs) result[c.key] = c.value
    return result
  },
  ['site-config-public'],
  { revalidate: 600, tags: [SITE_CONFIG_PUBLIC_TAG] },
)

export async function GET() {
  const result = await getSiteConfigCached()
  return NextResponse.json(result)
}
