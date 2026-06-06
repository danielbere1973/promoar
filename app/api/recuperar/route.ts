export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
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

    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: email,
      subject: 'Recuperá tu contraseña - PromoAR',
      html: `
        <p>Hola ${user.name},</p>
        <p>Hacé click en el siguiente link para restablecer tu contraseña:</p>
        <a href="${process.env.NEXTAUTH_URL}/nueva-password?token=${token}&email=${email}">
          Restablecer contraseña
        </a>
        <p>El link expira en 1 hora.</p>
      `
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en recuperar:', error)
    return NextResponse.json({ error: 'Error al enviar el mail' }, { status: 500 })
  }
}