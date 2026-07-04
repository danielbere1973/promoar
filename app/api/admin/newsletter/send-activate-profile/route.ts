export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { activateProfileEmail } from '@/lib/email/activate-profile'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { preview, userIds } = await req.json().catch(() => ({}))

  // Promos reales top para usar como ejemplo en el email
  const topPromos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', isCSIOnly: false, maxDiscountPct: { gte: 20 } },
    orderBy: [{ maxDiscountPct: 'desc' }, { commerce: { activePromoCount: 'desc' } }],
    take: 3,
    select: {
      commerce: { select: { name: true } },
      category: { select: { name: true } },
      requirements: {
        select: { discountType: true, discountValue: true, bank: { select: { name: true } }, wallet: { select: { name: true } } },
        orderBy: { discountValue: 'desc' },
        take: 1,
      },
    },
  })

  const promoData = topPromos.map(p => {
    const req = p.requirements[0]
    const entity = req?.bank?.name || req?.wallet?.name || 'Banco'
    const pct = req?.discountValue ?? 0
    return {
      commerce: p.commerce.name,
      discount: `${pct}%`,
      entity,
      category: p.category.name,
    }
  })

  if (preview) {
    const admin = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { email: true, name: true },
    })
    if (!admin) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: admin.email,
      subject: '[PREVIEW] Completá tu perfil y descubrí las promos que son para vos',
      html: activateProfileEmail(admin.name, promoData),
    })
    return NextResponse.json({ ok: true, sent: 1, mode: 'preview' })
  }

  // Usuarios registrados sin perfil financiero (o selección específica)
  const targets = await prisma.user.findMany({
    where: Array.isArray(userIds) && userIds.length > 0
      ? { id: { in: userIds } }
      : { financialProfile: null },
    select: { id: true, email: true, name: true },
  })

  if (targets.length === 0) return NextResponse.json({ ok: true, sent: 0, message: 'No hay usuarios sin perfil' })

  let sent = 0, errors = 0
  for (const user of targets) {
    try {
      await resend.emails.send({
        from: 'PromoAR <noreply@promoar.com.ar>',
        to: user.email,
        subject: 'Completá tu perfil y descubrí las promos que son para vos',
        html: activateProfileEmail(user.name, promoData),
      })
      sent++
    } catch {
      errors++
    }
    if (sent % 10 === 0) await new Promise(r => setTimeout(r, 500))
  }

  return NextResponse.json({ ok: true, sent, errors, total: targets.length })
}
