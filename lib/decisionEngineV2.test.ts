// Casos de prueba del Decision Engine v2 (RFC-008). Fixtures con shape real
// de promo (el mismo que produce getPromosData: commerce/category/requirements
// con relations, userBestDiscount ya resuelto) — no mocks de tipos inventados.
//
// CPO Approval "Tus rubros" (16/8/2026): buildHomeDecisionPayload ya no recibe
// un RubroSelection[] con fallback/relleno — recibe declaredUniverse
// (RubroConfig[], desde rubroPreferences.resolveDeclaredUniverse) y selecciona
// los N mejores por score entre ESE universo, sin sustituir por otros rubros
// del catálogo ni completar con defaults. Universo vacío -> 0 slots, siempre.
import { describe, expect, it } from 'vitest'
import { buildHomeDecisionPayload, type DecisionContext, type PersonaPreferences } from './decisionEngineV2'
import { RUBRO_CATALOG, type RubroConfig } from './rubroCatalog'

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

function rubroById(id: string): RubroConfig {
  return RUBRO_CATALOG.find(r => r.id === id)!
}

function universeOf(...ids: string[]): RubroConfig[] {
  return ids.map(rubroById)
}

const HAS_PROFILE = { hasProfile: true }
const PREFS: PersonaPreferences | undefined = undefined
const FULL_UNIVERSE = RUBRO_CATALOG

