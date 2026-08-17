// Casos de prueba de resolveDeclaredUniverse — CPO Approval "Tus rubros"
// (16/8/2026). Función pura, sin Prisma: getDeclaredActivePreferences/
// getActiveHomeRubroIds (I/O) no se testean acá con mocks de red — se
// testea el contrato de resolución con inputs ya materializados, que es
// exactamente lo que reciben desde la ruta. Reemplaza el suite anterior de
// selectRubrosForHome (fallback + fill hasta N), función eliminada: ya no
// hay relleno con el catálogo — ver decisionEngineV2.test.ts para el
// scoring/selección de los N mejores (selectTopRubroSlots).
import { describe, expect, it } from 'vitest'
import { resolveDeclaredUniverse, type DeclaredPreference } from './rubroPreferences'
import { RUBRO_CATALOG, type RubroConfig } from './rubroCatalog'

const ALL_ACTIVE = new Set(RUBRO_CATALOG.map(r => r.id))

function declared(...rubroIds: string[]): DeclaredPreference[] {
  return rubroIds.map(rubroId => ({ rubroId }))
}

describe('resolveDeclaredUniverse', () => {
  it('usuario sin preferencias devuelve universo vacío — sin fallback al catálogo', () => {
    const universe = resolveDeclaredUniverse([], ALL_ACTIVE)
    expect(universe).toEqual([])
  })

  it('2 declaradas devuelven exactamente esas 2, en orden de catálogo (no de declaración)', () => {
    const universe = resolveDeclaredUniverse(declared('hogar', 'tecnologia'), ALL_ACTIVE)
    expect(universe.map(r => r.id)).toEqual(['tecnologia', 'hogar'])
  })

  it('todas las declaradas en orden inverso quedan ordenadas por catálogo, no por orden de declaración', () => {
    const universe = resolveDeclaredUniverse(declared('viajes-y-turismo', 'tecnologia'), ALL_ACTIVE)
    expect(universe.map(r => r.id)).toEqual(['tecnologia', 'viajes-y-turismo'])
  })

  it('10 declaradas (todo el catálogo) devuelven las 10 — sin cap a N', () => {
    const universe = resolveDeclaredUniverse(
      declared(...RUBRO_CATALOG.map(r => r.id)),
      ALL_ACTIVE
    )
    expect(universe).toHaveLength(10)
  })

  it('más de N (8) declaradas no truncan — resolveDeclaredUniverse no aplica HOME_RUBRO_COUNT', () => {
    const universe = resolveDeclaredUniverse(
      declared('viajes-y-turismo', 'salud-y-belleza', 'hogar', 'tecnologia', 'transporte', 'indumentaria', 'gastronomia', 'farmacias'),
      ALL_ACTIVE
    )
    expect(universe).toHaveLength(8)
  })

  it('rubroId declarado que no está en el catálogo activo se descarta silenciosamente', () => {
    const activeMinusHogar = new Set(Array.from(ALL_ACTIVE).filter(id => id !== 'hogar'))
    const universe = resolveDeclaredUniverse(declared('hogar', 'tecnologia'), activeMinusHogar)
    expect(universe.map(r => r.id)).not.toContain('hogar')
    expect(universe.map(r => r.id)).toEqual(['tecnologia'])
  })

  it('rubroId declarado duplicado se dedupea', () => {
    const universe = resolveDeclaredUniverse(declared('tecnologia', 'tecnologia', 'hogar'), ALL_ACTIVE)
    const tecnologiaCount = universe.filter(r => r.id === 'tecnologia').length
    expect(tecnologiaCount).toBe(1)
    expect(universe).toHaveLength(2)
  })

  it('User A y User B con preferencias distintas producen universos distintos', () => {
    const userA = resolveDeclaredUniverse(declared('viajes-y-turismo', 'tecnologia'), ALL_ACTIVE)
    const userB = resolveDeclaredUniverse(declared('transporte', 'salud-y-belleza'), ALL_ACTIVE)
    expect(userA.map(r => r.id)).not.toEqual(userB.map(r => r.id))
  })

  it('rubro declarado pero inactivo (HomeRubro.active=false) nunca entra al universo', () => {
    const activeMinusTransporte = new Set(Array.from(ALL_ACTIVE).filter(id => id !== 'transporte'))
    const universe = resolveDeclaredUniverse(declared('transporte', 'hogar'), activeMinusTransporte)
    expect(universe.map(r => r.id)).not.toContain('transporte')
    expect(universe.map(r => r.id)).toEqual(['hogar'])
  })

  it('invariante: RUBRO_CATALOG refleja los 10 ids aprobados', () => {
    const ids = RUBRO_CATALOG.map((r: RubroConfig) => r.id).sort()
    expect(ids).toEqual(
      [
        'combustible',
        'farmacias',
        'gastronomia',
        'hogar',
        'indumentaria',
        'salud-y-belleza',
        'supermercados',
        'tecnologia',
        'transporte',
        'viajes-y-turismo',
      ].sort()
    )
  })
})
