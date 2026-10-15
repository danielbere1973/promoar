import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Nombres reales emitidos hoy por lib/recommendationEvents.ts (Recommendation
// Block v1, ver RecommendationBlock.tsx/HomeHero.tsx/PromosClient.tsx). Los
// nombres viejos (HOME_VIEW/RECOMMENDATION_IMPRESSION/RECOMMENDATION_CLICK)
// quedaron huérfanos cuando se borró app/home-v2/HomeV2Client.tsx el 29/8/2026
// — nadie los emite desde entonces, por eso el panel se veía "sin datos".
const PASO0_EVENTS = [
  'recommendation_block_shown',
  'recommendation_clicked',
  'recommendation_cta_clicked',
  'recommendation_empty',
  'ACTION_SAVE_OR_USE',
] as const

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? 14)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const events = await prisma.userEvent.findMany({
    where: { eventType: { in: [...PASO0_EVENTS] }, createdAt: { gte: since } },
    select: { eventType: true, sessionId: true, userId: true, payload: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const totals: Record<string, number> = {}
  const uniqueSessions: Record<string, Set<string>> = {}
  const byDay: Record<string, Record<string, number>> = {}
  for (const type of PASO0_EVENTS) {
    totals[type] = 0
    uniqueSessions[type] = new Set()
  }

  const commerceImpressions: Record<string, number> = {}
  const commerceClicks: Record<string, number> = {}

  for (const ev of events) {
    totals[ev.eventType] = (totals[ev.eventType] ?? 0) + 1
    uniqueSessions[ev.eventType]?.add(ev.sessionId)

    const day = ev.createdAt.toISOString().slice(0, 10)
    byDay[day] ??= {}
    byDay[day][ev.eventType] = (byDay[day][ev.eventType] ?? 0) + 1

    const payload = ev.payload as Record<string, unknown> | null
    if (ev.eventType === 'recommendation_clicked' && typeof payload?.commerceId === 'string') {
      commerceClicks[payload.commerceId] = (commerceClicks[payload.commerceId] ?? 0) + 1
    }
  }

  const homeViews = totals['recommendation_block_shown'] ?? 0
  const impressions = totals['recommendation_block_shown'] ?? 0
  const clicks = totals['recommendation_clicked'] ?? 0
  const saves = totals['ACTION_SAVE_OR_USE'] ?? 0

  const funnel = {
    sessionsWithHomeView: uniqueSessions['recommendation_block_shown']?.size ?? 0,
    sessionsWithImpression: uniqueSessions['recommendation_block_shown']?.size ?? 0,
    sessionsWithClick: uniqueSessions['recommendation_clicked']?.size ?? 0,
    sessionsWithSave: uniqueSessions['ACTION_SAVE_OR_USE']?.size ?? 0,
  }

  // "Rubros" del panel viejo no existe más en el payload (recommendation_clicked
  // trackea commerceId/promoId, no rubroId) — se muestra por comercio en su lugar.
  const commerceIds = Object.keys(commerceClicks)
  const commerceNames = commerceIds.length
    ? await prisma.commerce.findMany({ where: { id: { in: commerceIds } }, select: { id: true, name: true } })
    : []
  const nameById = new Map(commerceNames.map(c => [c.id, c.name]))

  const commerces = commerceIds
    .map(commerceId => ({
      rubroId: nameById.get(commerceId) ?? commerceId,
      impressions: commerceImpressions[commerceId] ?? 0,
      clicks: commerceClicks[commerceId] ?? 0,
      ctr: 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)

  const series = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({
      day,
      HOME_VIEW: counts['recommendation_block_shown'] ?? 0,
      RECOMMENDATION_IMPRESSION: counts['recommendation_block_shown'] ?? 0,
      RECOMMENDATION_CLICK: counts['recommendation_clicked'] ?? 0,
      ACTION_SAVE_OR_USE: counts['ACTION_SAVE_OR_USE'] ?? 0,
    }))

  return NextResponse.json({
    since: since.toISOString(),
    days,
    totals: {
      homeViews,
      impressions,
      clicks,
      saves,
      authenticatedHomeViews: 0,
      anonymousHomeViews: 0,
    },
    rates: {
      clickThroughRate: impressions ? clicks / impressions : 0,
      saveRate: clicks ? saves / clicks : 0,
    },
    funnel,
    rubros: commerces,
    series,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
