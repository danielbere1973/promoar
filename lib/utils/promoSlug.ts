// lib/utils/promoSlug.ts
// Genera slugs únicos y descriptivos para promos
// Ejemplo: "coto-20pct-reintegro-banco-galicia-sabados"

export function generatePromoSlug(params: {
  storeName: string
  discountValue: number | string
  discountType: string
  bankName?: string | null
  walletName?: string | null
  validDays?: number
  title?: string
}): string {
  const { storeName, discountValue, discountType, bankName, walletName, validDays, title } = params

  const parts: string[] = []

  // 1. Nombre del comercio
  parts.push(slugify(storeName))

  // 2. Descuento
  const val = Number(discountValue)
  if (discountType === 'CUOTAS_SIN_INTERES') {
    parts.push(`${val}csi`)
  } else if (discountType === 'FIXED_AMOUNT') {
    parts.push(`${val}pesos`)
  } else {
    parts.push(`${val}pct`)
    if (discountType === 'PERCENTAGE_REINTEGRO') parts.push('reintegro')
  }

  // 3. Entidad (banco o wallet)
  const entity = bankName || walletName
  if (entity) {
    // Abreviar nombres largos de bancos
    const shortened = entity
      .replace(/Banco\s+de\s+la\s+Naci[oó]n\s+Argentina/i, 'BNA')
      .replace(/Banco\s+de\s+la\s+Provincia\s+de\s+Buenos\s+Aires/i, 'BProvincia')
      .replace(/Banco\s+de\s+Corrientes/i, 'BCorrientes')
      .replace(/Banco\s+/i, '')
      .replace(/\s+S\.?A\.?U?\.?$/i, '')
      .replace(/\s+Cooperativo\s+Limitado/i, '')
    parts.push(slugify(shortened))
  }

  // 4. Días de semana (solo si no es todos los días)
  if (validDays && validDays !== 127) {
    const dayNames = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
    const activeDays = dayNames.filter((_, i) => (validDays & (1 << i)) !== 0)
    if (activeDays.length <= 3) {
      parts.push(activeDays.join('-'))
    } else if (activeDays.length === 2 && (validDays & 1) && (validDays & 64)) {
      parts.push('finde')
    } else if (activeDays.length === 5 && !(validDays & 1) && !(validDays & 64)) {
      parts.push('lun-vie')
    }
  }

  return parts.join('-').slice(0, 120)
}

function slugify(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')   // solo alfanum y espacios
    .trim()
    .replace(/\s+/g, '-')           // espacios → guiones
    .replace(/-+/g, '-')            // múltiples guiones → uno
    .replace(/^-|-$/g, '')          // quitar guiones inicial/final
}

// Garantiza unicidad agregando un sufijo numérico si ya existe el slug
export async function ensureUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
    if (counter > 99) break // safety
  }

  return slug
}
