// Recommendation Snapshot v1 — único lugar que llama a getPromosData +
// scoreCandidates/selectTop3WithReasons para este flujo. No duplica lógica
// financiera ni de ranking: reutiliza tal cual getPromosData (candidate
// selection + matchesProfile) y decisionEngine.ts (scoring + diversidad +
// reasons), ambos congelados fuera de esta feature.
//
// Diseño (CPO, 9/8/2026): el snapshot persiste el Top-20 scoreado sin
// cercanía (hasLocation:false) — no el Top-3 final. La ubicación es una señal
// dinámica del request (llega del browser), no un atributo del perfil, así
// que nunca se persiste. El Top-3 final (con o sin cercanía) se resuelve
// siempre en el momento de leer el snapshot, vía selectTop3WithReasons sobre
// esas 20 candidatas — nunca se vuelve a tocar getPromosData ni el catálogo
// completo para eso.
//
// Refactor habilitante en decisionEngine.ts (CPO, 9/8/2026, ver
// propuesta-refactor-decisionengine.md): rankForHome se separó en
// scoreCandidates() + selectTop3WithReasons(), comportamiento idéntico,
// ahora reutilizables por separado.
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { getPromosData } from '@/lib/getPromos'
import { scoreCandidates, selectTop3WithReasons, DecisionContext, RankedRecommendation } from '@/lib/decisionEngine'
import { CATALOG_VERSION_KEY } from '@/lib/cache/promosCache'

export const SNAPSHOT_CANDIDATE_COUNT = 20

export type SnapshotStatus = 'ok' | 'incomplete_profile' | 'empty'

export interface SnapshotResult {
  status: SnapshotStatus
  /** Top-20 candidatas ya scoreadas sin cercanía, objetos promo completos — sin reasons ni diversidad (eso se resuelve al leer). */
  candidates: any[]
  profileHash: string
  catalogVersion: string
}

function todayDayBit(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return 1 << argNow.getDay()
}

/**
 * Hash estable del perfil financiero (bancos+wallets+tarjetas) — se usa para
 * detectar si el snapshot quedó desactualizado respecto al perfil actual del
 * usuario, sin tener que comparar objeto por objeto.
 */
export function computeProfileHash(profile: {
  banks: { bankId: string }[]
  wallets: { walletId: string }[]
  cards: { bankId: string | null; cardNetworkId: string | null; cardSegmentId: string | null; walletId: string | null }[]
} | null): string {
  if (!profile) return 'no-profile'
  const banks = profile.banks.map(b => b.bankId).sort()
  const wallets = profile.wallets.map(w => w.walletId).sort()
  const cards = profile.cards
    .map(c => `${c.bankId ?? ''}|${c.cardNetworkId ?? ''}|${c.cardSegmentId ?? ''}|${c.walletId ?? ''}`)
    .sort()
  const raw = JSON.stringify({ banks, wallets, cards })
  return createHash('sha256').update(raw).digest('hex')
}

export async function getCurrentCatalogVersion(): Promise<string> {
  const config = await prisma.siteConfig.findUnique({ where: { key: CATALOG_VERSION_KEY } })
  return config?.value ?? '0'
}

async function getFinancialProfileForHash(userId: string) {
  return prisma.financialProfile.findUnique({
    where: { userId },
    select: {
      banks: { select: { bankId: true } },
      wallets: { select: { walletId: true } },
      cards: { select: { bankId: true, cardNetworkId: true, cardSegmentId: true, walletId: true } },
    },
  })
}

/**
 * Corre el pipeline completo (getPromosData + scoreCandidates sin cercanía) y
 * escribe/actualiza la fila de RecommendationSnapshot del usuario. No recibe
 * lat/lng — la cercanía es una señal dinámica del request, no del perfil.
 */
