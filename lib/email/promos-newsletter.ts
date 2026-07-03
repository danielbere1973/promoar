const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

function discountLabel(discountType: string, discountValue: number): string {
  switch (discountType) {
    case 'PERCENTAGE_REINTEGRO':   return `${discountValue}% reintegro`
    case 'PERCENTAGE_DESCUENTO':   return `${discountValue}% descuento`
    case 'CUOTAS_SIN_INTERES':     return `${discountValue} cuotas sin interés`
    case 'BONIFICACION':           return `${discountValue}% bonificación`
    case 'FIXED_AMOUNT':           return `$${discountValue} de descuento`
    case 'NXM':                    return `${discountValue}x1`
    default: return `${discountValue}%`
  }
}

const CARD_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PERCENTAGE_DESCUENTO:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#059669' },
  PERCENTAGE_REINTEGRO:  { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' },
  CUOTAS_SIN_INTERES:    { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  BONIFICACION:          { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  default:               { bg: '#f8fafc', border: '#e2e8f0', text: '#475569' },
}

export interface PromoForEmail {
  title: string
  slug: string | null
  commerceName: string
  commerceLogo: string | null
  categoryName: string
  discountType: string
  discountValue: number
  entityName: string
  validDays: number | null
  validUntil: Date | null
  hasCap: boolean
}

function daysChip(validDays: number | null): string {
  if (!validDays || validDays === 127) return ''
  const names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const bits  = [1, 2, 4, 8, 16, 32, 64]
  const active = names.filter((_, i) => (validDays & bits[i]) !== 0)
  if (active.length === 0) return ''
  const label = active.join(' · ')
  return `<span style="display:inline-block;font-size:10px;font-weight:700;color:#888;background:#f1f5f9;border-radius:4px;padding:2px 6px;margin-bottom:8px">📅 ${label}</span>`
}

function promoCard(p: PromoForEmail, last = false): string {
  const colors = CARD_COLORS[p.discountType] || CARD_COLORS.default
  const label = discountLabel(p.discountType, p.discountValue)
  const url = p.slug ? `${BASE_URL}/promos/${p.slug}` : BASE_URL
  const days = daysChip(p.validDays)

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:${colors.bg};border:1px solid ${colors.border};border-radius:12px;margin-bottom:${last ? '24' : '12'}px">
  <tr>
    <td style="padding:14px 18px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 1px;font-size:10px;font-weight:700;color:${colors.text};text-transform:uppercase;letter-spacing:0.5px">${p.entityName} · ${p.categoryName}</p>
            <p style="margin:0 0 2px;font-size:16px;font-weight:900;color:#1E3A5F;line-height:1.2">${p.commerceName}</p>
            <p style="margin:0 0 6px;font-size:20px;font-weight:900;color:${colors.text}">${label}</p>
            ${days}
            ${p.hasCap ? '<p style="margin:0 0 6px;font-size:10px;color:#aaa">Tiene tope</p>' : ''}
          </td>
          ${p.commerceLogo ? `
          <td width="44" style="vertical-align:top;padding-left:10px">
            <img src="${p.commerceLogo}" width="36" height="36" alt="${p.commerceName}" style="border-radius:8px;object-fit:contain;border:1px solid #e5e7eb;background:#fff;display:block" />
          </td>` : ''}
        </tr>
      </table>
      <a href="${url}" style="display:inline-block;background:#1E3A5F;color:#fff;font-size:11px;font-weight:700;padding:7px 14px;border-radius:7px;text-decoration:none">Ver promo →</a>
    </td>
  </tr>
</table>`
}

function noProfileBanner(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:20px">
  <tr>
    <td style="padding:14px 18px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e">💡 Promos más populares de la semana</p>
      <p style="margin:0 0 10px;font-size:12px;color:#b45309">Cargá tu perfil financiero y te mostramos solo las que aplican a tus tarjetas y banco.</p>
      <a href="${BASE_URL}/perfil" style="display:inline-block;background:#92400e;color:#fff;font-size:11px;font-weight:700;padding:7px 14px;border-radius:7px;text-decoration:none">Cargar mi perfil</a>
    </td>
  </tr>
</table>`
}

function ctaBlock(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1E3A5F;border-radius:12px">
  <tr>
    <td style="padding:18px 22px" align="center">
      <p style="margin:0 0 10px;color:#93b4d4;font-size:13px">¿Querés ver todas las promos disponibles?</p>
      <a href="${BASE_URL}/promos" style="display:inline-block;background:#fff;color:#1E3A5F;font-size:13px;font-weight:900;padding:10px 24px;border-radius:8px;text-decoration:none">Ver todas las promos</a>
    </td>
  </tr>
</table>`
}

export function personalizedPromoEmail(
  firstName: string | null,
  promos: PromoForEmail[],
  hasProfile: boolean,
  subject: string,
  intro?: string,
): string {
  const greeting = firstName ? `Hola ${firstName}` : 'Hola'
  const cards = promos.map((p, i) => promoCard(p, i === promos.length - 1)).join('')

  return `
<h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#1E3A5F;letter-spacing:-0.5px">${greeting} 👋</h2>
<p style="margin:0 0 20px;font-size:14px;color:#888">${intro || subject}</p>
${!hasProfile ? noProfileBanner() : ''}
${cards}
${ctaBlock()}`
}

export function byDayPromoEmail(
  firstName: string | null,
  grouped: { dayLabel: string; promos: PromoForEmail[] }[],
  hasProfile: boolean,
  subject: string,
  intro?: string,
): string {
  const greeting = firstName ? `Hola ${firstName}` : 'Hola'

  const sections = grouped.map(({ dayLabel, promos }) => {
    const rows = promos.slice(0, 3).map(p => {
      const colors = CARD_COLORS[p.discountType] || CARD_COLORS.default
      const label = discountLabel(p.discountType, p.discountValue)
      const url = p.slug ? `${BASE_URL}/promos/${p.slug}` : BASE_URL
      return `
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 1px;font-size:10px;font-weight:700;color:#888">${p.entityName}</p>
          <p style="margin:0;font-size:14px;font-weight:900;color:#1E3A5F">${p.commerceName} <span style="color:${colors.text}">${label}</span></p>
        </td>
        <td width="80" align="right">
          <a href="${url}" style="font-size:11px;font-weight:700;color:#1E3A5F;text-decoration:none;white-space:nowrap">Ver →</a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
  <tr>
    <td style="padding:0 0 6px">
      <p style="margin:0;font-size:13px;font-weight:900;color:#1E3A5F;border-left:3px solid #1E3A5F;padding-left:8px">${dayLabel}</p>
    </td>
  </tr>
  ${rows}
</table>`
  }).join('')

  const empty = grouped.length === 0 ? `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;margin-bottom:20px">
  <tr><td style="padding:24px;text-align:center;color:#888;font-size:13px">No encontramos promos de supermercados para tus tarjetas esta semana.</td></tr>
</table>` : ''

  return `
<h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#1E3A5F;letter-spacing:-0.5px">${greeting} 👋</h2>
<p style="margin:0 0 20px;font-size:14px;color:#888">${intro || subject}</p>
${!hasProfile ? noProfileBanner() : ''}
${empty}
${sections}
${ctaBlock()}`
}
