// Lectura y selección de rubros personalizados para la Home — CPO Approval
// "Preferencias → selección personalizada de rubros v2" (15/8/2026).
//
// Separado de lib/decisionEngineV2.ts a propósito: el motor es explícitamente
// "sin I/O" (ver cabecera de ese archivo) — toda query de Prisma vive acá,
// resuelta una vez por request y pasada como dato ya materializado a
// resolveDeclaredUniverse, que es una función pura sin acceso a DB.
//
// HomeRubro.active (DB) es la única autoridad de habilitación — RUBRO_CATALOG
// (código) es solo la fuente de forma/orden/slugs. Ver propuesta-tecnica-
// preferencias-rubro-home-v2.md §2 para el razonamiento completo.

import { prisma } from '@/lib/prisma'
import { RUBRO_CATALOG, type RubroConfig } from './rubroCatalog'

export interface DeclaredPreference {
  rubroId: string
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
// el caller (getActiveHomeRubroIds). CPO Approval "Tus rubros" (16/8/2026):
// reemplaza a selectRubrosForHome — ya no hay fallback externo ni relleno
// hasta N. Devuelve el universo completo de rubros DECLARED/ACTIVE, en orden
// de catálogo; la selección de los N mejores por score vive en
// decisionEngineV2.selectTopRubroSlots.
export function resolveDeclaredUniverse(
  declared: DeclaredPreference[],
  activeRubroIds: Set<string>,
  catalog: RubroConfig[] = RUBRO_CATALOG
): RubroConfig[] {
  const declaredIds = new Set(declared.map(d => d.rubroId))
  return catalog.filter(r => activeRubroIds.has(r.id) && declaredIds.has(r.id))
}

// CPO Ratificación "Opción A" (dictamen 25/8/2026, ratificado 26/8/2026): un guest
// (user == null) nunca tiene UserRubroPreference — usar resolveDeclaredUniverse con
// declared=[] siempre da universo vacío. Para guests el universo declarado ES el
// universo completo de rubros activos, no un subconjunto declarado. Función pura,
// mismo criterio de activación (activeRubroIds) que resolveDeclaredUniverse.
export function resolveGuestUniverse(
  activeRubroIds: Set<string>,
  catalog: RubroConfig[] = RUBRO_CATALOG
): RubroConfig[] {
  return catalog.filter(r => activeRubroIds.has(r.id))
}
