// Adaptador de presentación para BenefitFact (Home v2 UI). No vive en el
// motor — mismo principio que lib/reasonText.ts (RFC-008 §2.5).

import type { BenefitFact } from './homeDecisionContract'

export function benefitDisplay(benefit: BenefitFact): { num: string; unit: string; label: string; isCsi: boolean } {
  switch (benefit.kind) {
    case 'pct_off':
      return { num: `${benefit.pct}`, unit: '%', label: 'descuento', isCsi: false }
    case 'reintegro':
      return { num: `${benefit.pct}`, unit: '%', label: 'reintegro', isCsi: false }
    case 'cuotas_sin_interes':
      return { num: `${benefit.cuotas}`, unit: '', label: `cuota${benefit.cuotas !== 1 ? 's' : ''} s/int.`, isCsi: true }
    case 'monto_fijo':
      return { num: `$${benefit.monto.toLocaleString('es-AR')}`, unit: '', label: 'descuento', isCsi: false }
    case 'nxm':
      return { num: `${benefit.n}x${benefit.m}`, unit: '', label: 'prom.', isCsi: false }
  }
}
