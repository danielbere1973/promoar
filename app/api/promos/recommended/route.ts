import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAuthToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPromosData } from '@/lib/getPromos'
import { rankForHome } from '@/lib/decisionEngine'
import { getNearbyBranchesByCommerce } from '@/lib/nearbyBranches'
import { getStoredSnapshot, recalculateSnapshot, resolveTop3FromCandidates } from '@/lib/recommendationSnapshot'

export const dynamic = 'force-dynamic'

type Status = 'ok' | 'incomplete_profile' | 'no_location' | 'empty'

// Radio de búsqueda de sucursales cercanas para el factor "cercanía" — mismo
// orden de magnitud que el default de /api/branches/nearby (5km).
const NEARBY_RADIUS_KM = 5

function todayDayBit(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return 1 << argNow.getDay()
}

async function getHasLocationNearby(lat: number | null, lng: number | null) {
  const hasLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng)
  let nearbyByCommerceId: Record<string, { count: number; minDistKm: number }> = {}
  if (hasLocation) {
    const nearby = await getNearbyBranchesByCommerce(lat as number, lng as number, NEARBY_RADIUS_KM)
    nearbyByCommerceId = Object.fromEntries(
      Object.entries(nearby).map(([id, v]) => [id, { count: v.count, minDistKm: v.minDistKm }])
    )
  }
  return { hasLocation, nearbyByCommerceId }
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

    // Recommendation Snapshot v1 solo aplica a usuarios con cuenta (userId
    // persistido) — el camino guest_profile (perfil armado en el momento, sin
    // login) no tiene snapshot posible, sigue corriendo el pipeline directo
    // como antes de esta feature.
    const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null

    if (!user) {
      const result = await getPromosData(
        {
          forMe: true,
          view: 'week',
          province: province ?? undefined,
          guestProfileParam,
          paginate: false,
          useCandidateQuery: true,
        },
        email,
        isAdmin,
      )
      const promos = (result as any).promos ?? []

      if (!promos.length) {
        return NextResponse.json({
          status: 'incomplete_profile' as Status,
          summary: null,
          recommendations: [],
          missingProfile: ['cards'],
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
        })
      }

      const { hasLocation, nearbyByCommerceId } = await getHasLocationNearby(lat, lng)
      const ranked = rankForHome(promos, { hasLocation, nearbyByCommerceId, todayBit: todayDayBit() })

      if (!ranked.length) {
        return NextResponse.json({
          status: 'empty' as Status,
          summary: null,
          recommendations: [],
          missingProfile: null,
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
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
      })
    }

    // ── Usuario con cuenta: stale-while-revalidate sobre el snapshot ──
    let stored = await getStoredSnapshot(user.id)

    // Primer acceso — no hay snapshot todavía. Única vez que este endpoint
    // corre el pipeline pesado de forma síncrona (getPromosData completo).
    if (!stored) {
      const fresh = await recalculateSnapshot(user.id)
      stored = {
        status: fresh.status,
        candidates: fresh.candidates,
        profileHash: fresh.profileHash,
        catalogVersion: fresh.catalogVersion,
        generatedAt: new Date(),
        isStale: false,
      }
    } else if (stored.isStale) {
      // Snapshot existente pero desactualizado (perfil o catálogo cambiaron):
      // se sirve tal cual está ahora, y se dispara el recálculo en background
      // sin bloquear esta respuesta — garantizado por waitUntil() incluso si
      // el runtime serverless corta el proceso apenas se envía el Response.
      waitUntil(
        recalculateSnapshot(user.id).catch(error => {
          console.error('[GET /api/promos/recommended] recalculateSnapshot (stale refresh) falló', error)
        })
      )
    }

    if (stored.status !== 'ok' || !stored.candidates.length) {
      return NextResponse.json({
        status: 'incomplete_profile' as Status,
        summary: null,
        recommendations: [],
        missingProfile: ['cards'],
        generatedAt: stored.generatedAt.toISOString(),
        latencyMs: Date.now() - startedAt,
      })
    }

    const { hasLocation, nearbyByCommerceId } = await getHasLocationNearby(lat, lng)

    const ranked = resolveTop3FromCandidates(stored.candidates, {
      hasLocation,
      nearbyByCommerceId,
      todayBit: todayDayBit(),
    })

    if (!ranked.length) {
      return NextResponse.json({
        status: 'empty' as Status,
        summary: null,
        recommendations: [],
        missingProfile: null,
        generatedAt: stored.generatedAt.toISOString(),
        latencyMs: Date.now() - startedAt,
      })
    }

    const status: Status = !hasLocation ? 'no_location' : 'ok'

    return NextResponse.json({
      status,
      summary: null,
      recommendations: ranked.map(r => ({ promo: r.promo, reasons: r.reasons })),
      missingProfile: hasLocation ? null : ['location'],
      generatedAt: stored.generatedAt.toISOString(),
      latencyMs: Date.now() - startedAt,
      snapshotStale: stored.isStale,
    })
  } catch (error) {
    console.error('[GET /api/promos/recommended]', error)
    return NextResponse.json({ error: 'Error al obtener recomendaciones' }, { status: 500 })
  }
}
