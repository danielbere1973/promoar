import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthToken } from '@/lib/auth'
import { getPromosData } from '@/lib/getPromos'
import { buildHomeDecisionPayload, type DecisionContext, type NearbyMap } from '@/lib/decisionEngineV2'
import { getNearbyBranchesByCommerce } from '@/lib/nearbyBranches'
import { getDeclaredActivePreferences, getActiveHomeRubroIds, resolveDeclaredUniverse } from '@/lib/rubroPreferences'
import { RUBRO_CATALOG } from '@/lib/rubroCatalog'
import type { HomeDecisionPayload } from '@/lib/homeDecisionContract'

export const dynamic = 'force-dynamic'

// Endpoint real para la Home v2 por rubros (RFC-008 + CPO Direction
// "Integración Home + Decision Engine v2", 12/8/2026). Reusa exactamente el
// mismo patrón de auth/ubicación/fetch de promos que /api/promos/recommended
// (v1) — la diferencia es que acá se llama a buildHomeDecisionPayload (v2,
// por rubros) en lugar de rankForHome (v1, Top-3 plano).
//
// Cache — CPO Approval "Tus rubros" (16/8/2026, tercera/cuarta ronda), ajustado
// por CPO decisión 17/8/2026: usa HomeDecisionSnapshot (Postgres, no memoria de
// proceso — necesario porque Vercel no garantiza reuso de instancia serverless
// entre requests) con 5 llaves de vigencia independientes: operationalDay,
// declaredUniverseHash, decisionContextHash, proximityContextHash,
// promoPoolVersion. Solo aplica a usuarios autenticados (requiere userId) —
// guests siempre recalculan, sin pasar por este cache.
const NEARBY_RADIUS_KM = 5

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function todayDayBit(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return 1 << argNow.getDay()
}

function currentOperationalDay(): string {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return argNow.toISOString().slice(0, 10)
}

async function getHasLocationNearby(lat: number | null, lng: number | null) {
  const hasLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng)
  let nearbyByCommerceId: NearbyMap = {}
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

// ─── Hashing — CPO Approval "Tus rubros" (16/8/2026, segunda/tercera/cuarta
// ronda). Viven acá (no en lib/) porque route.ts es el único consumidor —
// spec §2/§3 deja la ubicación abierta "a decidir por convención al
// implementar"; cada colección se ordena antes de serializar para que el
// resultado no dependa del orden de lectura de Prisma.

function computeDeclaredUniverseHash(rows: { rubroId: string; updatedAt: Date }[]): string {
  const canonical = rows
    .map(r => `${r.rubroId}:${r.updatedAt.toISOString()}`)
    .sort()
    .join('|')
  return sha256(canonical)
}

// CPO decisión 17/8/2026: incluye count además de minDistKm — un cambio en la
// cantidad de sucursales cercanas (sin que la más cercana cambie) es un cambio
// relevante en el contexto de cercanía y antes no invalidaba el snapshot.
export function computeProximityContextHash(nearbyByCommerceId: NearbyMap): string {
  const entries = Object.entries(nearbyByCommerceId)
  if (entries.length === 0) return 'no-proximity-context'
  const canonical = entries
    .map(([commerceId, v]) => `${commerceId}:${v.minDistKm}:${v.count}`)
    .sort()
    .join('|')
  return sha256(canonical)
}

function computeDecisionContextHash(input: {
  effectiveCards: { bankId?: string | null; walletId?: string | null; cardNetworkId?: string | null; cardSegmentId?: string | null }[] | null
  favoritedPromoIds: string[]
  declaredCategorySlugs: string[] | undefined
}): string {
  const canonical = JSON.stringify({
    cards: [...(input.effectiveCards ?? [])]
      .map(c => `${c.bankId ?? ''}:${c.walletId ?? ''}:${c.cardNetworkId ?? ''}:${c.cardSegmentId ?? ''}`)
      .sort(),
    favorites: [...input.favoritedPromoIds].sort(),
    afinidad: [...(input.declaredCategorySlugs ?? [])].sort(),
  })
  return sha256(canonical)
}

