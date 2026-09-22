// Fuente de verdad única del matching financiero perfil↔promoción.
// Extraído de lib/getPromos.ts (antes duplicado en dos lugares: el filtro de
// "Mis promos" y el cálculo de userBestDiscount — ese segundo lugar tenía un
// drift real, le faltaba el chequeo de cardTier en la rama banco+wallet).
// Usado por: el request path de getPromos.ts y el proceso de background que
// puebla/invalida financial_match_index (ver financial-match-index.md).

const CUENTA_DNI_WALLET_ID = '5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4'
const BANCO_PROVINCIA_ID = 'cmnulzeoy0007qlkk1oepw305'

export interface UserCardLike {
  bankId?: string | null
  walletId?: string | null
  cardNetworkId?: string | null
  cardType?: string | null
  cardSegmentId?: string | null
  segmentId?: string | null
  cardTier?: string | null
  isPayroll?: boolean | null
  isPensioner?: boolean | null
}

export interface RequirementLike {
  bankId?: string | null
  walletId?: string | null
  cardNetworkId?: string | null
  cardType?: string | null
  segmentId?: string | null
  cardSegmentId?: string | null
  cardTier?: string | null
  accountType?: string | null
}

export function matchesProfile(
  req: RequirementLike,
  userCards: UserCardLike[],
  tierToSegmentId: Map<string, string>
): boolean {
  // ═══════════════════════════════════════════════════════════════════════
  // REGLA 1: Requisito sin restricciones → aplica para TODOS
  // ═══════════════════════════════════════════════════════════════════════
  const hasEntityConstraint = req.bankId || req.walletId
  const hasCardConstraint = req.cardNetworkId || req.cardType
  const hasAccountConstraint = req.accountType && req.accountType !== 'ANY'

  if (!hasEntityConstraint && !hasCardConstraint && !hasAccountConstraint) {
    return false // Con perfil activo, requerir match explícito
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REGLA 2: Requirement con BANCO + WALLET → verificar por separado
  // El usuario guarda banco y wallet como cards distintas, no en una sola.
  // Ej: Fravega con Banco Corrientes + MODO + Visa Crédito:
  //   card1 = { bankId: Corrientes, cardNetworkId: Visa, cardType: CREDIT }
  //   card2 = { walletId: MODO }
  //   → ambas deben existir, pero no necesariamente en la misma card.
  // ═══════════════════════════════════════════════════════════════════════
  if (req.bankId && req.walletId) {
    // REGLA ESPECIAL: Si el requirement pide Banco Provincia + Cuenta DNI,
    // basta con que el usuario tenga Cuenta DNI (implica tener cuenta en Banco Provincia)
    const isCuentaDniReq = req.walletId === CUENTA_DNI_WALLET_ID && req.bankId === BANCO_PROVINCIA_ID
    if (isCuentaDniReq) {
      return userCards.some(card => card.walletId === CUENTA_DNI_WALLET_ID)
    }

    // ¿Tiene una card del banco correcto con la red/tipo correctos?
    const hasBankMatch = userCards.some(card => {
      if (card.bankId !== req.bankId) return false
      if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) return false
      if (req.cardType && card.cardType !== req.cardType) return false
      if (req.segmentId && card.segmentId !== req.segmentId) return false
      if (req.cardSegmentId && card.cardSegmentId !== req.cardSegmentId) return false
      if (req.cardTier && !req.cardSegmentId) {
        const requiredSegId = tierToSegmentId.get(req.cardTier)
        if (requiredSegId && card.segmentId !== requiredSegId) return false
      }
      if ((req.accountType === 'JUBILADO' || req.accountType === 'ANSES') && !card.isPensioner) return false
      if (req.accountType === 'HABERES' && !card.isPayroll) return false
      return true
    })
    if (!hasBankMatch) return false

    // ¿Tiene la wallet requerida?
    return userCards.some(card => card.walletId === req.walletId)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REGLA 3: Solo banco O solo wallet → match estricto en una card
  // ═══════════════════════════════════════════════════════════════════════
  return userCards.some(card => {
    // ─── Banco ────────────────────────────────────────────────────────
    if (req.bankId) {
      if (card.bankId !== req.bankId) return false
    }
    // Requirement solo wallet (sin banco) → matchear cualquier card con esa wallet
    // (incluye cards que tienen banco+wallet, ej: Galicia+MODO matchea req de solo MODO)
    else if (req.walletId && !req.bankId) {
      if (!card.walletId) return false // la card debe tener wallet
    }

    // ─── Wallet ───────────────────────────────────────────────────────
    if (req.walletId && card.walletId !== req.walletId) return false

    // ─── Red de tarjeta ───────────────────────────────────────────────
    if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) return false

    // ─── Tipo de tarjeta ──────────────────────────────────────────────
    if (req.cardType && card.cardType !== req.cardType) return false

    // ─── Segmento bancario ────────────────────────────────────────────
    if (req.segmentId && card.segmentId !== req.segmentId) return false

    // ─── Segmento de tarjeta (ej: Visa Gold, AmEx Black Macro Selecta) ──
    if (req.cardSegmentId && card.cardSegmentId !== req.cardSegmentId) return false

    // ─── Tier (SELECTA, EMINENT) → solo si no hay cardSegmentId específico
    // Si cardSegmentId ya validó el segmento (que implica el tier), no re-chequear
    if (req.cardTier && !req.cardSegmentId) {
      const requiredSegId = tierToSegmentId.get(req.cardTier)
      if (requiredSegId && card.segmentId !== requiredSegId) return false
    }

    // ─── Tipo de cuenta ───────────────────────────────────────────────
    if (req.accountType === 'JUBILADO' || req.accountType === 'ANSES') {
      if (!card.isPensioner) return false
    }
    if (req.accountType === 'HABERES') {
      if (!card.isPayroll) return false
    }

    return true
  })
}
