// Casos de prueba del Decision Engine v2 (RFC-008). Fixtures con shape real
// de promo (el mismo que produce getPromosData: commerce/category/requirements
// con relations, userBestDiscount ya resuelto) — no mocks de tipos inventados.
import { describe, expect, it } from 'vitest'
import { buildHomeDecisionPayload, type DecisionContext, type PersonaPreferences } from './decisionEngineV2'
import { RUBRO_CATALOG } from './rubroCatalog'
import type { RubroSelection } from './rubroPreferences'

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

  it('reasons son códigos estructurados, no strings libres, y el motor no arma copy', () => {
    const promo = makePromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)
    const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!
    if (slot.status === 'ok') {
      for (const reason of slot.principal.reasons) {
        expect(typeof reason.code).toBe('string')
        expect(reason).not.toHaveProperty('text')
      }
      // RFC-008 §2.5: el motor no calcula reasonsText — eso vive en la capa
      // de presentación (lib/reasonText.ts). Acá solo se verifica que el
      // motor no lo agregue por su cuenta.
      expect(slot.principal.reasonsText).toBeUndefined()
    }
  })

  it('reasonsToText (adaptador de presentación) arma el compat field fuera del motor', async () => {
    const { reasonsToText } = await import('./reasonText')
    const promo = makePromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)
    const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!
    if (slot.status === 'ok') {
      const texts = reasonsToText(slot.principal.reasons)
      expect(texts.length).toBe(slot.principal.reasons.length)
      expect(texts.every(t => typeof t === 'string')).toBe(true)
    }
  })

  it('buildHomeDecisionPayload es determinístico ante el mismo input y ctx.now fijo', () => {
    const promo = makePromo({
      commerceId: 'commerce-coto',
      commerce: { name: 'Coto' },
      validUntil: new Date('2026-08-14T00:00:00.000Z').toISOString(),
    })
    const fixedNow = new Date('2026-08-12T12:00:00.000Z')
    const ctxWithNow: DecisionContext = { ...CTX, now: fixedNow }

    const payloadA = buildHomeDecisionPayload([promo], ctxWithNow, PREFS, HAS_PROFILE)
    const payloadB = buildHomeDecisionPayload([promo], ctxWithNow, PREFS, HAS_PROFILE)

    const slotA = payloadA.rubros.find(r => r.rubro.id === 'supermercados')!
    const slotB = payloadB.rubros.find(r => r.rubro.id === 'supermercados')!
    expect(slotA).toEqual(slotB)
    if (slotA.status === 'ok') {
      expect(slotA.principal.facts.validity.expiresSoon).toBe(true) // vence en 2 días, umbral es 3
    }
  })

  it('el catálogo de rubros respeta N=5 y siempre devuelve exactamente N slots', () => {
    const payload = buildHomeDecisionPayload([], CTX, PREFS, HAS_PROFILE)
    expect(payload.rubros).toHaveLength(5)
  })

  it('sin rubroSelection (5to param) usa el default de RUBRO_CATALOG completo — compat hacia atrás', () => {
    const promo = makePromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)
    // comportamiento histórico: primeros 5 ids del catálogo, ninguno declarado
    expect(payload.rubros.map(r => r.rubro.id)).toEqual(RUBRO_CATALOG.slice(0, 5).map(r => r.id))
  })

  describe('rubroSelection — CPO Approval v2 (fallback y personalización)', () => {
    function rubroById(id: string) {
      const rubro = RUBRO_CATALOG.find(r => r.id === id)!
      return rubro
    }

    // Promo fuerte para forzar score > CONFIDENCE_THRESHOLD_OK (0.35) incluso
    // en rubros sin afinidad "alta" (ej. tecnologia/hogar no están en
    // NECESIDAD_ALTA/MEDIA -> afinidad default 0.25): 40%+ reintegro sin tope
    // ya solo con ahorro*0.35 supera el umbral.
    function strongPromo(overrides: Record<string, any>) {
      return makePromo({
        userBestDiscount: { discountType: 'PERCENTAGE_REINTEGRO', discountValue: 40, cap: null, capUnlimited: true, bank: { name: 'Banco Galicia' } },
        ...overrides,
      })
    }

    it('un rubro declarado sin oportunidad hoy recibe un sustituto del catálogo completo (fallback)', () => {
      // declared: solo 'combustible' (sin promos en el input -> empty) — el
      // resto del universo (no incluido en la selección inicial) debe poder
      // proveer un sustituto.
      const promo = strongPromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' }, category: { name: 'Tecnología', slug: 'tecnologia' } })
      const selection: RubroSelection[] = [{ rubro: rubroById('combustible'), isDeclared: true }]

      const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, selection)
      expect(payload.rubros).toHaveLength(1)
      const slot = payload.rubros[0]
      // combustible no tenía candidatos -> se sustituyó por tecnologia, que sí tiene una promo válida
      expect(slot.status).toBe('ok')
      if (slot.status === 'ok') {
        expect(slot.rubro.id).toBe('tecnologia')
      }
    })

    it('si no hay ningún candidato en todo el catálogo, el slot declarado queda empty (no relaja el umbral)', () => {
      const selection: RubroSelection[] = [{ rubro: rubroById('combustible'), isDeclared: true }]
      const payload = buildHomeDecisionPayload([], CTX, PREFS, HAS_PROFILE, selection)
      expect(payload.rubros).toHaveLength(1)
      expect(payload.rubros[0].status).toBe('empty')
      if (payload.rubros[0].status === 'empty') {
        expect(payload.rubros[0].rubro.id).toBe('combustible')
      }
    })

    it('dos declarados sin oportunidad el mismo día reciben sustitutos distintos entre sí (acumulación de usedIds)', () => {
      const promoTec = strongPromo({ id: 'p-tec', commerceId: 'commerce-tec', commerce: { name: 'Compumundo' }, category: { name: 'Tecnología', slug: 'tecnologia' } })
      const promoHogar = strongPromo({ id: 'p-hogar', commerceId: 'commerce-hogar', commerce: { name: 'Sodimac' }, category: { name: 'Hogar', slug: 'hogar' } })
      const selection: RubroSelection[] = [
        { rubro: rubroById('combustible'), isDeclared: true },
        { rubro: rubroById('farmacias'), isDeclared: true },
      ]

      const payload = buildHomeDecisionPayload([promoTec, promoHogar], CTX, PREFS, HAS_PROFILE, selection)
      expect(payload.rubros).toHaveLength(2)
      const ids = payload.rubros.map(r => r.rubro.id)
      expect(new Set(ids).size).toBe(2) // sustitutos distintos, ninguno repetido
      expect(ids).toEqual(expect.arrayContaining(['tecnologia', 'hogar']))
    })

    it('rubro no declarado (default fill) con slot empty NO dispara fallback — solo aplica a declarados', () => {
      const selection: RubroSelection[] = [{ rubro: rubroById('combustible'), isDeclared: false }]
      const payload = buildHomeDecisionPayload([], CTX, PREFS, HAS_PROFILE, selection)
      expect(payload.rubros).toHaveLength(1)
      expect(payload.rubros[0].status).toBe('empty')
      if (payload.rubros[0].status === 'empty') {
        expect(payload.rubros[0].rubro.id).toBe('combustible')
      }
    })
  })
})
