import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthToken } from '@/lib/auth'
import { getPromosData } from '@/lib/getPromos'
import { buildHomeDecisionPayload, type DecisionContext } from '@/lib/decisionEngineV2'
import { getNearbyBranchesByCommerce } from '@/lib/nearbyBranches'
import { getDeclaredActivePreferences, getActiveHomeRubroIds, selectRubrosForHome, type RubroSelection } from '@/lib/rubroPreferences'
import type { HomeDecisionPayload } from '@/lib/homeDecisionContract'

export const dynamic = 'force-dynamic'

// Endpoint real para la Home v2 por rubros (RFC-008 + CPO Direction
// "Integración Home + Decision Engine v2", 12/8/2026). Reusa exactamente el
// mismo patrón de auth/ubicación/fetch de promos que /api/promos/recommended
// (v1) — la diferencia es que acá se llama a buildHomeDecisionPayload (v2,
// por rubros) en lugar de rankForHome (v1, Top-3 plano). Sin snapshot todavía:
// el snapshot de /api/promos/recommended es una optimización propia de v1
// (stale-while-revalidate sobre RankedRecommendation[]) que no está definida
// para HomeDecisionPayload — queda fuera de esta etapa (RFC-008 §4).
const NEARBY_RADIUS_KM = 5

function todayDayBit(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return 1 << argNow.getDay()
}

async function getHasLocationNearby(lat: number | null, lng: number | null) {
  const hasLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng)
  let nearbyByCommerceId: DecisionContext['nearbyByCommerceId'] = {}
  if (hasLocation) {
    const nearby = await getNearbyBranchesByCommerce(lat as number, lng as number, NEARBY_RADIUS_KM)
    nearbyByCommerceId = Object.fromEntries(
      Object.entries(nearby).map(([id, v]) => [id, { count: v.count, minDistKm: v.minDistKm }])
    )
  }
  return { hasLocation, nearbyByCommerceId }
}

function incompleteProfilePayload(missingProfile: string[]): HomeDecisionPayload {
  return {
    status: 'incomplete_profile',
    rubros: [],
    missingProfile,
    generatedAt: new Date().toISOString(),
    latencyMs: 0,
    engineVersion: 'decision-engine-v2.0.0',
  }
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
      return NextResponse.json(incompleteProfilePayload(['cards']))
    }

    const result = await getPromosData(
      {
        forMe: true,
        view: 'week',
        province: province ?? undefined,
        guestProfileParam,
        paginate: false,
        useCandidateQuery: true,
        // Home v2 evalúa siempre como experiencia de usuario final: el rol
        // ADMIN/MODERATOR sigue existiendo (permisos, backoffice), pero acá
        // no debe apagar el matching financiero personal — ver comentario en
        // PromoQueryParams.forceProfileMatching (lib/getPromos.ts).
        forceProfileMatching: true,
      },
      email,
      isAdmin,
    )
    const promos = (result as any).promos ?? []

    if (!promos.length) {
      return NextResponse.json(incompleteProfilePayload(['cards']))
    }

    const { hasLocation, nearbyByCommerceId } = await getHasLocationNearby(lat, lng)

    const ctx: DecisionContext = { hasLocation, nearbyByCommerceId, todayBit: todayDayBit() }

    // Selección personalizada de rubros — CPO Approval "Preferencias →
    // selección personalizada de rubros v2" (15/8/2026). Guests (sin email,
    // solo guest_profile) no tienen userId para leer preferencias declaradas
    // — caen al catálogo default filtrado por activos, mismo comportamiento
    // que un usuario logueado sin preferencias.
    let rubroSelection: RubroSelection[]
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      const [declared, activeRubroIds] = await Promise.all([
        user ? getDeclaredActivePreferences(user.id) : Promise.resolve([]),
        getActiveHomeRubroIds(),
      ])
      rubroSelection = selectRubrosForHome(declared, activeRubroIds)
    } else {
      const activeRubroIds = await getActiveHomeRubroIds()
      rubroSelection = selectRubrosForHome([], activeRubroIds)
    }

    const payload = buildHomeDecisionPayload(promos, ctx, undefined, { hasProfile: true }, rubroSelection)

    return NextResponse.json({
      ...payload,
      status: !hasLocation && payload.status === 'all_empty' ? 'no_location' : payload.status,
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[GET /api/promos/home-decision]', error)
    return NextResponse.json({ error: 'Error al obtener recomendaciones por rubro' }, { status: 500 })
  }
}
