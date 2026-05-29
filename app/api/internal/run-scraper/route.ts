import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapers } from '@/lib/scrapers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SECRET = process.env.VTEX_SESSION_SECRET

function computeNextRun(schedule: { frequency: string; dayOfWeek?: number | null; dayOfMonth?: number | null; hour: number }): Date {
  const now = new Date()
  const next = new Date(now)
  next.setUTCMinutes(0, 0, 0)

  if (schedule.frequency === 'daily') {
    next.setUTCHours(schedule.hour)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  } else if (schedule.frequency === 'weekly') {
    const dow = schedule.dayOfWeek ?? 1
    next.setUTCHours(schedule.hour)
    const diff = (dow - next.getUTCDay() + 7) % 7 || 7
    next.setUTCDate(next.getUTCDate() + diff)
  } else if (schedule.frequency === 'monthly') {
    const dom = schedule.dayOfMonth ?? 1
    next.setUTCHours(schedule.hour)
    next.setUTCDate(dom)
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1)
  }

  return next
}

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { scraperId } = await request.json() as { scraperId: string }
  if (!scraperId) return NextResponse.json({ error: 'Missing scraperId' }, { status: 400 })

  const scraper = scrapers[scraperId]
  if (!scraper) return NextResponse.json({ error: `Scraper "${scraperId}" not found` }, { status: 404 })

  // Registrar inicio del run
  const run = await prisma.scraperRun.create({
    data: { scraperId, status: 'running' }
  })

  try {
    const promos = await scraper.run()
    let processed = 0

    for (const promo of promos) {
      try {
        // Usar la misma lógica de upsert que el endpoint de scrape admin
        await prisma.promo.upsert({
          where: { slug: promo.slug ?? `${scraperId}-${Date.now()}-${processed}` },
          update: { ...promo, updatedAt: new Date() },
          create: promo as any,
        })
        processed++
      } catch {}
    }

    // Actualizar run como exitoso
    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: 'success', finishedAt: new Date(), found: promos.length, processed }
    })

    // Calcular próximo run
    const schedule = await prisma.scraperSchedule.findUnique({ where: { scraperId } })
    if (schedule && schedule.frequency !== 'manual') {
      await prisma.scraperSchedule.update({
        where: { scraperId },
        data: { nextRunAt: computeNextRun(schedule) }
      })
    }

    return NextResponse.json({ ok: true, found: promos.length, processed })
  } catch (e: any) {
    await prisma.scraperRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), message: e.message }
    })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
