export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { welcomeEmail } from '@/lib/email/welcome'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: token.email as string },
    select: { email: true, name: true },
  })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  await resend.emails.send({
    from: 'PromoAR <noreply@promoar.com.ar>',
    to: user.email,
    subject: '[PREVIEW] Bienvenido a PromoAR',
    html: welcomeEmail(user.name),
  })

  return NextResponse.json({ ok: true })
}