// promoPoolVersion — granularidad elegida al implementar (spec §2 lo deja
// abierto, "a confirmar con evidencia real"): MAX(updatedAt) sobre promos
// ACTIVE en las categorías cubiertas por RUBRO_CATALOG (universo relevante
// para cualquier declaredUniverse posible), más el conteo — cambia tanto si
// una promo existente se edita como si el pool crece/se achica.
async function currentPromoPoolVersion(): Promise<string> {
  const categorySlugs = Array.from(new Set(RUBRO_CATALOG.flatMap(r => r.categorySlugs)))
  const where = { status: 'ACTIVE' as const, category: { slug: { in: categorySlugs } } }
  const [agg, count] = await Promise.all([
    prisma.promo.aggregate({ where, _max: { updatedAt: true } }),
    prisma.promo.count({ where }),
  ])
  return `${agg._max.updatedAt?.toISOString() ?? 'none'}:${count}`
}

async function getEffectiveCards(userId: string) {
  const profile = await prisma.financialProfile.findUnique({
    where: { userId },
    include: { banks: true, wallets: true, cards: true },
  })
  if (!profile) return []
  const cards = profile.cards.map(c => ({
    bankId: c.bankId,
    walletId: c.walletId,
    cardNetworkId: c.cardNetworkId,
    cardSegmentId: c.cardSegmentId,
  }))
  const banksOnly = profile.banks.map(b => ({ bankId: b.bankId, walletId: null, cardNetworkId: null, cardSegmentId: null }))
  const walletsOnly = profile.wallets.map(w => ({ bankId: null, walletId: w.walletId, cardNetworkId: null, cardSegmentId: null }))
  return [...cards, ...banksOnly, ...walletsOnly]
}