describe('buildHomeDecisionPayload', () => {
  it('produce un rubro ok con principal cuando hay una sola candidata fuerte', () => {
    const promo = makePromo({
      id: 'p-coto-1',
      commerceId: 'commerce-coto',
      commerce: { name: 'Coto' },
      category: { name: 'Supermercados', slug: 'supermercados' },
    })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('supermercados'))

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
    const payload = buildHomeDecisionPayload(promos, CTX, PREFS, HAS_PROFILE, universeOf('supermercados'))
    const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!

    expect(slot.status).toBe('ok')
    if (slot.status === 'ok') {
      expect(slot.principal.facts.commerceName).toBe('Coto') // mayor score: 30% sin tope
      expect(slot.alternativas.map(a => a.facts.commerceName)).toEqual(['Día', 'Vea'])
      expect(slot.alternativas.length).toBeLessThanOrEqual(2)
    }
  })

  it('rubro sin ninguna promo vigente hoy queda excluido de payload.rubros (slot empty se descarta)', () => {
    // combustible sin ninguna promo en el input -> empty -> selectTopRubroSlots lo filtra
    const promo = makePromo({ category: { name: 'Supermercados', slug: 'supermercados' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('supermercados', 'combustible'))

    expect(payload.rubros.find(r => r.rubro.id === 'combustible')).toBeUndefined()
    expect(payload.rubros.find(r => r.rubro.id === 'supermercados')?.status).toBe('ok')
  })

  it('rubro cuya única candidata no es válida hoy queda excluido de payload.rubros', () => {
    const otherDayBit = 1 << ((new Date().getDay() + 1) % 7)
    const promo = makePromo({ validDays: otherDayBit, category: { name: 'Farmacias', slug: 'farmacias' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('farmacias'))

    expect(payload.rubros.find(r => r.rubro.id === 'farmacias')).toBeUndefined()
    expect(payload.rubros).toHaveLength(0)
  })

  it('rubro cuya mejor candidata no supera el umbral de confianza queda excluido de payload.rubros', () => {
    // Descuento mínimo, sin cercanía, sin canal online, categoría discrecional (afinidad baja)
    const promo = makePromo({
      commerceId: 'commerce-lejos',
      category: { name: 'Indumentaria', slug: 'indumentaria' },
      userBestDiscount: { discountType: 'PERCENTAGE_DESCUENTO', discountValue: 3, cap: 500, capUnlimited: false, bank: { name: 'Banco X' } },
    })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('indumentaria'))

    expect(payload.rubros.find(r => r.rubro.id === 'indumentaria')).toBeUndefined()
    expect(payload.rubros).toHaveLength(0)
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
      const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('supermercados'))
      const slot = payload.rubros.find(r => r.rubro.id === 'supermercados')!
      expect(slot.status).toBe('ok')
      if (slot.status === 'ok') {
        expect(slot.principal.facts.benefit).toEqual(expected)
      }
    }
  })

  it('status incomplete_profile cuando no hay perfil suficiente, sin evaluar rubros', () => {
    const payload = buildHomeDecisionPayload([], CTX, PREFS, { hasProfile: false, missingProfile: ['tarjetas'] }, FULL_UNIVERSE)
    expect(payload.status).toBe('incomplete_profile')
    expect(payload.rubros).toHaveLength(0)
    expect(payload.missingProfile).toEqual(['tarjetas'])
  })

  it('status all_empty cuando hay universo declarado pero ningún rubro tiene oportunidades', () => {
    const payload = buildHomeDecisionPayload([], CTX, PREFS, HAS_PROFILE, universeOf('supermercados', 'combustible'))
    expect(payload.status).toBe('all_empty')
    expect(payload.rubros).toHaveLength(0)
  })

  it('reasons son códigos estructurados, no strings libres, y el motor no arma copy', () => {
    const promo = makePromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('supermercados'))
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
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('supermercados'))
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

    const payloadA = buildHomeDecisionPayload([promo], ctxWithNow, PREFS, HAS_PROFILE, universeOf('supermercados'))
    const payloadB = buildHomeDecisionPayload([promo], ctxWithNow, PREFS, HAS_PROFILE, universeOf('supermercados'))

    const slotA = payloadA.rubros.find(r => r.rubro.id === 'supermercados')!
    const slotB = payloadB.rubros.find(r => r.rubro.id === 'supermercados')!
    expect(slotA).toEqual(slotB)
    if (slotA.status === 'ok') {
      expect(slotA.principal.facts.validity.expiresSoon).toBe(true) // vence en 2 días, umbral es 3
    }
  })

  it('sin declaredUniverse (5to param omitido) no devuelve ningún rubro — sin default al catálogo completo', () => {
    const promo = makePromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' } })
    const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE)
    expect(payload.rubros).toHaveLength(0)
    expect(payload.status).toBe('all_empty')
  })

  describe('selectTopRubroSlots — CPO Approval "Tus rubros" (16/8/2026)', () => {
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

    it('un rubro declarado sin oportunidad hoy queda empty — sin sustituto de otro rubro del catálogo', () => {
      // declared: solo 'combustible' (sin promos en el input -> empty).
      // tecnologia SÍ tiene una promo fuerte, pero no está en el universo
      // declarado -> no puede aparecer como slot (fin del fallback externo).
      const promo = strongPromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' }, category: { name: 'Tecnología', slug: 'tecnologia' } })

      const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universeOf('combustible'))
      expect(payload.rubros).toHaveLength(0) // 'combustible' quedó empty, se descarta del resultado
    })

    it('universo con más rubros ok que N (HOME_RUBRO_COUNT=5) devuelve como máximo N', () => {
      // 8 declarados, todos con oportunidad -> debe truncar a 5 (HOME_RUBRO_COUNT), no devolver 8
      const declaredIds = ['supermercados', 'combustible', 'farmacias', 'gastronomia', 'tecnologia', 'hogar', 'indumentaria', 'transporte']
      const promos = declaredIds.map(id => {
        const rubro = rubroById(id)
        return strongPromo({ id: `p-${id}`, commerceId: `commerce-${id}`, commerce: { name: id }, category: { name: rubro.label, slug: rubro.categorySlugs[0] } })
      })
      const universe = universeOf(...declaredIds)

      const payload = buildHomeDecisionPayload(promos, CTX, PREFS, HAS_PROFILE, universe)
      expect(payload.rubros).toHaveLength(5)
    })

    it('universo con menos rubros ok que N devuelve solo los que están ok — no completa con otros', () => {
      const promo = strongPromo({ commerceId: 'commerce-coto', commerce: { name: 'Coto' }, category: { name: 'Supermercados', slug: 'supermercados' } })
      const universe = universeOf('supermercados', 'combustible', 'farmacias')

      const payload = buildHomeDecisionPayload([promo], CTX, PREFS, HAS_PROFILE, universe)
      expect(payload.rubros).toHaveLength(1)
      expect(payload.rubros[0].rubro.id).toBe('supermercados')
    })

    it('empate exacto de score desempata por orden de RUBRO_CATALOG (no por orden de declaración)', () => {
      // tecnologia y viajes-y-turismo comparten afinidad default (0.25, ninguno
      // está en NECESIDAD_ALTA/MEDIA) -> con la misma promo fuerte y mismo
      // contexto (sin cercanía en ninguno de los dos commerceId), el score
      // queda exactamente empatado.
      const promoTec = strongPromo({ id: 'p-tec', commerceId: 'commerce-tec', commerce: { name: 'Compumundo' }, category: { name: 'Tecnología', slug: 'tecnologia' } })
      const promoViajes = strongPromo({ id: 'p-viajes', commerceId: 'commerce-viajes', commerce: { name: 'Despegar' }, category: { name: 'Viajes y Turismo', slug: 'viajes-y-turismo' } })
      const universe = universeOf('viajes-y-turismo', 'tecnologia') // orden de declaración invertido a propósito

      const payload = buildHomeDecisionPayload([promoTec, promoViajes], CTX, PREFS, HAS_PROFILE, universe)
      expect(payload.rubros).toHaveLength(2)
      const [slotA, slotB] = payload.rubros
      if (slotA.status !== 'ok' || slotB.status !== 'ok') throw new Error('esperaba ambos slots en status ok')
      expect(slotA.principal.score).toBe(slotB.principal.score) // confirma que es un empate real
      const catalogIndex = new Map(RUBRO_CATALOG.map((r, i) => [r.id, i]))
      const [first, second] = payload.rubros.map(r => r.rubro.id)
      expect(catalogIndex.get(first)!).toBeLessThan(catalogIndex.get(second)!)
    })
  })
})
