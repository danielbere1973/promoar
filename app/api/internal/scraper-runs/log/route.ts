import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendScraperReportEmail } from '@/lib/scraperReportEmail'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, scraperId, runId, found, processed, error } = body

  if (action === 'start') {
    if (!scraperId) return NextResponse.json({ error: 'Missing scraperId' }, { status: 400 })
    const run = await prisma.scraperRun.create({
      data: { scraperId, status: 'running', trigger: 'gh_actions' }
    })
    return NextResponse.json({ runId: run.id })
  }

  if (action === 'finish') {
    if (!runId || !scraperId) return NextResponse.json({ error: 'Missing runId or scraperId' }, { status: 400 })
    
    const status = error ? 'error' : 'success'
    
    await prisma.scraperRun.update({
      where: { id: runId },
      data: { 
        status, 
        finishedAt: new Date(),
        found: found ?? 0,
        processed: processed ?? 0,
        message: error ?? null
      }
    })

    if (status === 'success') {
        const schedule = await prisma.scraperSchedule.findUnique({ where: { scraperId } })
        if (schedule && schedule.frequency !== 'manual') {
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
            next.setUTCHours(schedule.hour)
            next.setUTCDate(schedule.dayOfMonth ?? 1)
            if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1)
          }
          await prisma.scraperSchedule.update({
            where: { scraperId },
            data: { nextRunAt: next }
          })
        }
    }

    await sendScraperReportEmail({
      results: [{
        scraperId,
        status,
        found: found ?? 0,
        processed: processed ?? 0,
        message: error,
        trigger: 'gh_actions'
      }],
      batchLabel: 'GitHub Actions'
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
