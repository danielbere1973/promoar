// Catálogo de rubros de la Home — RFC-008 §2.3 / definicion-producto-home.md §2.
// Desde CPO Approval "Preferencias → selección personalizada de rubros v2"
// (15/8/2026): RUBRO_CATALOG pasa a representar el UNIVERSO/configuración
// visual de rubros habilitables (10), separado de HOME_RUBRO_COUNT, la
// CANTIDAD mostrada por usuario (N=5, sigue siendo hipótesis de Producto,
// no una constante permanente). HomeRubro.active (DB) es la autoridad de
// habilitación — este catálogo nunca decide por sí solo si un rubro se
// muestra, ver lib/rubroPreferences.ts::getActiveHomeRubroIds.
//
// Cada rubro mapea a uno o más slugs reales de Category (prisma/schema.prisma,
// verificado contra dev-promoar el 11/8/2026 — 21 categorías activas). No se
// inventan categorías: todo rubro referencia slugs que existen hoy en la DB.
// Las 5 nuevas (transporte, tecnologia, hogar, salud-y-belleza,
// viajes-y-turismo) fueron elegidas por tener ya señal de prioridad de
// producto preexistente en el código (PRIORITY_CAT_SLUGS en
// app/promos/page.tsx, NECESIDAD_ALTA/NECESIDAD_MEDIA en decisionEngineV2.ts)
// y por cubrir perfiles de gasto distintos entre sí (recurrente diario, alto
// ticket ocasional, aspiracional) — ver propuesta-tecnica-preferencias-rubro-home-v2.md §1.
//
// El orden del array es el orden de aparición en la Home para un usuario sin
// preferencias declaradas, y también el criterio de desempate estable entre
// varias preferencias declaradas (ver rubroPreferences.ts::selectRubrosForHome)
// — es una decisión de producto (prioridad por necesidad, RFC-007 §5.1
// Dimensión A), no una consecuencia del ranking (RFC-008 §2.3).
//
// Ampliación 10 → 18 (CPO Approval "Ampliación de Universo de Rubros",
// 21/8/2026, en respuesta a hallazgo CTO sobre categorías faltantes): el
// universo pasa a cubrir todas las categorías activas de PromoAR salvo
// "Otros" y "Sin Categoría" — directiva explícita de Pablo (CEO/CPO), no
// heurística de código. El approval original habla de "17" (recuento
// aproximado); el conteo real contra prisma/seed.ts da 18 categorías activas
// (20 filas totales - Otros - Sin Categoría), notificado a CPO como
// corrección aritmética junto con la entrega de este gate. Los 8 agregados:
// mascotas (categoría "Mascotas", llamada "Petshops" en referencias
// históricas de CLAUDE.md — el slug real en Category/seed.ts es 'mascotas'),
// heladerias, entretenimiento, deportes, jugueterias, librerias, shoppings,
// automotores. HOME_RUBRO_COUNT (cantidad mostrada por usuario) no cambia —
// sigue en 5, independiente del tamaño del universo seleccionable.

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
  {
    id: 'transporte',
    label: 'Transporte',
    icon: '🚌',
    categoryIds: [],
    categorySlugs: ['transporte'],
  },
  {
    id: 'tecnologia',
    label: 'Tecnología',
    icon: '💻',
    categoryIds: [],
    categorySlugs: ['tecnologia'],
  },
  {
    id: 'hogar',
    label: 'Hogar',
    icon: '🏠',
    categoryIds: [],
    categorySlugs: ['hogar'],
  },
  {
    id: 'salud-y-belleza',
    label: 'Salud y Belleza',
    icon: '💄',
    categoryIds: [],
    categorySlugs: ['salud-y-belleza'],
  },
  {
    id: 'viajes-y-turismo',
    label: 'Viajes y Turismo',
    icon: '✈️',
    categoryIds: [],
    categorySlugs: ['viajes-y-turismo'],
  },
  {
    id: 'mascotas',
    label: 'Mascotas',
    icon: '🐾',
    categoryIds: [],
    categorySlugs: ['mascotas'],
  },
  {
    id: 'heladerias',
    label: 'Heladerías',
    icon: '🍦',
    categoryIds: [],
    categorySlugs: ['heladerias'],
  },
  {
    id: 'entretenimiento',
    label: 'Entretenimiento',
    icon: '🎭',
    categoryIds: [],
    categorySlugs: ['entretenimiento'],
  },
  {
    id: 'deportes',
    label: 'Deportes',
    icon: '⚽',
    categoryIds: [],
    categorySlugs: ['deportes'],
  },
  {
    id: 'jugueterias',
    label: 'Jugueterías',
    icon: '🧸',
    categoryIds: [],
    categorySlugs: ['jugueterias'],
  },
  {
    id: 'librerias',
    label: 'Librerías',
    icon: '📚',
    categoryIds: [],
    categorySlugs: ['librerias'],
  },
  {
    id: 'shoppings',
    label: 'Shoppings',
    icon: '🛍️',
    categoryIds: [],
    categorySlugs: ['shoppings'],
  },
  {
    id: 'automotores',
    label: 'Automotores',
    icon: '🚗',
    categoryIds: [],
    categorySlugs: ['automotores'],
  },
]

// N=5 — cantidad de rubros mostrados en la Home por usuario. Hipótesis de
// Producto (definicion-producto-home.md v3), no una constante permanente.
// Independiente de RUBRO_CATALOG.length (universo=10) desde CPO Approval v2.
export const HOME_RUBRO_COUNT = 5

export const RUBRO_IDS: RubroId[] = RUBRO_CATALOG.map(r => r.id)

export function rubroCategorySlugSet(rubro: RubroConfig): Set<string> {
  return new Set(rubro.categorySlugs)
}
