import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Retención real = usuarios logueados (userId no null) con actividad en
// semanas distintas. Cualquier UserEvent cuenta como "actividad" — no está
// atado al Recommendation Block como /api/admin/analytics (que mide otro
// funnel). Cohort semanal: para cada semana de "alta" (primera semana con
// actividad del usuario dentro de la ventana consultada), qué % de ese cohort
// tuvo actividad en cada semana siguiente.
function mondayOf(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0=domingo
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addWeeks(mondayStr: string, weeks: number): string {
  const d = new Date(mondayStr + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weeksBack = Math.min(26, Math.max(4, Number(req.nextUrl.searchParams.get('weeks') ?? 12)))
  const since = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000)

  const maxOffset = Math.min(weeksBack, 8) // no mostrar más de 8 columnas de offset
  const currentWeek = mondayOf(new Date())

  function buildCohorts(activeWeeksById: Map<string, Set<string>>) {
    // Cohort de cada id = su primera semana activa dentro de la ventana
    const cohortById = new Map<string, string>()
    for (const id of Array.from(activeWeeksById.keys())) {
      const weeks = activeWeeksById.get(id)!
      const sorted = Array.from(weeks).sort()
      cohortById.set(id, sorted[0])
    }

    const cohortWeeks = Array.from(new Set(cohortById.values())).sort()

    const cohorts = cohortWeeks.map(cohortWeek => {
      const idsInCohort = Array.from(cohortById.entries())
        .filter(([, w]) => w === cohortWeek)
        .map(([id]) => id)
      const size = idsInCohort.length

      const retention: { offset: number; retained: number; pct: number | null }[] = []
      for (let offset = 0; offset <= maxOffset; offset++) {
        const targetWeek = addWeeks(cohortWeek, offset)
        if (targetWeek > currentWeek) {
          retention.push({ offset, retained: 0, pct: null })
          continue
        }
        const retained = idsInCohort.filter(id => activeWeeksById.get(id)?.has(targetWeek)).length
        retention.push({ offset, retained, pct: size > 0 ? retained / size : 0 })
      }

      return { cohortWeek, size, retention }
    })

    function weightedAvg(offset: number): number | null {
      let total = 0
      let retainedTotal = 0
      for (const c of cohorts) {
        const r = c.retention.find(r => r.offset === offset)
        if (!r || r.pct === null) continue
        total += c.size
        retainedTotal += r.retained
      }
      return total > 0 ? retainedTotal / total : null
    }

    return {
      totalIds: cohortById.size,
      cohorts,
      summary: { w1: weightedAvg(1), w2: weightedAvg(2), w4: weightedAvg(4) },
    }
  }

  // --- Cohort 1: usuarios logueados (userId) ---
  const loggedEvents = await prisma.userEvent.findMany({
    where: { userId: { not: null }, createdAt: { gte: since } },
    select: { userId: true, createdAt: true },
  })
  const activeWeeksByUser = new Map<string, Set<string>>()
  for (const ev of loggedEvents) {
    const week = mondayOf(ev.createdAt)
    const uid = ev.userId as string
    const set = activeWeeksByUser.get(uid) ?? new Set<string>()
    set.add(week)
    activeWeeksByUser.set(uid, set)
  }
  const loggedIn = buildCohorts(activeWeeksByUser)

  // --- Cohort 2: todos (sessionId) — invitados + logueados combinados ---
  const allEvents = await prisma.userEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { sessionId: true, createdAt: true },
  })
  const activeWeeksBySession = new Map<string, Set<string>>()
  for (const ev of allEvents) {
    const week = mondayOf(ev.createdAt)
    const sid = ev.sessionId
    const set = activeWeeksBySession.get(sid) ?? new Set<string>()
    set.add(week)
    activeWeeksBySession.set(sid, set)
  }
  const allSessions = buildCohorts(activeWeeksBySession)

  return NextResponse.json({
    since: since.toISOString(),
    weeksBack,
    maxOffset,
    totalLoggedInUsers: loggedIn.totalIds,
    cohorts: loggedIn.cohorts,
    summary: loggedIn.summary,
    sessions: {
      totalSessions: allSessions.totalIds,
      cohorts: allSessions.cohorts,
      summary: allSessions.summary,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
