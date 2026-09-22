// SPIKE (spike/two-stage-hydration-recommendations) — no integrado.
// Ruta gemela de /api/promos/recommended para el harness de comparación:
// usa el two-stage hydration (getPromosLight.ts) en vez de getPromosData().
// No debe consumirse desde el frontend — es exclusiva del spike.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'
import { getLightRecommendationCandidates, hydrateFinalPromos } from '@/lib/getPromosLight'
import { rankForHome } from '@/lib/decisionEngine'
import { getNearbyBranchesByCommerce } from '@/lib/nearbyBranches'

export const dynamic = 'force-dynamic'

type Status = 'ok' | 'incomplete_profile' | 'no_location' | 'empty'

const NEARBY_RADIUS_KM = 5

function todayDayBit(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return 1 << argNow.getDay()
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const { searchParams } = new URL(req.url)
    const province = searchParams.get('province')
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null
    const guestProfileParam = searchParams.get('guest_profile')

    const token = await getAuthToken(req)
    const email = (token?.email as string | undefined) || req.headers.get('x-user-email')
    const role = token?.role as string | undefined
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR'

    const hasRealProfile = !!email || !!guestProfileParam
    if (!hasRealProfile) {
      return NextResponse.json({
        status: 'incomplete_profile' as Status,
        summary: null,
        recommendations: [],
        missingProfile: ['cards'],
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      })
    }

    const { promos: lightPromos, perf } = await getLightRecommendationCandidates({
      email,
      guestProfileParam,
      province,
      isAdmin,
    })

    if (!lightPromos.length) {
      return NextResponse.json({
        status: 'incomplete_profile' as Status,
        summary: null,
        recommendations: [],
        missingProfile: ['cards'],
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        perf,
      })
    }

    const hasLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng)

    let nearbyByCommerceId: Record<string, { count: number; minDistKm: number }> = {}
    if (hasLocation) {
      const nearby = await getNearbyBranchesByCommerce(lat as number, lng as number, NEARBY_RADIUS_KM)
      nearbyByCommerceId = Object.fromEntries(
        Object.entries(nearby).map(([id, v]) => [id, { count: v.count, minDistKm: v.minDistKm }])
      )
    }

    const decisionEngineStart = Date.now()
    const ranked = rankForHome(lightPromos, {
      hasLocation,
      nearbyByCommerceId,
      todayBit: todayDayBit(),
    })
    const decisionEngineMs = Date.now() - decisionEngineStart

    if (!ranked.length) {
      return NextResponse.json({
        status: 'empty' as Status,
        summary: null,
        recommendations: [],
        missingProfile: null,
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        perf: { ...perf, decisionEngineMs, finalHydrationMs: 0 },
      })
    }

    const top3Ids = ranked.map(r => r.promo.id)
    const finalHydrationStart = Date.now()
    const hydrated = await hydrateFinalPromos(top3Ids, province, isAdmin)
    const finalHydrationMs = Date.now() - finalHydrationStart

    const hydratedById = new Map(hydrated.map(h => [h.id, h]))
    const recommendations = ranked
      .map(r => {
        const full = hydratedById.get(r.promo.id)
        if (!full) return null
        return { promo: full, reasons: r.reasons }
      })
      .filter((r): r is NonNullable<typeof r> => !!r)

    const status: Status = !hasLocation ? 'no_location' : 'ok'

    return NextResponse.json({
      status,
      summary: null,
      recommendations,
      missingProfile: hasLocation ? null : ['location'],
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      perf: { ...perf, decisionEngineMs, finalHydrationMs, totalMs: Date.now() - startedAt },
    })
  } catch (error) {
    console.error('[GET /api/promos/recommended-light]', error)
    return NextResponse.json({ error: 'Error al obtener recomendaciones' }, { status: 500 })
  }
}
