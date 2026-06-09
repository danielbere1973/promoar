export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    // 1. Generar nuevo código y expiración
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date(Date.now() + 10 * 60 * 1000) 

    // 2. Actualizar el usuario con el nuevo código
    await prisma.user.update({
      where: { email },
      data: { 
        verificationCode,
        codeExpires: expires
      }
    })
    // 3. Enviar el mail
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: email,
      subject: `${verificationCode} es tu código de acceso a PromoAR`,
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="background:#1E3A5F;padding:28px 32px">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px">PromoAR</p>
          <p style="margin:4px 0 0;color:#93b4d4;font-size:13px">Todas las promos de tus tarjetas</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;color:#1E3A5F;font-size:16px;font-weight:700">Nuevo dispositivo detectado</p>
          <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6">Ingresaste desde un dispositivo nuevo. Usá este código para verificar tu identidad:</p>
          <div style="background:#f4f6f8;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px">
            <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:8px;color:#1E3A5F">${verificationCode}</p>
            <p style="margin:8px 0 0;color:#999;font-size:12px">Válido por 10 minutos</p>
          </div>
          <p style="margin:0 0 24px;color:#888;font-size:13px;line-height:1.6">Si no sos vos, cambiá tu contraseña inmediatamente.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px">
          <p style="margin:0;color:#bbb;font-size:11px">PromoAR · promoar.com.ar · noreply@promoar.com.ar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al enviar código' }, { status: 500 })
  }
}