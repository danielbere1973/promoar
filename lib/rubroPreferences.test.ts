// Casos de prueba de selectRubrosForHome — CPO Approval "Preferencias →
// selección personalizada de rubros v2" (15/8/2026). Función pura, sin
// Prisma: getDeclaredActivePreferences/getActiveHomeRubroIds (I/O) no se
// testean acá con mocks de red — se testea el contrato de selección con
// inputs ya materializados, que es exactamente lo que reciben desde la ruta.
import { describe, expect, it } from 'vitest'
import { selectRubrosForHome, type DeclaredPreference } from './rubroPreferences'
import { RUBRO_CATALOG, HOME_RUBRO_COUNT, type RubroConfig } from './rubroCatalog'

const ALL_ACTIVE = new Set(RUBRO_CATALOG.map(r => r.id))

function declared(...rubroIds: string[]): DeclaredPreference[] {
  return rubroIds.map(rubroId => ({ rubroId }))
}

describe('selectRubrosForHome', () => {
  it('usuario sin preferencias mantiene los 5 defaults actuales (orden de catálogo)', () => {
    const selection = selectRubrosForHome([], ALL_ACTIVE)
    expect(selection).toHaveLength(HOME_RUBRO_COUNT)
    expect(selection.map(s => s.rubro.id)).toEqual(['supermercados', 'combustible', 'farmacias', 'gastronomia', 'indumentaria'])
    expect(selection.every(s => s.isDeclared === false)).toBe(true)
  })

  it('2 declaradas se completan con 3 defaults hasta N — declaradas primero, orden de catálogo entre ellas', () => {
    const selection = selectRubrosForHome(declared('tecnologia', 'hogar'), ALL_ACTIVE)
    expect(selection).toHaveLength(5)
    // declaradas ocupan los primeros slots (orden de catálogo ENTRE ellas:
    // tecnologia antes que hogar), luego los defaults en orden de catálogo.
    expect(selection.map(s => s.rubro.id)).toEqual(['tecnologia', 'hogar', 'supermercados', 'combustible', 'farmacias'])
    const byId = Object.fromEntries(selection.map(s => [s.rubro.id, s.isDeclared]))
    expect(byId['tecnologia']).toBe(true)
    expect(byId['supermercados']).toBe(false)
  })

  it('CPO Review ejemplo A — declara tecnologia + viajes-y-turismo → [tecnologia, viajes-y-turismo, supermercados, combustible, farmacias]', () => {
    const selection = selectRubrosForHome(declared('tecnologia', 'viajes-y-turismo'), ALL_ACTIVE)
    expect(selection.map(s => s.rubro.id)).toEqual(['tecnologia', 'viajes-y-turismo', 'supermercados', 'combustible', 'farmacias'])
    expect(selection.map(s => s.isDeclared)).toEqual([true, true, false, false, false])
  })

  it('CPO Review ejemplo B — declara transporte + hogar + salud-y-belleza → [transporte, hogar, salud-y-belleza, supermercados, combustible]', () => {
    const selection = selectRubrosForHome(declared('transporte', 'hogar', 'salud-y-belleza'), ALL_ACTIVE)
    expect(selection.map(s => s.rubro.id)).toEqual(['transporte', 'hogar', 'salud-y-belleza', 'supermercados', 'combustible'])
    expect(selection.map(s => s.isDeclared)).toEqual([true, true, true, false, false])
  })

  it('declaradas en orden inverso al de declaración quedan igual ordenadas por catálogo entre sí (no por orden de declaración)', () => {
    // declara viajes-y-turismo antes que tecnologia -> el resultado debe
    // seguir siendo tecnologia primero (orden de RUBRO_CATALOG), no el orden
    // en que el usuario los tildó.
    const selection = selectRubrosForHome(declared('viajes-y-turismo', 'tecnologia'), ALL_ACTIVE)
    expect(selection.slice(0, 2).map(s => s.rubro.id)).toEqual(['tecnologia', 'viajes-y-turismo'])
  })

  it('5 declaradas no dejan lugar para fill (0 defaults)', () => {
    const selection = selectRubrosForHome(
      declared('viajes-y-turismo', 'salud-y-belleza', 'hogar', 'tecnologia', 'transporte'),
      ALL_ACTIVE
    )
    expect(selection).toHaveLength(5)
    expect(selection.every(s => s.isDeclared)).toBe(true)
    // orden de catálogo entre las declaradas
    expect(selection.map(s => s.rubro.id)).toEqual(['transporte', 'tecnologia', 'hogar', 'salud-y-belleza', 'viajes-y-turismo'])
  })

  it('más de N declaradas trunca a N respetando orden de catálogo', () => {
    const selection = selectRubrosForHome(
      declared('viajes-y-turismo', 'salud-y-belleza', 'hogar', 'tecnologia', 'transporte', 'indumentaria', 'gastronomia'),
      ALL_ACTIVE
    )
    expect(selection).toHaveLength(5)
    expect(selection.every(s => s.isDeclared)).toBe(true)
    expect(selection.map(s => s.rubro.id)).toEqual(['gastronomia', 'indumentaria', 'transporte', 'tecnologia', 'hogar'])
  })

  it('rubroId declarado que no está en el catálogo activo se descarta silenciosamente', () => {
    const activeMinusHogar = new Set([...ALL_ACTIVE].filter(id => id !== 'hogar'))
    const selection = selectRubrosForHome(declared('hogar', 'tecnologia'), activeMinusHogar)
    expect(selection.map(s => s.rubro.id)).not.toContain('hogar')
    const byId = Object.fromEntries(selection.map(s => [s.rubro.id, s.isDeclared]))
    expect(byId['tecnologia']).toBe(true)
  })

  it('rubroId declarado duplicado se dedupea', () => {
    const selection = selectRubrosForHome(declared('tecnologia', 'tecnologia', 'hogar'), ALL_ACTIVE)
    const tecnologiaCount = selection.filter(s => s.rubro.id === 'tecnologia').length
    expect(tecnologiaCount).toBe(1)
    expect(selection).toHaveLength(5)
  })

  it('User A y User B con preferencias distintas producen sets de 5 distintos', () => {
    const userA = selectRubrosForHome(declared('viajes-y-turismo', 'tecnologia'), ALL_ACTIVE)
    const userB = selectRubrosForHome(declared('transporte', 'salud-y-belleza'), ALL_ACTIVE)
    expect(userA.map(s => s.rubro.id)).not.toEqual(userB.map(s => s.rubro.id))
  })

  it('rubro inactivo (HomeRubro.active=false) nunca entra como declarado ni como default fill', () => {
    const activeMinusTransporte = new Set([...ALL_ACTIVE].filter(id => id !== 'transporte'))
    // declarado pero inactivo: no debe aparecer
    const withDeclared = selectRubrosForHome(declared('transporte'), activeMinusTransporte)
    expect(withDeclared.map(s => s.rubro.id)).not.toContain('transporte')

    // inactivo y ninguna preferencia declarada por él: tampoco debe aparecer en el fill
    const onlyFiveActive = new Set(['supermercados', 'combustible', 'farmacias', 'gastronomia', 'transporte'])
    const withoutTransporte = new Set([...onlyFiveActive].filter(id => id !== 'transporte'))
    const fillSelection = selectRubrosForHome([], withoutTransporte)
    expect(fillSelection.map(s => s.rubro.id)).not.toContain('transporte')
    expect(fillSelection).toHaveLength(4) // solo 4 activos disponibles, no hay 5to para completar
  })

  it('catálogo=10 / N=5: siempre máximo 5 slots aunque el catálogo activo tenga más', () => {
    const selection = selectRubrosForHome([], ALL_ACTIVE)
    expect(ALL_ACTIVE.size).toBe(10)
    expect(selection.length).toBeLessThanOrEqual(5)
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
