const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.promoar.com.ar'

export function welcomeEmail(name?: string | null): string {
  const firstName = name ? name.split(' ')[0] : 'ahorradora'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bienvenido a PromoAR</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,95,0.10)">

        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#1E3A5F 0%,#2563a8 100%);padding:36px 40px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:14px">
              <img src="${BASE_URL}/promoar_logo_transparent.png" width="52" height="52" alt="PromoAR" style="display:block;border-radius:10px" />
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0;color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-1px">PromoAR</p>
              <p style="margin:4px 0 0;color:#93b4d4;font-size:14px;font-weight:400">Todas las promos de tus tarjetas y bancos, en un lugar</p>
            </td>
          </tr></table>
        </td></tr>

        <!-- HERO -->
        <tr><td style="padding:40px 40px 0">
          <p style="margin:0 0 8px;color:#1E3A5F;font-size:24px;font-weight:900;line-height:1.2">¡Hola, ${firstName}! 🎉</p>
          <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7">
            Ya sos parte de PromoAR. Ahora podés ver todos los descuentos, cuotas sin interés y reintegros de tus bancos y billeteras — sin tener que buscar en 20 sitios distintos.
          </p>
        </td></tr>

        <!-- STEPS -->
        <tr><td style="padding:0 40px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;padding:24px;margin-bottom:8px">
            <tr>
              <td width="44" valign="top" style="padding-right:16px">
                <div style="width:40px;height:40px;background:#dbeafe;border-radius:10px;text-align:center;line-height:40px;font-size:20px">👤</div>
              </td>
              <td valign="top">
                <p style="margin:0 0 3px;color:#1E3A5F;font-size:14px;font-weight:700">1. Cargá tu perfil financiero</p>
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5">Indicá qué tarjetas y bancos tenés para ver solo las promos que te aplican.</p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;padding:24px;margin-bottom:8px">
            <tr>
              <td width="44" valign="top" style="padding-right:16px">
                <div style="width:40px;height:40px;background:#dcfce7;border-radius:10px;text-align:center;line-height:40px;font-size:20px">🏷️</div>
              </td>
              <td valign="top">
                <p style="margin:0 0 3px;color:#1E3A5F;font-size:14px;font-weight:700">2. Explorá las promos del día</p>
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5">Descuentos en supermercados, combustible, farmacias, gastronomía y mucho más.</p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;padding:24px;margin-bottom:8px">
            <tr>
              <td width="44" valign="top" style="padding-right:16px">
                <div style="width:40px;height:40px;background:#fef9c3;border-radius:10px;text-align:center;line-height:40px;font-size:20px">⭐</div>
              </td>
              <td valign="top">
                <p style="margin:0 0 3px;color:#1E3A5F;font-size:14px;font-weight:700">3. Guardá tus favoritas</p>
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5">Marcá las promos que más usás para encontrarlas rápido la próxima vez.</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:32px 40px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${BASE_URL}/perfil" style="display:inline-block;background:linear-gradient(135deg,#1E3A5F,#2563a8);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.2px">
                Completar mi perfil →
              </a>
            </td></tr>
            <tr><td align="center" style="padding-top:14px">
              <a href="${BASE_URL}" style="color:#64748b;font-size:13px;text-decoration:none">O explorá las promos ahora →</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center">
          <p style="margin:0 0 6px;color:#1E3A5F;font-size:13px;font-weight:700">PromoAR</p>
          <p style="margin:0 0 10px;font-size:12px;color:#94a3b8">
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
