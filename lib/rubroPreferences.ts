// Lectura y selección de rubros personalizados para la Home — CPO Approval
// "Preferencias → selección personalizada de rubros v2" (15/8/2026).
//
// Separado de lib/decisionEngineV2.ts a propósito: el motor es explícitamente
// "sin I/O" (ver cabecera de ese archivo) — toda query de Prisma vive acá,
// resuelta una vez por request y pasada como dato ya materializado a
// selectRubrosForHome, que es una función pura sin acceso a DB.
//
// HomeRubro.active (DB) es la única autoridad de habilitación — RUBRO_CATALOG
// (código) es solo la fuente de forma/orden/slugs. Ver propuesta-tecnica-
// preferencias-rubro-home-v2.md §2 para el razonamiento completo.

import { prisma } from '@/lib/prisma'
import { RUBRO_CATALOG, HOME_RUBRO_COUNT, type RubroConfig } from './rubroCatalog'

export interface DeclaredPreference {
  rubroId: string
}

export interface RubroSelection {
  rubro: RubroConfig
  isDeclared: boolean
}

export async function getDeclaredActivePreferences(userId: string): Promise<DeclaredPreference[]> {
  const rows = await prisma.userRubroPreference.findMany({
    where: { userId, source: 'DECLARED', status: 'ACTIVE' },
    select: { rubroId: true },
  })
  return rows
}

export async function getActiveHomeRubroIds(): Promise<Set<string>> {
  const rows = await prisma.homeRubro.findMany({
    where: { active: true },
    select: { id: true },
  })
  return new Set(rows.map(r => r.id))
}

// Función pura — sin Prisma, sin I/O. activeRubroIds ya viene resuelto por
// el caller (getActiveHomeRubroIds). No usa DeclaredPreference.createdAt como
// prioridad (CPO Review 15/8/2026: el momento de declaración no implica
// mayor interés). Dos niveles de orden (CPO Review — HOLD antes de aplicar en
// DEV, 15/8/2026): (1) declaradas tienen prioridad de slot sobre defaults —
// van SIEMPRE primero en el array, nunca intercaladas con el fill; (2) el
// orden de catálogo solo desempata ENTRE declaradas (y, por separado, entre
// los defaults del fill) — no se usa para reordenar el conjunto completo.
export function selectRubrosForHome(
  declared: DeclaredPreference[],
  activeRubroIds: Set<string>,
  catalog: RubroConfig[] = RUBRO_CATALOG,
  n: number = HOME_RUBRO_COUNT
): RubroSelection[] {
  const activeCatalog = catalog.filter(r => activeRubroIds.has(r.id))
  const declaredIds = new Set(declared.map(d => d.rubroId))

  // Orden entre las declaradas = orden del catálogo activo, no orden de
  // declaración. declaredIds solo determina membresía.
  const declaredInCatalogOrder = activeCatalog.filter(r => declaredIds.has(r.id))

  const selected: RubroSelection[] = declaredInCatalogOrder
    .slice(0, n)
    .map(r => ({ rubro: r, isDeclared: true }))

  const seen = new Set(selected.map(s => s.rubro.id))
  if (selected.length < n) {
    for (const rubro of activeCatalog) {
      if (selected.length >= n) break
      if (seen.has(rubro.id)) continue
      selected.push({ rubro, isDeclared: false })
      seen.add(rubro.id)
    }
  }

  return selected
}
