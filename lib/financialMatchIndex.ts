// Financial Match Index — Variante B, ver financial-match-index.md.
// Mecanismo de background para poblar/invalidar financial_match_index.
// Nunca se llama desde el camino de un request HTTP — ver getPromos.ts para
// el consumo (lectura) del índice ya poblado.

import { prisma } from '@/lib/prisma'
import { matchesProfile, type UserCardLike, type RequirementLike } from '@/lib/matchesProfile'
import crypto from 'crypto'

const MODO_WALLET_ID = 'cmnulzh04000aqlkk8mnpzo46'

export function buildProfileSignature(cards: UserCardLike[]): string {
  const normalized = cards
    .map(c => `${c.bankId ?? ''}|${c.walletId ?? ''}|${c.cardNetworkId ?? ''}|${c.cardType ?? ''}|${c.cardSegmentId ?? ''}|${c.segmentId ?? ''}|${c.cardTier ?? ''}|${c.isPayroll ? 1 : 0}|${c.isPensioner ? 1 : 0}`)
    .sort()
    .join(';')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function cardsForProfile(profile: { cards: any[]; wallets: any[] }): UserCardLike[] {
  return [
    ...profile.cards.map(c => ({
      bankId: c.bankId ?? null, walletId: c.walletId ?? null, cardNetworkId: c.cardNetworkId ?? null,
      cardType: c.cardType ?? null, cardSegmentId: c.cardSegmentId ?? null, segmentId: c.segmentId ?? null,
      cardTier: c.cardTier ?? null, isPayroll: c.isPayroll, isPensioner: c.isPensioner,
    })),
    ...profile.wallets.filter((w: any) => w.walletId !== MODO_WALLET_ID).map((w: any) => ({
      bankId: null, walletId: w.walletId, cardNetworkId: null, cardType: 'ACCOUNT',
      cardSegmentId: null, segmentId: null, cardTier: null, isPayroll: false, isPensioner: false,
    })),
  ]
}

/**
 * Recalcula el índice completo desde cero: todos los perfiles x todos los
 * requirements activos. Costo medido en el spike: ~9s en el peor caso (Neon
 * fría), 32 perfiles x 67K requirements. Reemplaza el contenido de la tabla
 * en una transacción por perfil (delete + insert) para no dejar el índice
 * a medio poblar si el proceso se corta.
 */
export async function rebuildFullIndex(): Promise<{ profiles: number; rows: number }> {
  const [profiles, requirements] = await Promise.all([
    prisma.financialProfile.findMany({ include: { cards: true, wallets: true } }),
    prisma.promoRequirement.findMany({
      where: { promo: { status: 'ACTIVE' } },
      select: {
        id: true, promoId: true, bankId: true, walletId: true, cardNetworkId: true,
        cardType: true, cardTier: true, cardSegmentId: true, segmentId: true, accountType: true,
      },
    }),
  ])

  const tierToSegmentId = new Map<string, string>()
  const allSegments = await prisma.bankSegment.findMany({ select: { id: true, name: true } })
  for (const seg of allSegments) tierToSegmentId.set(seg.name.toUpperCase(), seg.id)

  let totalRows = 0

  for (const profile of profiles) {
    const userCards = cardsForProfile(profile)
    const signature = buildProfileSignature(userCards)

    const matchedPromoIds = new Set<string>()
    for (const req of requirements) {
      const reqLike: RequirementLike = {
        bankId: req.bankId, walletId: req.walletId, cardNetworkId: req.cardNetworkId,
        cardType: req.cardType, segmentId: req.segmentId, cardSegmentId: req.cardSegmentId,
        cardTier: req.cardTier, accountType: req.accountType,
      }
      if (matchesProfile(reqLike, userCards, tierToSegmentId)) {
        matchedPromoIds.add(req.promoId)
      }
    }

    await prisma.$transaction([
      prisma.financialMatchIndex.deleteMany({ where: { profileHash: signature } }),
      ...(matchedPromoIds.size
        ? [prisma.financialMatchIndex.createMany({
            data: Array.from(matchedPromoIds).map(promoId => ({ profileHash: signature, promoId })),
            skipDuplicates: true,
          })]
        : []),
    ])

    totalRows += matchedPromoIds.size
  }

  return { profiles: profiles.length, rows: totalRows }
}

/**
 * Invalidación incremental (§6 del documento de diseño): recalcula solo las
 * firmas de perfil cuyo banco/wallet intersecta con los requirements de las
 * promos tocadas (ej. por una corrida de scraper reciente).
 *
 * Nota de honestidad (spike, 19/8/2026): a 32 perfiles reales, este filtro
 * ahorró solo 3.1% de las evaluaciones frente a un rebuild total — no vale
 * como optimización real todavía, pero es correcto (nunca deja de invalidar
 * un perfil que sí puede verse afectado) y no cuesta más que la alternativa.
 * Se implementa igual porque no hay downside, no porque hoy ahorre trabajo.
 */
export async function invalidateForPromoIds(promoIds: string[]): Promise<{ profilesRecalculated: number; rows: number }> {
  if (!promoIds.length) return { profilesRecalculated: 0, rows: 0 }

  const touchedRequirements = await prisma.promoRequirement.findMany({
    where: { promoId: { in: promoIds } },
    select: { bankId: true, walletId: true },
  })
  const touchedBankIds = new Set(touchedRequirements.map(r => r.bankId).filter(Boolean) as string[])
  const touchedWalletIds = new Set(touchedRequirements.map(r => r.walletId).filter(Boolean) as string[])

  const [profiles, allActiveRequirements] = await Promise.all([
    prisma.financialProfile.findMany({ include: { cards: true, wallets: true } }),
    prisma.promoRequirement.findMany({
      where: { promo: { status: 'ACTIVE' } },
      select: {
        id: true, promoId: true, bankId: true, walletId: true, cardNetworkId: true,
        cardType: true, cardTier: true, cardSegmentId: true, segmentId: true, accountType: true,
      },
    }),
  ])

  const tierToSegmentId = new Map<string, string>()
  const allSegments = await prisma.bankSegment.findMany({ select: { id: true, name: true } })
  for (const seg of allSegments) tierToSegmentId.set(seg.name.toUpperCase(), seg.id)

  let recalculated = 0
  let totalRows = 0

  for (const profile of profiles) {
    const userCards = cardsForProfile(profile)
    const profileBankIds = new Set(userCards.map(c => c.bankId).filter(Boolean) as string[])
    const profileWalletIds = new Set(userCards.map(c => c.walletId).filter(Boolean) as string[])

    const isAffected =
      [...touchedBankIds].some(id => profileBankIds.has(id)) ||
      [...touchedWalletIds].some(id => profileWalletIds.has(id))
    if (!isAffected) continue

    const signature = buildProfileSignature(userCards)
    const matchedPromoIds = new Set<string>()
    for (const req of allActiveRequirements) {
      const reqLike: RequirementLike = {
        bankId: req.bankId, walletId: req.walletId, cardNetworkId: req.cardNetworkId,
        cardType: req.cardType, segmentId: req.segmentId, cardSegmentId: req.cardSegmentId,
        cardTier: req.cardTier, accountType: req.accountType,
      }
      if (matchesProfile(reqLike, userCards, tierToSegmentId)) {
        matchedPromoIds.add(req.promoId)
      }
    }

    await prisma.$transaction([
      prisma.financialMatchIndex.deleteMany({ where: { profileHash: signature } }),
      ...(matchedPromoIds.size
        ? [prisma.financialMatchIndex.createMany({
            data: Array.from(matchedPromoIds).map(promoId => ({ profileHash: signature, promoId })),
            skipDuplicates: true,
          })]
        : []),
    ])

    recalculated++
    totalRows += matchedPromoIds.size
  }

  return { profilesRecalculated: recalculated, rows: totalRows }
}
