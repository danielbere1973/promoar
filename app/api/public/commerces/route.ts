import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

export async function GET() {
  try {
    const commerces = await prisma.commerce.findMany({
      where: {
        active: true,
        promos: { some: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        _count: { select: { promos: { where: { status: 'ACTIVE' } } } },
      },
    })

    const POPULAR_THRESHOLD = 20

    const mapped = commerces
      .map(c => ({ ...c, name: decodeHtmlEntities(c.name), promoCount: c._count.promos }))
      .map(({ _count, promoCount, ...c }) => ({ ...c, popular: promoCount >= POPULAR_THRESHOLD }))

    const popular = mapped.filter(c => c.popular).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const others  = mapped.filter(c => !c.popular).sort((a, b) => a.name.localeCompare(b.name, 'es'))

    return NextResponse.json({ commerces: [...popular, ...others], popularThreshold: POPULAR_THRESHOLD })
  } catch (error) {
    console.error('[GET /api/public/commerces]', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
