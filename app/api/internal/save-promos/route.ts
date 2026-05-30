import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SECRET = process.env.VTEX_SESSION_SECRET

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { scraperId, promos } = await request.json() as { scraperId: string; promos: any[] }
  if (!scraperId || !promos?.length) {
    return NextResponse.json({ error: 'Missing scraperId or promos' }, { status: 400 })
  }

  const run = await prisma.scraperRun.create({ data: { scraperId, status: 'running' } })

  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://promoar.vercel.app'
    const res = await fetch(`${baseUrl}/api/admin/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promos }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Scrape API error ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const found = promos.length
    const processed = data.processed ?? 0

    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: 'success', finishedAt: new Date(), found, processed }
    })

    return NextResponse.json({ ok: true, found, processed })
  } catch (e: any) {
    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), message: e.message }
    })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
