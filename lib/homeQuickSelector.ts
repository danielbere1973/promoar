// Quick Selector — CPO Directive Prioridad 3 "Mi Ahorro de Hoy" (27/8/2026).
// Filtra HomeDecisionPayload en memoria por método de pago seleccionado, sin
// nuevo fetch (<100ms). No es parte del contrato del engine — es un filtro de
// presentación que vive del lado de la UI, igual que homeCopy.ts.

import type { DecisionCandidate, HomeDecisionPayload, RubroSlot } from './homeDecisionContract'

export interface QuickSelectorOption {
  key: string // `bank:${id}` | `wallet:${id}`
  name: string
  logoUrl: string | null
}

export function buildQuickSelectorOptions(profile: {
  banks: { bank: { id: string; name: string; logoUrl: string | null } }[]
  wallets: { wallet: { id: string; name: string; logoUrl: string | null } }[]
} | null): QuickSelectorOption[] {
  if (!profile) return []
  const banks = profile.banks.map(b => ({ key: `bank:${b.bank.id}`, name: b.bank.name, logoUrl: b.bank.logoUrl }))
  const wallets = profile.wallets.map(w => ({ key: `wallet:${w.wallet.id}`, name: w.wallet.name, logoUrl: w.wallet.logoUrl }))
  return [...banks, ...wallets]
}

function candidateMatches(candidate: DecisionCandidate, selectedName: string): boolean {
  return candidate.facts.paymentMethod.bankOrWalletName === selectedName
}

// Filtra cada slot 'ok' a las candidatas que matchean el método de pago
// seleccionado. Si la principal no matchea pero una alternativa sí, esa
// alternativa pasa a ser principal (el usuario filtró, quiere ver esa). Si
// ninguna candidata del rubro matchea, el slot se oculta (no tiene sentido
// mostrar "vacío" — simplemente ese rubro no tiene oferta para esa tarjeta).
export function filterPayloadBySelection(data: HomeDecisionPayload, selectedName: string | null): HomeDecisionPayload {
  if (!selectedName) return data

  const rubros: RubroSlot[] = []
  for (const slot of data.rubros) {
    if (slot.status !== 'ok') continue
    const all = [slot.principal, ...slot.alternativas]
    const matched = all.filter(c => candidateMatches(c, selectedName))
    if (matched.length === 0) continue
    const [principal, ...alternativas] = matched
    rubros.push({ status: 'ok', rubro: slot.rubro, principal, alternativas })
  }

  return { ...data, rubros }
}
