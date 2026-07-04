const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export function activateProfileEmail(
  name?: string | null,
  topPromos?: Array<{ commerce: string; discount: string; entity: string; category: string }>,
): string {
  const firstName = name ? name.split(' ')[0] : null
  const greeting = firstName ? `Hola, ${firstName}` : 'Hola'

  const defaultPromos = [
    { commerce: 'Coto', discount: '30%', entity: 'Banco Galicia', category: 'Supermercados' },
    { commerce: 'YPF', discount: '25%', entity: 'BBVA', category: 'Combustible' },
    { commerce: 'Farmacity', discount: '20%', entity: 'Banco Ciudad', category: 'Farmacias' },
  ]
  const promos = topPromos?.length ? topPromos : defaultPromos

  const promoRows = promos.map(p => `
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 1px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">${p.entity} · ${p.category}</p>
          <p style="margin:0;font-size:15px;font-weight:900;color:#1E3A5F">${p.commerce} <span style="color:#D94F2B">${p.discount} de descuento</span></p>
        </td>
        <td width="60" align="right">
          <span style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;color:#94a3b8">🔒 Tuyo?</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Completá tu perfil — PromoAR</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,95,0.10)">

        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#1E3A5F 0%,#2563a8 100%);padding:28px 36px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:12px">
              <img src="${BASE_URL}/promoar_logo_transparent.png" width="44" height="44" alt="PromoAR" style="display:block;border-radius:8px" />
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px">PromoAR</p>
              <p style="margin:2px 0 0;color:#93b4d4;font-size:12px">Todas las promos de tus tarjetas y bancos</p>
            </td>
          </tr></table>
        </td></tr>

        <!-- HERO -->
        <tr><td style="padding:36px 36px 0">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D94F2B;text-transform:uppercase;letter-spacing:1px">Te estás perdiendo algo importante</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:900;color:#1E3A5F;line-height:1.2;letter-spacing:-0.5px">${greeting}, ¿sabés cuántas promos te aplican a vos?</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.7">
            Ya te registraste en PromoAR, pero todavía no cargaste tu perfil financiero. Sin él, ves <em>todas</em> las promos — pero no sabés cuáles son tuyas.
          </p>
        </td></tr>

        <!-- PROMOS EJEMPLO -->
        <tr><td style="padding:0 36px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;padding:18px 20px;margin-bottom:4px">
            <tr>
              <td style="padding-bottom:12px">
                <p style="margin:0;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Estas promos están activas ahora mismo</p>
              </td>
            </tr>
            ${promoRows}
            <tr>
              <td style="padding-top:14px;text-align:center">
                <p style="margin:0;font-size:12px;color:#94a3b8">¿Alguna de estas es tuya? <strong style="color:#1E3A5F">Solo lo sabés si cargás tu perfil.</strong></p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- BENEFICIOS -->
        <tr><td style="padding:24px 36px 0">
          <p style="margin:0 0 14px;font-size:14px;font-weight:900;color:#1E3A5F">Con tu perfil financiero podés:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              ['🎯', 'Ver solo las promos de tus tarjetas y banco', 'Sin ruido, sin promos que no te sirven'],
              ['📅', 'Filtrar por día de la semana', 'Saber exactamente cuándo conviene ir a cada super'],
              ['⚡', 'Recibir el newsletter personalizado', 'Solo las mejores promos que te aplican a vos'],
            ].map(([icon, title, desc]) => `
            <tr>
              <td style="padding:8px 0">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td width="36" valign="top" style="padding-right:12px">
                    <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:16px">${icon}</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0 0 1px;font-size:13px;font-weight:700;color:#1E3A5F">${title}</p>
                    <p style="margin:0;font-size:12px;color:#94a3b8">${desc}</p>
                  </td>
                </tr></table>
              </td>
            </tr>`).join('')}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:28px 36px 36px" align="center">
          <a href="${BASE_URL}/perfil"
            style="display:inline-block;background:linear-gradient(135deg,#D94F2B,#e8612f);color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.2px">
            Cargar mi perfil ahora →
          </a>
          <p style="margin:14px 0 0;font-size:12px;color:#94a3b8">Tarda menos de 2 minutos · Totalmente gratis</p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#1E3A5F">PromoAR</p>
          <p style="margin:0 0 8px;font-size:11px;color:#94a3b8">
            <a href="https://www.instagram.com/promoar.com.ar" style="color:#1E3A5F;text-decoration:none;margin:0 6px">Instagram</a>·
            <a href="https://www.tiktok.com/@promoar3" style="color:#1E3A5F;text-decoration:none;margin:0 6px">TikTok</a>·
            <a href="https://www.facebook.com/share/1CzCucY74g/" style="color:#1E3A5F;text-decoration:none;margin:0 6px">Facebook</a>
          </p>
          <p style="margin:0;font-size:11px;color:#cbd5e1">Recibís este email porque te registraste en PromoAR.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
