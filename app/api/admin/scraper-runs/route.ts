import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Días sin una corrida exitosa a partir de los cuales un scraper se considera
// "estancado" — ver reporte ejecutivo pedido por Pablo 4/9/2026.
const STALE_DAYS = 7

// Horas en 'running' antes de considerar el run colgado (proceso/job matado
// externamente sin llegar a loguear su propio final) y marcarlo error solo.
const STUCK_RUNNING_HOURS = 2

// GET /api/admin/scraper-runs — reporte ejecutivo: última corrida por scraper +
// lista de estancados (sin success hace más de STALE_DAYS días, o sin ningún registro).
export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scraperId = searchParams.get('scraperId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  // Auto-limpieza de runs colgados: si un job murió externamente (timeout de
  // GitHub Actions, crash del server) nunca llega a loguear su propio final y
  // la fila queda en 'running' para siempre. Se marca error acá, en vez de
  // depender de correr un script a mano cada vez.
  await prisma.scraperRun.updateMany({
    where: {
      status: 'running',
      startedAt: { lt: new Date(Date.now() - STUCK_RUNNING_HOURS * 60 * 60 * 1000) },
    },
    data: {
      status: 'error',
      message: `Interrumpido: sin actualizar hace más de ${STUCK_RUNNING_HOURS}h`,
      finishedAt: new Date(),
    },
  })

  // Historial reciente (para el panel "corridas recientes")
  const recent = await prisma.scraperRun.findMany({
    where: scraperId ? { scraperId: scraperId.toLowerCase() } : undefined,
    orderBy: { startedAt: 'desc' },
    take: limit,
  })

  // Última corrida por scraper (cualquier status) + última exitosa
  const all = await prisma.scraperRun.findMany({
    orderBy: { startedAt: 'desc' },
    select: { scraperId: true, status: true, startedAt: true, finishedAt: true, found: true, processed: true, skipped: true, message: true, trigger: true },
  })

  const latestByScraperId = new Map<string, typeof all[number]>()
  const latestSuccessByScraperId = new Map<string, typeof all[number]>()
  for (const r of all) {
    if (!latestByScraperId.has(r.scraperId)) latestByScraperId.set(r.scraperId, r)
    if (r.status === 'success' && !latestSuccessByScraperId.has(r.scraperId)) latestSuccessByScraperId.set(r.scraperId, r)
  }

  const now = Date.now()
  const staleThresholdMs = STALE_DAYS * 24 * 60 * 60 * 1000

  const stale = Array.from(latestByScraperId.keys()).map(id => {
    const last = latestByScraperId.get(id)!
    const lastSuccess = latestSuccessByScraperId.get(id) ?? null
    const daysSinceSuccess = lastSuccess ? Math.floor((now - lastSuccess.startedAt.getTime()) / 86400000) : null
    const isStale = !lastSuccess || (now - lastSuccess.startedAt.getTime()) > staleThresholdMs
    return {
      scraperId: id,
      lastStatus: last.status,
      lastRunAt: last.startedAt,
      lastRunMessage: last.message,
      lastSuccessAt: lastSuccess?.startedAt ?? null,
      daysSinceSuccess,
      isStale,
    }
  }).filter(s => s.isStale).sort((a, b) => (b.daysSinceSuccess ?? 9999) - (a.daysSinceSuccess ?? 9999))

  return NextResponse.json({
    staleDaysThreshold: STALE_DAYS,
    recent,
    stale,
    latestByScraperId: Object.fromEntries(latestByScraperId),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}
