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
console.log("Generando código para login:", verificationCode);
    // 3. Enviar el mail
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: email,
      subject: 'Tu código de acceso - PromoAr',
      html: `<p>Detectamos un ingreso desde un nuevo dispositivo. Tu código es: <strong>${verificationCode}</strong></p>`
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al enviar código' }, { status: 500 })
  }
}