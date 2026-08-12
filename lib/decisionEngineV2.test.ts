// Casos de prueba del Decision Engine v2 (RFC-008). Fixtures con shape real
// de promo (el mismo que produce getPromosData: commerce/category/requirements
// con relations, userBestDiscount ya resuelto) — no mocks de tipos inventados.
import { describe, expect, it } from 'vitest'
import { buildHomeDecisionPayload, type DecisionContext, type PersonaPreferences } from './decisionEngineV2'

const ALL_DAYS = 127
const CTX: DecisionContext = {
  hasLocation: true,
  nearbyByCommerceId: {
    'commerce-coto': { count: 1, minDistKm: 0.3 },
  },
  todayBit: 1 << new Date().getDay(),
}

function makePromo(overrides: Record<string, any>) {
  return {
    id: overrides.id ?? 'promo-1',
    commerceId: overrides.commerceId ?? 'commerce-x',
    validDays: ALL_DAYS,
    validUntil: null,
    salesChannel: 'OFFLINE',
    isSaved: false,
    category: { name: 'Supermercados', slug: 'supermercados' },
    commerce: { name: 'Comercio X' },
    userBestDiscount: {
      discountType: 'PERCENTAGE_REINTEGRO',
      discountValue: 20,
      cap: 5000,
      capUnlimited: false,
      capPeriod: 'MONTHLY',
      bank: { name: 'Banco Galicia' },
      wallet: null,
      cardNetwork: { name: 'Visa' },
    },
    ...overrides,
  }
}

const HAS_PROFILE = { hasProfile: true }
const PREFS: PersonaPreferences | undefined = undefined

