import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PASO0_EVENTS = [
  'HOME_VIEW',
  'RECOMMENDATION_IMPRESSION',
  'RECOMMENDATION_CLICK',
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

  const rubroImpressions: Record<string, number> = {}
  const rubroClicks: Record<string, number> = {}
  let authenticatedHomeViews = 0
  let anonymousHomeViews = 0

  for (const ev of events) {
    totals[ev.eventType] = (totals[ev.eventType] ?? 0) + 1
    uniqueSessions[ev.eventType]?.add(ev.sessionId)

    const day = ev.createdAt.toISOString().slice(0, 10)
    byDay[day] ??= {}
    byDay[day][ev.eventType] = (byDay[day][ev.eventType] ?? 0) + 1

    const payload = ev.payload as Record<string, unknown> | null
    if (ev.eventType === 'HOME_VIEW') {
      if (payload?.authenticated) authenticatedHomeViews++
      else anonymousHomeViews++
    }
    if (ev.eventType === 'RECOMMENDATION_IMPRESSION' && typeof payload?.rubroId === 'string') {
      rubroImpressions[payload.rubroId] = (rubroImpressions[payload.rubroId] ?? 0) + 1
    }
    if (ev.eventType === 'RECOMMENDATION_CLICK' && typeof payload?.rubroId === 'string') {
      rubroClicks[payload.rubroId] = (rubroClicks[payload.rubroId] ?? 0) + 1
    }
  }

  const homeViews = totals['HOME_VIEW'] ?? 0
  const impressions = totals['RECOMMENDATION_IMPRESSION'] ?? 0
  const clicks = totals['RECOMMENDATION_CLICK'] ?? 0
  const saves = totals['ACTION_SAVE_OR_USE'] ?? 0

  const funnel = {
    sessionsWithHomeView: uniqueSessions['HOME_VIEW']?.size ?? 0,
    sessionsWithImpression: uniqueSessions['RECOMMENDATION_IMPRESSION']?.size ?? 0,
    sessionsWithClick: uniqueSessions['RECOMMENDATION_CLICK']?.size ?? 0,
    sessionsWithSave: uniqueSessions['ACTION_SAVE_OR_USE']?.size ?? 0,
  }

  const rubros = Array.from(new Set([...Object.keys(rubroImpressions), ...Object.keys(rubroClicks)]))
    .map(rubroId => ({
      rubroId,
      impressions: rubroImpressions[rubroId] ?? 0,
      clicks: rubroClicks[rubroId] ?? 0,
      ctr: rubroImpressions[rubroId] ? (rubroClicks[rubroId] ?? 0) / rubroImpressions[rubroId] : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)

  const series = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({
      day,
      HOME_VIEW: counts['HOME_VIEW'] ?? 0,
      RECOMMENDATION_IMPRESSION: counts['RECOMMENDATION_IMPRESSION'] ?? 0,
      RECOMMENDATION_CLICK: counts['RECOMMENDATION_CLICK'] ?? 0,
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
      authenticatedHomeViews,
      anonymousHomeViews,
    },
    rates: {
      clickThroughRate: impressions ? clicks / impressions : 0,
      saveRate: clicks ? saves / clicks : 0,
    },
    funnel,
    rubros,
    series,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
