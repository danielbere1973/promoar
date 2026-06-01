import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function computeNextRun(frequency: string, dayOfWeek?: number, dayOfMonth?: number, hour = 6): Date | null {
  if (frequency === 'manual') return null
  const now = new Date()
  const next = new Date(now)
  next.setUTCMinutes(0, 0, 0)

  if (frequency === 'daily') {
    next.setUTCHours(hour)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  } else if (frequency === 'weekly') {
    const dow = dayOfWeek ?? 1
    next.setUTCHours(hour)
    const diff = (dow - next.getUTCDay() + 7) % 7 || 7
    next.setUTCDate(next.getUTCDate() + diff)
  } else if (frequency === 'monthly') {
    const dom = dayOfMonth ?? 1
    next.setUTCHours(hour)
    next.setUTCDate(dom)
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1)
  }

  return next
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedules = await prisma.scraperSchedule.findMany({
    orderBy: { scraperId: 'asc' }
  })

  // Obtener el último run para TODOS los scrapers (tengan schedule o no)
  const lastRuns = await prisma.scraperRun.findMany({
    orderBy: { startedAt: 'desc' },
    distinct: ['scraperId'],
    select: { scraperId: true, status: true, startedAt: true, found: true, processed: true, message: true }
  })
  const lastRunMap = Object.fromEntries(lastRuns.map(r => [r.scraperId, r]))

  const schedulesWithRuns = schedules.map(s => ({ ...s, runs: lastRunMap[s.scraperId] ? [lastRunMap[s.scraperId]] : [] }))

  return NextResponse.json({ schedules: schedulesWithRuns })
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { scraperId, frequency, dayOfWeek, dayOfMonth, hour, active } = body

  const nextRunAt = computeNextRun(frequency, dayOfWeek, dayOfMonth, hour ?? 6)

  const schedule = await prisma.scraperSchedule.upsert({
    where: { scraperId },
    update: { frequency, dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null, hour: hour ?? 6, active: active ?? true, nextRunAt },
    create: { scraperId, frequency, dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null, hour: hour ?? 6, active: active ?? true, nextRunAt },
  })

  return NextResponse.json({ schedule })
}
