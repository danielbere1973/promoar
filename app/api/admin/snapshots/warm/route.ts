export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { warmSnapshotForUser, warmGuestRegionSnapshot, currentPromoPoolVersion } from '@/app/api/promos/home-decision/route'
import { getActiveHomeRubroIds } from '@/lib/rubroPreferences'

// CPO Directiva "Ratificación del Universo de Rubros para Guests" (26/8/2026):
// regiones a precalentar como snapshot regional de guest — AR (fallback
// nacional) + CABA/GBA, que concentran la mayor parte del tráfico anónimo.
const GUEST_REGIONS: (string | null)[] = [null, 'CABA', 'Buenos Aires']

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

  // CPO Directiva "Optimización Warmup Batch" (26/8/2026): promoPoolVersion y
  // activeRubroIds no dependen del usuario — se computan UNA vez para todo el
  // batch en vez de que cada warmSnapshotForUser repita las 2 queries agregadas
  // de Prisma (antes: 32 usuarios = 64 queries agregadas concurrentes a Neon).
  const [promoPoolVersion, activeRubroIds] = await Promise.all([
    currentPromoPoolVersion(),
    getActiveHomeRubroIds(),
  ])
  const sharedContext = { promoPoolVersion, activeRubroIds }

  const profiles = await prisma.financialProfile.findMany({
    select: { userId: true, user: { select: { email: true, role: true } } },
  })

  const filteredProfiles = profiles.filter(p => !!p.user?.email)
  const results = []
  
  // Procesar en lotes (chunks) de 5 para no saturar el connection pool de Prisma (límite: 10)
  const CHUNK_SIZE = 5
  for (let i = 0; i < filteredProfiles.length; i += CHUNK_SIZE) {
    const chunk = filteredProfiles.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(p =>
        warmSnapshotForUser(
          p.userId,
          p.user!.email!,
          p.user!.role === 'ADMIN' || p.user!.role === 'MODERATOR',
          sharedContext
        )
      )
    )
    results.push(...chunkResults)
  }

  // Las regiones guest son pocas (3), se pueden hacer en paralelo al final
  const guestResults = await Promise.all(
    GUEST_REGIONS.map(province => warmGuestRegionSnapshot(province, sharedContext))
  )

  const summary = {
    total: results.length,
    hit: results.filter(r => r.action === 'hit').length,
    recomputed: results.filter(r => r.action === 'recomputed').length,
    error: results.filter(r => r.action === 'error').length,
    totalMs: Date.now() - startedAt,
    guestRegions: {
      total: guestResults.length,
      recomputed: guestResults.filter(r => r.action === 'recomputed').length,
      error: guestResults.filter(r => r.action === 'error').length,
    },
  }

  console.log('[POST /api/admin/snapshots/warm]', summary)

  return NextResponse.json({ summary, results, guestResults })
}
