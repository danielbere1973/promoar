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

const CARD_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  PERCENTAGE_DESCUENTO:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#059669', badge: '#dcfce7' },
  PERCENTAGE_REINTEGRO:  { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', badge: '#ffedd5' },
  CUOTAS_SIN_INTERES:    { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', badge: '#dbeafe' },
  BONIFICACION:          { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed', badge: '#f3e8ff' },
  default:               { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', badge: '#f1f5f9' },
}

interface PromoForEmail {
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

function daysLabel(mask: number | null): string | null {
  if (!mask || mask === 127) return null
  if (mask === 65) return 'sáb y dom'
  if (mask === 96) return 'vie y sáb'
  if (mask === 62) return 'lun a vie'
  if (mask === 97) return 'vie, sáb y dom'
  return null
}

function promoCard(p: PromoForEmail, index: number): string {
  const colors = CARD_COLORS[p.discountType] || CARD_COLORS.default
  const label = discountLabel(p.discountType, p.discountValue)
  const days = daysLabel(p.validDays)
  const url = p.slug ? `${BASE_URL}/promos/${p.slug}` : BASE_URL

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:${colors.bg};border:1px solid ${colors.border};border-radius:12px;margin-bottom:${index < 2 ? '12px' : '24px'}">
  <tr>
    <td style="padding:16px 20px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${colors.text};text-transform:uppercase;letter-spacing:0.5px">${p.entityName} · ${p.categoryName}</p>
            <p style="margin:0 0 2px;font-size:17px;font-weight:900;color:#1E3A5F;line-height:1.2">${p.commerceName}</p>
            <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:${colors.text}">${label}</p>
            ${days ? `<p style="margin:0 0 8px;font-size:11px;color:#888">📅 Válido ${days}${p.hasCap ? ' · tiene tope' : ''}</p>` : (p.hasCap ? `<p style="margin:0 0 8px;font-size:11px;color:#888">Tiene tope</p>` : '')}
          </td>
          ${p.commerceLogo ? `
          <td width="48" style="vertical-align:top;padding-left:12px">
            <img src="${p.commerceLogo}" width="40" height="40" alt="${p.commerceName}" style="border-radius:8px;object-fit:contain;border:1px solid #e5e7eb;background:#fff;display:block" />
          </td>` : ''}
        </tr>
      </table>
      <a href="${url}" style="display:inline-block;background:#1E3A5F;color:#fff;font-size:12px;font-weight:700;padding:8px 16px;border-radius:8px;text-decoration:none;margin-top:4px">Ver promo →</a>
    </td>
  </tr>
</table>`
}

export function personalizedPromoEmail(
  firstName: string | null,
  promos: PromoForEmail[],
  hasProfile: boolean,
  subject: string,
): string {
  const greeting = firstName ? `Hola ${firstName}` : 'Hola'

  const promoCards = promos.map((p, i) => promoCard(p, i)).join('')

  const noProfileBanner = !hasProfile ? `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:20px">
  <tr>
    <td style="padding:14px 18px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e">💡 Estas son las promos más populares de la semana</p>
      <p style="margin:0;font-size:12px;color:#b45309">Cargá tu perfil financiero y te mostramos solo las que aplican a tus tarjetas y banco.</p>
      <a href="${BASE_URL}/perfil" style="display:inline-block;margin-top:10px;background:#92400e;color:#fff;font-size:11px;font-weight:700;padding:7px 14px;border-radius:7px;text-decoration:none">Cargar mi perfil</a>
    </td>
  </tr>
</table>` : ''

  return `
<h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#1E3A5F;letter-spacing:-0.5px">${greeting} 👋</h2>
<p style="margin:0 0 20px;font-size:14px;color:#888">${subject}</p>

${noProfileBanner}

${promoCards}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#1E3A5F;border-radius:12px">
  <tr>
    <td style="padding:20px 24px" align="center">
      <p style="margin:0 0 12px;color:#93b4d4;font-size:13px">¿Querés ver todas las promos disponibles?</p>
      <a href="${BASE_URL}/promos" style="display:inline-block;background:#fff;color:#1E3A5F;font-size:13px;font-weight:900;padding:10px 24px;border-radius:8px;text-decoration:none">Ver todas las promos</a>
    </td>
  </tr>
</table>`
}

export type { PromoForEmail }