describe('buildHomeDecisionPayload', () => {
  it('produce un rubro ok con principal cuando hay una sola candidata fuerte', () => {
    const promo = makePromo({
      id: 'p-coto-1',
      commerceId: 'commerce-coto',
      commerce: { name: 'Coto' },
      category: { name: 'Supermercados', slug: 'supermercados' },
    })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)

    expect(payload.status).toBe('ok')
    const superSlot = payload.rubros.find(r => r.rubro.id === 'supermercados')!
    expect(superSlot.status).toBe('ok')
    if (superSlot.status === 'ok') {
      expect(superSlot.principal.facts.commerceName).toBe('Coto')
      expect(superSlot.principal.facts.benefit).toEqual({ kind: 'reintegro', pct: 20 })
      expect(superSlot.alternativas).toHaveLength(0)
      expect(superSlot.principal.confidence.tier).not.toBe('baja')
    }
  })

  it('arma alternativas cuando hay más de una candidata en el mismo rubro', () => {
    const promos = [
      makePromo({ id: 'p1', commerceId: 'commerce-coto', commerce: { name: 'Coto' }, userBestDiscount: { discountType: 'PERCENTAGE_REINTEGRO', discountValue: 30, cap: null, capUnlimited: true, bank: { name: 'Banco Galicia' } } }),
      makePromo({ id: 'p2', commerceId: 'commerce-dia', commerce: { name: 'Día' }, userBestDiscount: { discountType: 'PERCENTAGE_REINTEGRO', discountValue: 15, cap: 3000, capUnlimited: false, bank: { name: 'Banco Macro' } } }),
      makePromo({ id: 'p3', commerceId: 'commerce-vea', commerce: { name: 'Vea' }, userBestDiscount: { discountType: 'PERCENTAGE_DESCUENTO', discountValue: 10, cap: 2000, capUnlimited: false, wallet: { name: 'MODO' } } }),
    ]
    const payload = buildHomeDecisionPayload(promos, CTX, PREFS, HAS_PROFILE)
    const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!

    expect(slot.status).toBe('ok')
    if (slot.status === 'ok') {
      expect(slot.principal.facts.commerceName).toBe('Coto') // mayor score: 30% sin tope
      expect(slot.alternativas.map(a => a.facts.commerceName)).toEqual(['Día', 'Vea'])
      expect(slot.alternativas.length).toBeLessThanOrEqual(2)
    }
  })

  it('devuelve slot empty (sin_candidatos) cuando el rubro no tiene ninguna promo vigente hoy', () => {
    // combustible sin ninguna promo en el input
    const promo = makePromo({ category: { name: 'Supermercados', slug: 'supermercados' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)

    const combustibleSlot = payload.rubros.find(r => r.rubro.id === 'combustible')!
    expect(combustibleSlot.status).toBe('empty')
    if (combustibleSlot.status === 'empty') {
      expect(combustibleSlot.reason).toBe('sin_candidatos')
    }
  })

  it('devuelve slot empty (sin_candidatos) cuando la única candidata no es válida hoy', () => {
    const otherDayBit = 1 << ((new Date().getDay() + 1) % 7)
    const promo = makePromo({ validDays: otherDayBit, category: { name: 'Farmacias', slug: 'farmacias' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)

    const slot = payload.rubros.find(r => r.rubro.id === 'farmacias')!
    expect(slot.status).toBe('empty')
    if (slot.status === 'empty') expect(slot.reason).toBe('sin_candidatos')
  })

  it('devuelve slot empty (bajo_confianza) cuando la mejor candidata no supera el umbral', () => {
    // Descuento mínimo, sin cercanía, sin canal online, categoría discrecional (afinidad baja)
    const promo = makePromo({
      commerceId: 'commerce-lejos',
      category: { name: 'Indumentaria', slug: 'indumentaria' },
      userBestDiscount: { discountType: 'PERCENTAGE_DESCUENTO', discountValue: 3, cap: 500, capUnlimited: false, bank: { name: 'Banco X' } },
    })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)

    const slot = payload.rubros.find(r => r.rubro.id === 'indumentaria')!
    expect(slot.status).toBe('empty')
    if (slot.status === 'empty') expect(slot.reason).toBe('bajo_confianza')
  })

  it('mapea correctamente los 5 tipos de BenefitFact', () => {
    const cases: Array<[any, any]> = [
      [{ discountType: 'PERCENTAGE_REINTEGRO', discountValue: 20 }, { kind: 'reintegro', pct: 20 }],
      [{ discountType: 'PERCENTAGE_DESCUENTO', discountValue: 15 }, { kind: 'pct_off', pct: 15 }],
      [{ discountType: 'FIXED_AMOUNT', discountValue: 1000 }, { kind: 'monto_fijo', monto: 1000 }],
      [{ discountType: 'NXM', nxmN: 2, nxmM: 1 }, { kind: 'nxm', n: 2, m: 1 }],
      [{ discountType: 'CUOTAS_SIN_INTERES', nxmN: 12 }, { kind: 'cuotas_sin_interes', cuotas: 12 }],
    ]
    for (const [best, expected] of cases) {
      const promo = makePromo({
        id: `benefit-${best.discountType}`,
        commerceId: 'commerce-coto',
        commerce: { name: 'Coto' },
        userBestDiscount: { ...best, cap: null, capUnlimited: true, bank: { name: 'Banco Galicia' } },
      })
      const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)
      const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!
      expect(slot.status).toBe('ok')
      if (slot.status === 'ok') {
        expect(slot.principal.facts.benefit).toEqual(expected)
      }
    }
  })

  it('status incomplete_profile cuando no hay perfil suficiente, sin evaluar rubros', () => {
    const payload = buildHomeDecisionPayload([], CTX, PREFS, { hasProfile: false, missingProfile: ['tarjetas'] })
    expect(payload.status).toBe('incomplete_profile')
    expect(payload.rubros).toHaveLength(0)
    expect(payload.missingProfile).toEqual(['tarjetas'])
  })

  it('status all_empty cuando hay perfil pero ningún rubro tiene oportunidades', () => {
    const payload = buildHomeDecisionPayload([], CTX, PREFS, HAS_PROFILE)
    expect(payload.status).toBe('all_empty')
    expect(payload.rubros.every(r => r.status === 'empty')).toBe(true)
  })

  it('reasons son códigos estructurados, no strings libres', () => {
    const promo = makePromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)
    const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!
    if (slot.status === 'ok') {
      for (const reason of slot.principal.reasons) {
        expect(typeof reason.code).toBe('string')
        expect(reason).not.toHaveProperty('text')
      }
      expect(slot.principal.reasonsText!.length).toBe(slot.principal.reasons.length)
    }
  })

  it('el catálogo de rubros respeta N=5 y siempre devuelve exactamente N slots', () => {
    const payload = buildHomeDecisionPayload([], CTX, PREFS, HAS_PROFILE)
    expect(payload.rubros).toHaveLength(5)
  })
})
