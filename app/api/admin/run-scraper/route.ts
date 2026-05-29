import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { scrapers } from '@/lib/scrapers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { scraperId } = await req.json() as { scraperId: string }
  if (!scraperId) return NextResponse.json({ error: 'Missing scraperId' }, { status: 400 })

  const scraper = scrapers[scraperId]
  if (!scraper) return NextResponse.json({ error: `Scraper "${scraperId}" not found` }, { status: 404 })

  const run = await prisma.scraperRun.create({ data: { scraperId, status: 'running' } })

  try {
    const promos = await scraper.run()
    let processed = 0
    for (const promo of promos) {
      try {
        await (prisma as any).promo.upsert({
          where: { slug: (promo as any).slug ?? `noslug-${Date.now()}-${processed}` },
          update: { ...(promo as any), updatedAt: new Date() },
          create: promo as any,
        })
        processed++
      } catch {}
    }

    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: 'success', finishedAt: new Date(), found: promos.length, processed }
    })

    return NextResponse.json({ ok: true, found: promos.length, processed })
  } catch (e: any) {
    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), message: e.message }
    })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
