// Invariante pedido en CPO Approval — Modelo de preferencias v2 (13/8/2026),
// actualizado por CPO Approval — Preferencias v2 rubros (15/8/2026):
// mientras RUBRO_CATALOG siga siendo la configuración en código y HomeRubro sea el ancla
// de identidad en DB, todo id activo usado por RUBRO_CATALOG debe existir en HomeRubro
// (constraint FK de UserRubroPreference.rubroId). Este test no toca la base de datos —
// valida en código que la lista de seed de las migraciones
// (20260813025226_add_user_rubro_preferences + 20260815155431_expand_home_rubros)
// sigue cubriendo el catálogo real. Si se agrega un rubro nuevo a RUBRO_CATALOG sin
// agregar su seed, este test falla y evita un desfasaje silencioso entre código y DB.
import { describe, expect, it } from 'vitest'
import { RUBRO_IDS } from './rubroCatalog'

// Debe reflejar exactamente los ids insertados en el seed de
// prisma/migrations/20260815065148_add_user_rubro_preferences/migration.sql
// + prisma/migrations/20260815155431_expand_home_rubros/migration.sql
// + prisma/migrations/20260821000000_expand_home_rubros_v2/migration.sql
const HOME_RUBRO_SEED_IDS = [
  'supermercados',
  'combustible',
  'farmacias',
  'gastronomia',
  'indumentaria',
  'transporte',
  'tecnologia',
  'hogar',
  'salud-y-belleza',
  'viajes-y-turismo',
  'mascotas',
  'heladerias',
  'entretenimiento',
  'deportes',
  'jugueterias',
  'librerias',
  'shoppings',
  'automotores',
]

describe('RUBRO_CATALOG <-> HomeRubro sync', () => {
  it('every RUBRO_CATALOG id has a matching HomeRubro seed row', () => {
    const missing = RUBRO_IDS.filter((id) => !HOME_RUBRO_SEED_IDS.includes(id))
    expect(missing).toEqual([])
  })
})
