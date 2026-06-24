export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { email } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })

    // Siempre respondemos OK aunque el usuario no exista (seguridad)
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const token = randomUUID()
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await prisma.user.update({
      where: { email },
      data: {
        verificationCode: token,
        codeExpires: expires,
      }
    })

    const resetUrl = `${process.env.NEXTAUTH_URL}/nueva-password?token=${token}&email=${encodeURIComponent(email)}`
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: email,
      subject: 'Restablecé tu contraseña de PromoAR',
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
          <p style="margin:0 0 8px;color:#1E3A5F;font-size:16px;font-weight:700">Hola${user.name ? ` ${user.name.split(' ')[0]}` : ''}!</p>
          <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé click en el botón para continuar:</p>
          <div style="text-align:center;margin:0 0 24px">
            <a href="${resetUrl}" style="display:inline-block;background:#D94F2B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700">Restablecer contraseña</a>
          </div>
          <p style="margin:0 0 24px;color:#888;font-size:13px;line-height:1.6">El link expira en <strong>1 hora</strong>. Si no solicitaste cambiar tu contraseña, podés ignorar este mensaje.</p>
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
    console.error('Error en recuperar:', error)
    return NextResponse.json({ error: 'Error al enviar el mail' }, { status: 500 })
  }
}