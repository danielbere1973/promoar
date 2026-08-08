import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'
import { getPromosData } from '@/lib/getPromos'
import { rankForHome } from '@/lib/decisionEngine'
import { getNearbyBranchesByCommerce } from '@/lib/nearbyBranches'

export const dynamic = 'force-dynamic'

type Status = 'ok' | 'incomplete_profile' | 'no_location' | 'empty'

// Radio de búsqueda de sucursales cercanas para el factor "cercanía" — mismo
// orden de magnitud que el default de /api/branches/nearby (5km).
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

    const result = await getPromosData(
      {
        forMe: true,
        view: 'week', // gate de vigencia lo re-aplica el decisionEngine para "hoy"
        province: province ?? undefined,
        guestProfileParam,
        paginate: false,
        useCandidateQuery: true, // DR-003/DR-004: candidate selection en SQL
      },
      email,
      isAdmin,
    )

    const promos = (result as any).promos ?? []
    const perf = (result as any).perf ?? null

    if (!promos.length) {
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
    const ranked = rankForHome(promos, {
      hasLocation,
      nearbyByCommerceId,
      todayBit: todayDayBit(),
    })
    if (perf) perf.decisionEngineMs = Date.now() - decisionEngineStart

    if (!ranked.length) {
      return NextResponse.json({
        status: 'empty' as Status,
        summary: null,
        recommendations: [],
        missingProfile: null,
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        perf,
      })
    }

    const status: Status = !hasLocation ? 'no_location' : 'ok'

    return NextResponse.json({
      status,
      summary: null,
      recommendations: ranked.map(r => ({ promo: r.promo, reasons: r.reasons })),
      missingProfile: hasLocation ? null : ['location'],
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      perf,
    })
  } catch (error) {
    console.error('[GET /api/promos/recommended]', error)
    return NextResponse.json({ error: 'Error al obtener recomendaciones' }, { status: 500 })
  }
}
