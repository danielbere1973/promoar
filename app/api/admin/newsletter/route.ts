export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { emailWrapper } from '@/lib/email/template'

const resend = new Resend(process.env.RESEND_API_KEY)

// GET — lista de suscriptores
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscribers = await prisma.user.findMany({
    where: { newsletterOptIn: true },
    select: { id: true, name: true, email: true, newsletterOptInAt: true, createdAt: true },
    orderBy: { newsletterOptInAt: 'desc' },
  })
  const total = await prisma.user.count()
  const optOut = await prisma.user.count({ where: { newsletterOptIn: false } })

  return NextResponse.json({ subscribers, total, optOut })
}

// POST — enviar newsletter
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, htmlContent, preview } = await req.json()
  if (!subject || !htmlContent) return NextResponse.json({ error: 'Faltan subject o htmlContent' }, { status: 400 })

  // Preview: solo manda al admin
  if (preview) {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true } })
    if (!adminUser) return NextResponse.json({ error: 'No hay admin' }, { status: 500 })
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: adminUser.email,
      subject: `[PREVIEW] ${subject}`,
      html: emailWrapper(htmlContent, adminUser.id),
    })
    return NextResponse.json({ ok: true, sent: 1, mode: 'preview' })
  }

  // Envío real — en lotes de 50 (límite Resend free tier)
  const subscribers = await prisma.user.findMany({
    where: { newsletterOptIn: true },
    select: { id: true, email: true },
  })

  let sent = 0, errors = 0
  const BATCH = 50
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH)
    await Promise.all(batch.map(async (user) => {
      try {
        await resend.emails.send({
          from: 'PromoAR <noreply@promoar.com.ar>',
          to: user.email,
          subject,
          html: emailWrapper(htmlContent, user.id),
        })
        sent++
      } catch {
        errors++
      }
    }))
    // Pequeña pausa entre lotes para no saturar Resend
    if (i + BATCH < subscribers.length) await new Promise(r => setTimeout(r, 1000))
  }

  return NextResponse.json({ ok: true, sent, errors })
}
