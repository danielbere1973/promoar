export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { welcomeEmail } from '@/lib/email/welcome'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { email, code, remember } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.verificationCode !== code) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 400 })
    }

    if (user.codeExpires && new Date() > user.codeExpires) {
      return NextResponse.json({ error: 'El código expiró' }, { status: 400 })
    }

    // Marcar email como verificado
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: new Date(),
        verificationCode: null,
        codeExpires: null,
      }
    })

    // Email de bienvenida
    resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: email,
      subject: `¡Bienvenido a PromoAR, ${user.name?.split(' ')[0] || ''}! 🎉`,
      html: welcomeEmail(user.name),
    }).catch(() => {})

    // Si pidió recordar el equipo, generar token de 30 días
    let deviceToken = null
    if (remember) {
      deviceToken = randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      await prisma.trustedDevice.create({
        data: {
          userId: user.id,
          token: deviceToken,
          expiresAt,
        }
      })
    }

    return NextResponse.json({ ok: true, deviceToken })
  } catch (error) {
    console.error('Error en verificacion:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: 'Error al verificar' }, { status: 500 })
  }
}