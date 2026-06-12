export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Completá todos los campos' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeMessage = escapeHtml(message)

    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: 'contacto@promoar.com.ar',
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${name}`,
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="background:#1E3A5F;padding:28px 32px">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px">PromoAR</p>
          <p style="margin:4px 0 0;color:#93b4d4;font-size:13px">Nuevo mensaje desde el formulario de contacto</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 4px;color:#999;font-size:12px;font-weight:700;text-transform:uppercase">Nombre</p>
          <p style="margin:0 0 16px;color:#1E3A5F;font-size:15px;font-weight:700">${safeName}</p>
          <p style="margin:0 0 4px;color:#999;font-size:12px;font-weight:700;text-transform:uppercase">Email</p>
          <p style="margin:0 0 16px;color:#1E3A5F;font-size:15px;font-weight:700">${safeEmail}</p>
          <p style="margin:0 0 4px;color:#999;font-size:12px;font-weight:700;text-transform:uppercase">Mensaje</p>
          <div style="background:#f4f6f8;border-radius:12px;padding:16px;margin:0 0 8px">
            <p style="margin:0;color:#333;font-size:14px;line-height:1.6;white-space:pre-wrap">${safeMessage}</p>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="margin:0;color:#bbb;font-size:11px">PromoAR · promoar.com.ar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en contacto:', error)
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 })
  }
}
