export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    // LIMPIEZA TOTAL: Forzamos minúsculas y quitamos espacios
    const cleanEmail = email.toLowerCase().trim()

    if (!cleanEmail || !password || password.length < 8) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date(Date.now() + 10 * 60 * 1000)

    // Buscamos si existe con el mail limpio
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } })

    if (existing) {
      if (existing.emailVerified) {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
      }

      await prisma.user.update({
        where: { email: cleanEmail },
        data: { 
          name,
          password: hashed, 
          verificationCode, 
          codeExpires: expires 
        }
      })
    } else {
      await prisma.user.create({
        data: { 
          name, 
          email: cleanEmail, 
          password: hashed,
          verificationCode,
          codeExpires: expires
        }
      })
    }

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: cleanEmail,
      subject: 'Tu código de verificación - PromoAr',
      html: `<p>Hola ${name}, tu código es: <strong>${verificationCode}</strong></p>`
    })

    return NextResponse.json({ ok: true }, { status: 201 })
    
  } catch (error: any) {
    console.error("Error en registro:", error)
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 })
  }
}