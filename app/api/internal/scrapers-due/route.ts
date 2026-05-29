import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const schedules = await prisma.scraperSchedule.findMany({
    where: {
      active: true,
      frequency: { not: 'manual' },
      nextRunAt: { lte: now },
    },
    select: { scraperId: true },
  })

  return NextResponse.json({ scrapers: schedules.map(s => s.scraperId) })
}
