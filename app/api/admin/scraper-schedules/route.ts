import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedules = await prisma.scraperSchedule.findMany({
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      }
    },
    orderBy: { scraperId: 'asc' }
  })

  return NextResponse.json({ schedules })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { scraperId, frequency, dayOfWeek, dayOfMonth, hour, active } = body

  const nextRunAt = computeNextRun(frequency, dayOfWeek, dayOfMonth, hour ?? 6)

  const schedule = await prisma.scraperSchedule.upsert({
    where: { scraperId },
    update: { frequency, dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null, hour: hour ?? 6, active: active ?? true, nextRunAt },
    create: { scraperId, frequency, dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null, hour: hour ?? 6, active: active ?? true, nextRunAt },
  })

  return NextResponse.json({ schedule })
}
