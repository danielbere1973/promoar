export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { warmSnapshotForUser } from '@/app/api/promos/home-decision/route'

// Prioridad 2, Parte A (cpo-a-cto-dictamen-arquitectura-snapshot-async-25-8-2026.md):
// batch job que recorre usuarios con FinancialProfile activo y recalcula su
// HomeDecisionSnapshot si está vencido. Pensado para 2 triggers: manual/cron
// (admin) y no-bloqueante al final de app/api/admin/scrape/route.ts.
//
// Auth: admin-only via sesión, o `Authorization: Bearer VTEX_SESSION_SECRET`
// para el trigger post-scraping — mismo patrón que app/api/internal/*
// (ej. internal/scrapers-due/route.ts), que ya usa este secret compartido
// para triggers server-to-server dentro del proyecto.
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization') || ''
  const secret = process.env.VTEX_SESSION_SECRET
  if (secret && auth === `Bearer ${secret}`) return true

  const session = await getServerSession()
  if (!session?.user?.email) return false
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const startedAt = Date.now()

  const profiles = await prisma.financialProfile.findMany({
    select: { userId: true, user: { select: { email: true, role: true } } },
  })

  const results = await Promise.all(
    profiles
      .filter(p => !!p.user?.email)
      .map(p => warmSnapshotForUser(p.userId, p.user!.email!, p.user!.role === 'ADMIN' || p.user!.role === 'MODERATOR'))
  )

  const summary = {
    total: results.length,
    hit: results.filter(r => r.action === 'hit').length,
    recomputed: results.filter(r => r.action === 'recomputed').length,
    error: results.filter(r => r.action === 'error').length,
    totalMs: Date.now() - startedAt,
  }

  console.log('[POST /api/admin/snapshots/warm]', summary)

  return NextResponse.json({ summary, results })
}