export async function recalculateSnapshot(userId: string): Promise<SnapshotResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) {
    throw new Error(`recalculateSnapshot: usuario ${userId} no encontrado`)
  }

  const profile = await getFinancialProfileForHash(userId)
  const profileHash = computeProfileHash(profile)
  const catalogVersion = await getCurrentCatalogVersion()

  let result: SnapshotResult

  if (!profile || (!profile.banks.length && !profile.wallets.length && !profile.cards.length)) {
    result = { status: 'incomplete_profile', candidates: [], profileHash, catalogVersion }
  } else {
    const data = await getPromosData(
      {
        forMe: true,
        view: 'week',
        paginate: false,
        useCandidateQuery: true,
      } as any,
      user.email,
      false,
    )
    const promos = (data as any).promos ?? []

    if (!promos.length) {
      result = { status: 'incomplete_profile', candidates: [], profileHash, catalogVersion }
    } else {
      const scored = scoreCandidates(promos, {
        hasLocation: false,
        nearbyByCommerceId: {},
        todayBit: todayDayBit(),
      })

      if (!scored.length) {
        result = { status: 'empty', candidates: [], profileHash, catalogVersion }
      } else {
        const top20 = [...scored].sort((a, b) => b.score - a.score).slice(0, SNAPSHOT_CANDIDATE_COUNT)
        result = {
          status: 'ok',
          candidates: top20.map(s => s.promo),
          profileHash,
          catalogVersion,
        }
      }
    }
  }

  await prisma.recommendationSnapshot.upsert({
    where: { userId },
    update: {
      status: result.status,
      recommendations: result.candidates as any,
      profileHash: result.profileHash,
      catalogVersion: result.catalogVersion,
      // @default(now()) del schema solo aplica en el create — sin esto,
      // generatedAt queda pegado a la fecha del primer snapshot para siempre
      // aunque el contenido se refresque en corridas posteriores.
      generatedAt: new Date(),
    },
    create: {
      userId,
      status: result.status,
      recommendations: result.candidates as any,
      profileHash: result.profileHash,
      catalogVersion: result.catalogVersion,
    },
  })

  return result
}

export interface StoredSnapshot {
  status: SnapshotStatus
  candidates: any[]
  profileHash: string
  catalogVersion: string
  generatedAt: Date
  isStale: boolean
}

/**
 * Lee el snapshot existente sin recalcular. Devuelve null si el usuario nunca
 * tuvo uno (primer acceso — el caller debe correr recalculateSnapshot en ese
 * caso, de forma síncrona, única vez). Marca isStale si profileHash o
 * catalogVersion no matchean el estado actual, para que el caller decida si
 * dispara un refresh en background.
 */
export async function getStoredSnapshot(userId: string): Promise<StoredSnapshot | null> {
  const snapshot = await prisma.recommendationSnapshot.findUnique({ where: { userId } })
  if (!snapshot) return null

  const [profile, catalogVersion] = await Promise.all([
    getFinancialProfileForHash(userId),
    getCurrentCatalogVersion(),
  ])
  const currentProfileHash = computeProfileHash(profile)

  const isStale = snapshot.profileHash !== currentProfileHash || snapshot.catalogVersion !== catalogVersion

  return {
    status: snapshot.status as SnapshotStatus,
    candidates: snapshot.recommendations as any,
    profileHash: snapshot.profileHash,
    catalogVersion: snapshot.catalogVersion,
    generatedAt: snapshot.generatedAt,
    isStale,
  }
}

/**
 * Resuelve el Top-3 final con reasons a partir de un conjunto de candidatas
 * ya persistidas (snapshot.candidates), aplicando el contexto real del
 * request (cercanía si hay lat/lng, día actual). No vuelve a tocar
 * getPromosData — corre scoreCandidates + selectTop3WithReasons sobre un
 * universo chico (Top-20), barato incluso re-scoreando todo.
 */
export function resolveTop3FromCandidates(candidates: any[], context: DecisionContext): RankedRecommendation[] {
  const rescored = scoreCandidates(candidates, context)
  return selectTop3WithReasons(rescored, context)
}
