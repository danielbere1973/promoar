// ADR-001 — resolución centralizada del badge de cobertura geográfica.
// Única fuente de verdad para el texto/color/ícono de cada estado; PromoCard y cualquier
// otro consumidor solo llaman a `resolveCoverageBadge`, nunca reinterpretan coverageStatus
// ni las reglas geográficas del backend (esas viven en lib/getPromos.ts).

export type CoverageStatus = 'NEARBY' | 'TERRITORIAL' | 'ONLINE' | 'UNKNOWN'

export type CoverageBadge = {
  status: Exclude<CoverageStatus, 'UNKNOWN'>
  icon: string
  label: string
  labelMobile: string
  /** Texto para lectores de pantalla — el significado nunca depende solo del color/emoji. */
  ariaLabel: string
  colorClass: string
}

const BASE: Record<Exclude<CoverageStatus, 'UNKNOWN'>, Omit<CoverageBadge, 'status' | 'label' | 'labelMobile' | 'ariaLabel'>> = {
  NEARBY: {
    icon: '📍',
    colorClass: 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40',
  },
  TERRITORIAL: {
    icon: '🗺️',
    colorClass: 'bg-sky-50 dark:bg-sky-900/25 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-700/40',
  },
  ONLINE: {
    icon: '🌐',
    colorClass: 'bg-violet-50 dark:bg-violet-900/25 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-700/40',
  },
}

/**
 * Resuelve el badge a partir del estado ya calculado server-side (`coverageStatus`) y, para
 * TERRITORIAL, del alcance real (`coverageLabel`, ej. "Buenos Aires", "CABA, Santa Fe",
 * "Todo el país") — nunca asume "nacional" por defecto.
 *
 * UNKNOWN devuelve `null`: ausencia de información implica ausencia de elemento visual,
 * nunca un ícono de interrogación ni un badge gris de "sin datos".
 */
export function resolveCoverageBadge(
  status: CoverageStatus | null | undefined,
  coverageLabel?: string | null,
): CoverageBadge | null {
  if (!status || status === 'UNKNOWN') return null

  const base = BASE[status]

  if (status === 'TERRITORIAL') {
    const scope = coverageLabel || 'Cobertura territorial'
    return {
      status,
      ...base,
      label: `Cobertura en ${scope}`,
      labelMobile: scope,
      ariaLabel: `Cobertura geográfica: ${scope}`,
    }
  }

  if (status === 'NEARBY') {
    return {
      status,
      ...base,
      label: 'Cerca tuyo',
      labelMobile: 'Cerca',
      ariaLabel: 'Tenés una sucursal cerca de tu ubicación',
    }
  }

  // ONLINE
  return {
    status,
    ...base,
    label: 'Online',
    labelMobile: 'Online',
    ariaLabel: 'Beneficio online, sin necesidad de sucursal física',
  }
}
