// Catálogo de rubros de la Home — RFC-008 §2.3 / definicion-producto-home.md §2.
// N=5 es una hipótesis inicial (sujeta a revisión con evidencia real de uso,
// ver definicion-producto-home.md v3), no una constante permanente.
//
// Cada rubro mapea a uno o más slugs reales de Category (prisma/schema.prisma,
// verificado contra dev-promoar el 11/8/2026 — 21 categorías activas). No se
// inventan categorías: todo rubro referencia slugs que existen hoy en la DB.
//
// El orden del array es el orden de aparición en la Home — es una decisión de
// producto (prioridad por necesidad, RFC-007 §5.1 Dimensión A), no una
// consecuencia del ranking (RFC-008 §2.3).

import type { RubroDisplayInfo, RubroId } from './homeDecisionContract'

export interface RubroConfig extends RubroDisplayInfo {
  // Slugs de Category que alimentan este rubro. Usado tanto para filtrar
  // candidatas como para derivar el score de afinidad por defecto (Dimensión A).
  categorySlugs: string[]
}

export const RUBRO_CATALOG: RubroConfig[] = [
  {
    id: 'supermercados',
    label: 'Supermercados',
    icon: '🛒',
    categoryIds: [],
    categorySlugs: ['supermercados'],
  },
  {
    id: 'combustible',
    label: 'Combustible',
    icon: '⛽',
    categoryIds: [],
    categorySlugs: ['combustible'],
  },
  {
    id: 'farmacias',
    label: 'Farmacias',
    icon: '💊',
    categoryIds: [],
    categorySlugs: ['farmacias'],
  },
  {
    id: 'gastronomia',
    label: 'Gastronomía',
    icon: '🍽️',
    categoryIds: [],
    categorySlugs: ['gastronomia'],
  },
  {
    id: 'indumentaria',
    label: 'Indumentaria',
    icon: '👕',
    categoryIds: [],
    categorySlugs: ['indumentaria'],
  },
]

export const RUBRO_IDS: RubroId[] = RUBRO_CATALOG.map(r => r.id)

export function rubroCategorySlugSet(rubro: RubroConfig): Set<string> {
  return new Set(rubro.categorySlugs)
}
