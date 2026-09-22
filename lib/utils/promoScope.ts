export type ScopeType =
  | 'PRODUCT'
  | 'DESTINATION'
  | 'TIME'
  | 'SUBSCRIPTION'
  | 'NEW_USER'
  | 'PROGRAM'
  | 'COUPON'
  | 'LIMIT'

export interface PromoScope {
  type: ScopeType
  badgeText: string
  badgeIcon: string
  fullWarning: string
}

export function getPromoScope(promo: {
  title?: string | null
  description?: string | null
  sourceText?: string | null
  commerceNote?: string | null
  validFromHour?: number | null
  validToHour?: number | null
  commerce?: { name?: string | null } | null
  requirements?: Array<{
    note?: string | null
    segment?: string | null
    discountValue?: number | null
  }>
}): PromoScope | null {
  const commerceNote = promo.commerceNote || ''
  const commerceName = promo.commerce?.name || ''
  const reqNotes = (promo.requirements || []).map(r => r.note || '').join(' ')
  const reqSegments = (promo.requirements || []).map(r => r.segment || '').join(' ')
  const reqEntities = (promo.requirements || []).map(r => `${(r as any).bank?.name || ''} ${(r as any).wallet?.name || ''}`).join(' ')
  const title = promo.title || ''
  const description = promo.description || ''
  const sourceText = promo.sourceText || ''

  const combined = `${commerceNote} ${commerceName} ${reqEntities} ${reqNotes} ${reqSegments} ${title} ${description} ${sourceText}`.toLowerCase()

  // 1. VIAJE ESPECÍFICO / DESTINO (Ezeiza, aeropuertos)
  if (/\b(ezeiza|aeropuerto|aeroparque)\b/i.test(combined)) {
    const isEzeiza = /\bezeiza\b/i.test(combined);
    return {
      type: 'DESTINATION',
      badgeIcon: '✈️',
      badgeText: isEzeiza ? 'Solo a/desde Ezeiza' : 'Solo a/desde Aeropuertos',
      fullWarning: isEzeiza
        ? 'Válido exclusivamente para viajes con origen o destino en el Aeropuerto de Ezeiza.'
        : 'Válido exclusivamente para viajes con origen o destino en aeropuertos de la República Argentina.',
    }
  }

  // 2. FRANJA HORARIA RESTRINGIDA
  if (promo.validFromHour != null && promo.validToHour != null) {
    return {
      type: 'TIME',
      badgeIcon: '⏰',
      badgeText: `De ${promo.validFromHour} a ${promo.validToHour} hs`,
      fullWarning: `Promoción por tiempo limitado: aplica únicamente entre las ${promo.validFromHour}:00 y las ${promo.validToHour}:00 hs.`,
    }
  }
  const timeMatch = combined.match(/\bde\s+([012]?\d)(?::[0-5]\d)?\s*(?:hs|horas|am|pm)?\s+a\s+([012]?\d)(?::[0-5]\d)?\s*(?:hs|horas|am|pm)\b/i)
    || combined.match(/\b([012]?\d)\s*a\s*([012]?\d)\s*(?:hs|horas)\b/i)
    || (/cabify/i.test(combined) ? combined.match(/\bde\s+([012]?\d)\s+a\s+([012]?\d)\b/i) : null)
  if (timeMatch && !/\b(?:cuotas|pagos|meses|d[ií]as)\b/i.test(combined.slice(combined.indexOf(timeMatch[0]), combined.indexOf(timeMatch[0]) + 30))) {
    const fromH = parseInt(timeMatch[1])
    const toH = parseInt(timeMatch[2])
    if (fromH <= 24 && toH <= 24) {
      return {
        type: 'TIME',
        badgeIcon: '⏰',
        badgeText: `De ${fromH} a ${toH} hs`,
        fullWarning: `Promoción restringida por horario: aplica únicamente de ${fromH}:00 a ${toH}:00 hs.`,
      }
    }
  }

  // 3. SUSCRIPCIÓN / MEMBRESÍA (PedidosYa Plus, abonos)
  if (/\b(pedidos\s*ya\s*plus|pedidosya\+|suscripci[oó]n|abono\s+mensual)\b/i.test(combined)) {
    return {
      type: 'SUBSCRIPTION',
      badgeIcon: '📦',
      badgeText: 'Solo suscripción Plus',
      fullWarning: 'Aplica únicamente al costo de la suscripción mensual (no a pedidos ni consumos de comida).',
    }
  }

  // 4. SOLO USUARIOS NUEVOS / PRIMERA COMPRA
  if (/\b(usuarios?\s+nuevos?|primer(?:a|)\s+compra|primer\s+viaje|primer\s+pedido|sin\s+viajes|primera\s+vez)\b/i.test(combined)) {
    return {
      type: 'NEW_USER',
      badgeIcon: '👤',
      badgeText: 'Solo 1ra compra / nuevo usuario',
      fullWarning: 'Válido exclusivamente para usuarios nuevos o que realizan su primera operación con el medio de pago.',
    }
  }

  // 5. PROGRAMA EXCLUSIVO / CLUB / PLAN SUELDO
  if (
    /sorpresa\s+santander/i.test(combined) ||
    (/santander/i.test(combined) && /(transporte|subte|colectivo)/i.test(combined) && (/(?:hasta\s+)?100%/i.test(title) || (promo.requirements || []).some(r => (r.discountValue ?? 0) >= 100)))
  ) {
    return {
      type: 'PROGRAM',
      badgeIcon: '⭐',
      badgeText: 'Sorpresa Santander',
      fullWarning: 'Beneficio de hasta 100% exclusivo para clientes adheridos al programa Sorpresa Santander (50% sin Sorpresa).',
    }
  }
  if (/macro\s+selecta|\bselecta\b/i.test(reqSegments) || /macro\s+selecta/i.test(title)) {
    return {
      type: 'PROGRAM',
      badgeIcon: '💎',
      badgeText: 'Macro Selecta',
      fullWarning: 'Beneficio exclusivo para clientes de cartera Macro Selecta.',
    }
  }
  if (/galicia\s+[eé]minent|\b[eé]minent\b/i.test(reqSegments) || /[eé]minent/i.test(title)) {
    return {
      type: 'PROGRAM',
      badgeIcon: '💎',
      badgeText: 'Galicia Éminent',
      fullWarning: 'Beneficio exclusivo para clientes Galicia Éminent.',
    }
  }
  if (/patagonia\s+singular|\bsingular\b/i.test(reqSegments) || /singular/i.test(title)) {
    return {
      type: 'PROGRAM',
      badgeIcon: '💎',
      badgeText: 'Patagonia Singular',
      fullWarning: 'Beneficio exclusivo para clientes Patagonia Singular.',
    }
  }
  if (/patagonia\s+plus/i.test(reqSegments) || /patagonia\s+plus/i.test(title)) {
    return {
      type: 'PROGRAM',
      badgeIcon: '⭐',
      badgeText: 'Patagonia Plus',
      fullWarning: 'Beneficio para clientes con paquete Patagonia Plus.',
    }
  }
  if (/365\s+plus/i.test(combined)) {
    return {
      type: 'PROGRAM',
      badgeIcon: '⭐',
      badgeText: 'Clarín 365 Plus',
      fullWarning: 'Exclusivo para suscriptores con tarjeta Clarín 365 Plus.',
    }
  }
  if (/\b(plan\s+sueldo|cuenta\s+sueldo|cobro\s+de\s+haberes|acreditaci[oó]n\s+de\s+haberes)\b/i.test(combined)) {
    return {
      type: 'PROGRAM',
      badgeIcon: '💼',
      badgeText: 'Solo Plan Sueldo',
      fullWarning: 'Requiere acreditación de haberes / cuenta sueldo en la entidad financiera.',
    }
  }

  // 6. REQUIERE CUPÓN O CÓDIGO OBLIGATORIO
  const codeMatch = combined.match(/\bc[oó]digo\s+([A-Z0-9]{4,12})\b/i)
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase()
    return {
      type: 'COUPON',
      badgeIcon: '🏷️',
      badgeText: `Código: ${code}`,
      fullWarning: `Requiere ingresar el código de descuento "${code}" en la aplicación antes de abonar.`,
    }
  }

  // 7. PRODUCTO O COMBO ESPECÍFICO (Personal Pay y bancos con productos puntuales)
  // Check if commerceNote or reqNotes contains "Solo en:", "Aplica a:", etc.
  const noteTarget = commerceNote || reqNotes
  if (noteTarget && /(?:solo en|aplica a|v[aá]lido en):?\s*([^,.;\n]+)/i.test(noteTarget)) {
    const match = noteTarget.match(/(?:solo en|aplica a|v[aá]lido en):?\s*([^,.;\n]+)/i)
    const target = match ? match[1].trim() : ''
    if (!/total\s+de\s+la\s+(?:compra|cuenta)/i.test(target) && target.length > 2) {
      return {
        type: 'PRODUCT',
        badgeIcon: '🎯',
        badgeText: `Solo en ${target.slice(0, 24)}`,
        fullWarning: `Esta promoción no aplica a toda la tienda. Es válida exclusivamente para: ${target}.`,
      }
    }
  }

  // Check parenthetical product in title: e.g. "40% de descuento – Mostaza (Sundae Dulce de Leche)"
  const titleParenMatch = title.match(/\(([^)]+)\)$/)
  if (titleParenMatch) {
    const rawVariant = titleParenMatch[1].trim()
    const isIgnoredVariant = /^(debito|credito|visa|master|mastercard|amex|selecta|eminent|plus|singular|general|proximamente|próximamente)$/i.test(rawVariant)
    const isFullStore = /total\s+de\s+la\s+(?:compra|cuenta)/i.test(rawVariant)
    if (!isIgnoredVariant && !isFullStore && rawVariant.length > 2) {
      return {
        type: 'PRODUCT',
        badgeIcon: '🎯',
        badgeText: `Solo ${rawVariant.slice(0, 22)}`,
        fullWarning: `Esta promoción aplica únicamente al producto: ${rawVariant}. No es válida para el resto del local.`,
      }
    }
  }

  // Generic "productos seleccionados"
  if (/\bproductos?\s+seleccionados?\b/i.test(combined)) {
    return {
      type: 'PRODUCT',
      badgeIcon: '🎯',
      badgeText: 'Productos seleccionados',
      fullWarning: 'Válido exclusivamente en artículos o productos seleccionados identificados por el comercio.',
    }
  }

  // Extraer producto específico vinculado al descuento en sourceText o description (ej: Clarín 365, KFC, Mostaza)
  const pctFromTitle = title.match(/(\d+)\s*%/);
  const discountVal = promo.requirements?.[0]?.discountValue ?? (pctFromTitle ? parseInt(pctFromTitle[1]) : null);
  if (discountVal && (sourceText || description)) {
    const prodRegex = new RegExp(`(?:${discountVal}%|${discountVal}\\s*%)[^,.;\\n]*?\\s+(?:en|para)\\s+([^,.;\\n]+)`, 'i');
    const m = sourceText.match(prodRegex) || description.match(prodRegex);
    if (m) {
      let prod = m[1].replace(/^(?:los|las|el|la)\s+/i, '').trim();
      prod = prod.split(/\.\s*cup[oó]n/i)[0].trim();
      const rawStore = title.replace(/^\d+%\s*(?:de\s+)?(?:descuento|reintegro)\s*–\s*/i, '').trim();
      const isStoreName = prod.toLowerCase() === rawStore.toLowerCase() || rawStore.toLowerCase().startsWith(prod.toLowerCase());
      if (!isStoreName && !/total\s+de\s+la\s+(?:compra|cuenta)/i.test(prod) && !/locales|sucursales|comercios|todos/i.test(prod) && prod.length > 2 && prod.length < 45) {
        return {
          type: 'PRODUCT',
          badgeIcon: '🎯',
          badgeText: `Solo en ${prod.slice(0, 24)}`,
          fullWarning: `Esta promoción aplica exclusivamente para: ${prod}. Válida según condiciones del comercio.`,
        };
      }
    }
  }

  // 8. TOPE POR VIAJE / POR COMPRA O LÍMITE DE VIAJES
  const ridesMatch = combined.match(/\b(?:hasta|m[aá]ximo)\s+(\d+)\s+viajes\b/i) || combined.match(/\b(\d+)\s+viajes\b/i);
  if (ridesMatch) {
    return {
      type: 'LIMIT',
      badgeIcon: '🚗',
      badgeText: `Hasta ${ridesMatch[1]} viajes`,
      fullWarning: `Beneficio limitado a un máximo de ${ridesMatch[1]} viajes por usuario.`,
    };
  }
  if (/\bpor\s+viaje\b/i.test(combined)) {
    return {
      type: 'LIMIT',
      badgeIcon: '🚗',
      badgeText: 'Tope por viaje',
      fullWarning: 'El tope de reintegro aplica por cada viaje individual y no sobre el total acumulado.',
    }
  }

  return null
}
