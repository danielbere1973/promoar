import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function extractDomain(website: string): string {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^www\./, '').split('/')[0]
  }
}

function guessDomain(name: string, slug: string): string[] {
  const clean = slug.replace(/-/g, '')
  return [
    `${slug}.com.ar`,
    `${slug}.com`,
    `${clean}.com.ar`,
    `${clean}.com`,
  ]
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const commerces = await prisma.commerce.findMany({
    where: {
      logoUrl: null,
      promos: { some: { status: 'ACTIVE' } }
    },
    select: { id: true, name: true, slug: true, website: true },
    orderBy: { name: 'asc' },
    take: 100,
  })

  const suggestions = commerces.map(c => {
    const domains = c.website
      ? [extractDomain(c.website)]
      : guessDomain(c.name, c.slug)

    const logoUrls = domains.map(d => `https://logo.clearbit.com/${d}`)

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      website: c.website,
      logoUrl: logoUrls[0],
      allLogoUrls: logoUrls,
    }
  })

  return NextResponse.json({ suggestions })
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updates } = await req.json() as { updates: { id: string; logoUrl: string }[] }

  let saved = 0
  for (const { id, logoUrl } of updates) {
    await prisma.commerce.update({ where: { id }, data: { logoUrl } })
    saved++
  }

  return NextResponse.json({ saved })
}