// Extraído para reuso desde el batch warm job (Prioridad 2, Parte A —
// cpo-a-cto-dictamen-arquitectura-snapshot-async-25-8-2026.md). Recalcula las
// 5 claves de vigencia + snapshot para un usuario puntual; devuelve si hubo
// hit o si se recalculó. Sin `req`/`searchParams` porque el warm job no tiene
// contexto de proximidad de un visitante real — usa `FinancialProfile.lastKnownLat/Lng`
// (Prioridad 2 Parte B — cpo-a-cto-dictamen-proximity-hash-y-last-known-coords-25-8-2026.md)
// cuando existe, para calentar con el mismo proximityContextHash que va a pedir
// el cliente real. Si el usuario nunca mandó coordenadas, cae a
// 'no-proximity-context' como antes.
export async function warmSnapshotForUser(userId: string, email: string, isAdmin: boolean): Promise<{ userId: string; action: 'hit' | 'recomputed' | 'error'; latencyMs: number }> {
  const startedAt = Date.now()
  try {
    const [declaredRows, activeRubroIds, financialProfile] = await Promise.all([
      prisma.userRubroPreference.findMany({
        where: { userId, source: 'DECLARED', status: 'ACTIVE' },
        select: { rubroId: true, updatedAt: true },
      }),
      getActiveHomeRubroIds(),
      prisma.financialProfile.findUnique({ where: { userId }, select: { lastKnownLat: true, lastKnownLng: true } }),
    ])
    const declaredUniverse = resolveDeclaredUniverse(declaredRows, activeRubroIds)
    const declaredUniverseHash = computeDeclaredUniverseHash(declaredRows)
    const { hasLocation, nearbyByCommerceId } = await getHasLocationNearby(
      financialProfile?.lastKnownLat ?? null,
      financialProfile?.lastKnownLng ?? null
    )
    const proximityContextHash = computeProximityContextHash(nearbyByCommerceId)
    const operationalDay = currentOperationalDay()

    const [snapshot, decisionContextHash, promoPoolVersion] = await Promise.all([
      prisma.homeDecisionSnapshot.findUnique({ where: { userId } }),
      (async () => {
        const [effectiveCards, savedPromos] = await Promise.all([
          getEffectiveCards(userId),
          prisma.savedPromo.findMany({ where: { userId }, select: { promoId: true } }),
        ])
        return computeDecisionContextHash({
          effectiveCards,
          favoritedPromoIds: savedPromos.map(sp => sp.promoId),
          declaredCategorySlugs: undefined,
        })
      })(),
      currentPromoPoolVersion(),
    ])

    const vigente =
      !!snapshot &&
      snapshot.operationalDay === operationalDay &&
      snapshot.declaredUniverseHash === declaredUniverseHash &&
      snapshot.decisionContextHash === decisionContextHash &&
      snapshot.proximityContextHash === proximityContextHash &&
      snapshot.promoPoolVersion === promoPoolVersion

    if (vigente) {
      return { userId, action: 'hit', latencyMs: Date.now() - startedAt }
    }

    const payload = await buildPayloadForUser(email, isAdmin, null, declaredUniverse, {
      hasLocation,
      nearbyByCommerceId,
    })

    await prisma.homeDecisionSnapshot.upsert({
      where: { userId },
      create: { userId, payload: payload as any, operationalDay, declaredUniverseHash, decisionContextHash, proximityContextHash, promoPoolVersion },
      update: { payload: payload as any, operationalDay, declaredUniverseHash, decisionContextHash, proximityContextHash, promoPoolVersion },
    })

    return { userId, action: 'recomputed', latencyMs: Date.now() - startedAt }
  } catch (error) {
    console.error(`[warmSnapshotForUser] userId=${userId}`, error)
    return { userId, action: 'error', latencyMs: Date.now() - startedAt }
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

    // Identidad SOLO desde el JWT de sesión verificado — a diferencia de
    // otros endpoints del proyecto (ej. /api/promos), acá NO se acepta el
    // fallback a header `x-user-email` enviado por el cliente. Ese header lo
    // setea PromosClient.tsx en el browser a partir de la sesión que el
    // propio cliente lee (ver app/promos/PromosClient.tsx) — no hay nada del
    // lado servidor que lo valide, así que un request sin cookie de sesión
    // puede declarar cualquier email y el server confiaría en él. Esa brecha
    // ya existe en /api/promos/route.ts (pre-existente, fuera de alcance de
    // esta rama), pero este endpoint es nuevo: no hay motivo para heredarla
    // acá cuando lo único que cambia es leer `token.email` en vez de aceptar
    // también el header. CPO Final Gate — Seguridad endpoint antes de push.
    const token = await getAuthToken(req)
    const email = (token?.email as string | undefined) || null
    const role = token?.role as string | undefined
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR'

    const hasRealProfile = !!email || !!guestProfileParam
    if (!hasRealProfile) {
      return NextResponse.json(incompleteProfilePayload(['cards']))
    }

    // Resolución de identidad + universo declarado — antes de fetchear
    // promos, porque un userId habilita el path de cache (HomeDecisionSnapshot).
    const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null

    const [declaredRows, activeRubroIds] = await Promise.all([
      user
        ? prisma.userRubroPreference.findMany({
            where: { userId: user.id, source: 'DECLARED', status: 'ACTIVE' },
            select: { rubroId: true, updatedAt: true },
          })
        : Promise.resolve([]),
      getActiveHomeRubroIds(),
    ])
    const declaredUniverse = resolveDeclaredUniverse(declaredRows, activeRubroIds)
    const declaredUniverseHash = computeDeclaredUniverseHash(declaredRows)

    const { hasLocation, nearbyByCommerceId } = await getHasLocationNearby(lat, lng)
    const proximityContextHash = computeProximityContextHash(nearbyByCommerceId)

    // Persistencia oportunista de la última coordenada conocida — Prioridad 2
    // Parte B (cpo-a-cto-dictamen-proximity-hash-y-last-known-coords-25-8-2026.md).
    // Fire-and-forget, no bloquea la respuesta: alimenta a warmSnapshotForUser en
    // el próximo ciclo del warm job para que precaliente con proximityContextHash
    // real en vez de 'no-proximity-context'. Solo para usuarios con sesión —
    // no hay FinancialProfile de guest donde guardar esto.
    if (user && hasLocation) {
      // updateMany en vez de update: no todos los usuarios con sesión tienen
      // FinancialProfile creado (recién se crea al cargar tarjetas en /perfil).
      // No-op silencioso si no existe, en vez de lanzar P2025.
      prisma.financialProfile
        .updateMany({ where: { userId: user.id }, data: { lastKnownLat: lat, lastKnownLng: lng } })
        .catch(err => console.error(`[home-decision] lastKnownCoords persist failed userId=${user.id}`, err))
    }

    const operationalDay = currentOperationalDay()

    // Cache — solo para usuarios autenticados (requiere userId). Guests
    // (guest_profile sin email) siempre recalculan.
    if (user) {
      const [snapshot, decisionContextHash, promoPoolVersion] = await Promise.all([
        prisma.homeDecisionSnapshot.findUnique({ where: { userId: user.id } }),
        (async () => {
          const [effectiveCards, savedPromos] = await Promise.all([
            getEffectiveCards(user.id),
            prisma.savedPromo.findMany({ where: { userId: user.id }, select: { promoId: true } }),
          ])
          return computeDecisionContextHash({
            effectiveCards,
            favoritedPromoIds: savedPromos.map(sp => sp.promoId),
            declaredCategorySlugs: undefined,
          })
        })(),
        currentPromoPoolVersion(),
      ])

      const vigente =
        !!snapshot &&
        snapshot.operationalDay === operationalDay &&
        snapshot.declaredUniverseHash === declaredUniverseHash &&
        snapshot.decisionContextHash === decisionContextHash &&
        snapshot.proximityContextHash === proximityContextHash &&
        snapshot.promoPoolVersion === promoPoolVersion

      if (vigente) {
        const payload = snapshot!.payload as unknown as HomeDecisionPayload
        const latencyMs = Date.now() - startedAt
        console.log(`[home-decision] cacheStatus=hit latencyMs=${latencyMs} userId=${user.id}`)
        return NextResponse.json({ ...payload, latencyMs, cacheStatus: 'hit' })
      }

      const payload = await buildPayloadForUser(email!, isAdmin, province, declaredUniverse, {
        hasLocation,
        nearbyByCommerceId,
      })

      await prisma.homeDecisionSnapshot.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          payload: payload as any,
          operationalDay,
          declaredUniverseHash,
          decisionContextHash,
          proximityContextHash,
          promoPoolVersion,
        },
        update: {
          payload: payload as any,
          operationalDay,
          declaredUniverseHash,
          decisionContextHash,
          proximityContextHash,
          promoPoolVersion,
        },
      })

      const latencyMs = Date.now() - startedAt
      console.log(`[home-decision] cacheStatus=miss latencyMs=${latencyMs} userId=${user.id}`)
      return NextResponse.json({ ...payload, latencyMs, cacheStatus: 'miss' })
    }

    // Guest (guest_profile sin sesión) — sin userId, sin cache, sin universo declarado.
    const payload = await buildPayloadForUser(email, isAdmin, province, declaredUniverse, {
      hasLocation,
      nearbyByCommerceId,
    }, guestProfileParam)

    const latencyMs = Date.now() - startedAt
    console.log(`[home-decision] cacheStatus=guest-miss latencyMs=${latencyMs} hasGuestProfile=${!!guestProfileParam}`)
    return NextResponse.json({ ...payload, latencyMs, cacheStatus: 'guest-miss' })
  } catch (error) {
    console.error('[GET /api/promos/home-decision]', error)
    return NextResponse.json({ error: 'Error al obtener recomendaciones por rubro' }, { status: 500 })
  }
}

async function buildPayloadForUser(
  email: string | null,
  isAdmin: boolean,
  province: string | null,
  declaredUniverse: ReturnType<typeof resolveDeclaredUniverse>,
  location: { hasLocation: boolean; nearbyByCommerceId: NearbyMap },
  guestProfileParam?: string | null
): Promise<HomeDecisionPayload> {
  const result = await getPromosData(
    {
      forMe: true,
      view: 'week',
      province: province ?? undefined,
      guestProfileParam: guestProfileParam ?? undefined,
      paginate: false,
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
    return incompleteProfilePayload(['cards'])
  }

  const ctx: DecisionContext = { ...location, todayBit: todayDayBit() }
  const payload = buildHomeDecisionPayload(promos, ctx, undefined, { hasProfile: true }, declaredUniverse)

  return {
    ...payload,
    status: !location.hasLocation && payload.status === 'all_empty' ? 'no_location' : payload.status,
  }
}
