// Adaptador de presentación — RFC-008 §2.5: el mapeo Reason código→texto no
// vive en el motor (lib/decisionEngineV2.ts), vive acá. Genera el campo de
// transición/compatibilidad `reasonsText` a partir de `Reason[]` estructurado
// para consumidores que todavía no migraron a los códigos. Eliminar este
// adaptador (y el campo) cuando la Home consuma `reasons` directamente.

import type { Reason } from './homeDecisionContract'

export function reasonToText(reason: Reason): string {
  switch (reason.code) {
    case 'mayor_ahorro': return 'Es el mayor ahorro para tus tarjetas'
    case 'afinidad_declarada': return 'Elegiste esta categoría como prioritaria'
    case 'coincide_gasto_habitual': return 'Es un gasto habitual para vos'
    case 'afinidad_inferida': return 'Sueles usar promos de esta categoría'
    case 'cercania': {
      const p = reason.params ?? {}
      const label = p.metros != null ? `${p.metros} metros` : `${p.km} km`
      return `Está a ${label} tuyo`
    }
    case 'vence_pronto': return 'Vence pronto'
    case 'valido_hoy': return 'Válido hoy'
    case 'disponible_online': return 'Podés usarla ahora mismo, sin moverte'
    case 'favorito': return 'La guardaste como favorita'
    case 'oportunidad_infrecuente': return 'Es una oportunidad poco frecuente'
    case 'maximiza_ahorro_mensual': return 'Maximiza tu ahorro del mes'
    default: return 'Compatible con tu banco principal'
  }
}

export function reasonsToText(reasons: Reason[]): string[] {
  return reasons.map(reasonToText)
}
