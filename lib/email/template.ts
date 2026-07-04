import jwt from 'jsonwebtoken'

const SECRET = process.env.NEXTAUTH_SECRET || 'promoar-newsletter-secret'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export function generateUnsubscribeToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'unsubscribe' }, SECRET, { expiresIn: '90d' })
}

export function unsubscribeUrl(userId: string): string {
  const token = generateUnsubscribeToken(userId)
  return `${BASE_URL}/api/newsletter/unsubscribe?token=${token}`
}

export function emailFooter(userId: string): string {
  const unsub = unsubscribeUrl(userId)
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;margin-top:32px;padding-top:24px">
      <tr><td align="center" style="padding:0 32px 24px">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1E3A5F">PromoAR</p>
        <p style="margin:0 0 8px;font-size:12px;color:#888">
          🌐 <a href="${BASE_URL}" style="color:#1E3A5F;text-decoration:none">${BASE_URL}</a>
        </p>
        <p style="margin:0 0 12px;font-size:12px;color:#888">
          <a href="https://www.instagram.com/promoar.com.ar" style="color:#1E3A5F;text-decoration:none;margin-right:12px">Instagram</a>
          <a href="https://www.facebook.com/share/1CzCucY74g/" style="color:#1E3A5F;text-decoration:none;margin-right:12px">Facebook</a>
          <a href="https://www.tiktok.com/@promoar3" style="color:#1E3A5F;text-decoration:none">TikTok</a>
        </p>
        <p style="margin:0;font-size:11px;color:#bbb">
          Recibís este email porque te suscribiste a PromoAR.<br>
          <a href="${unsub}" style="color:#bbb;text-decoration:underline">Cancelar suscripción</a>
        </p>
      </td></tr>
    </table>
  `
}

export function emailWrapper(content: string, userId: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);max-width:100%">
        <tr><td style="background:#1E3A5F;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:12px">
              <img src="${BASE_URL}/promoar_logo_transparent.png" width="48" height="48" alt="PromoAR" style="display:block;border-radius:8px" />
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px">PromoAR</p>
              <p style="margin:2px 0 0;color:#93b4d4;font-size:13px">Ahorrá en cada compra con tus tarjetas y bancos</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px">
          ${content}
          ${emailFooter(userId)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
