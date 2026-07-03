export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { emailWrapper } from '@/lib/email/template'
import { personalizedPromoEmail } from '@/lib/email/promos-newsletter'

const resend = new Resend(process.env.RESEND_API_KEY)

// IDs especiales
const MODO_WALLET_ID_PREFIX = 'modo'

function matchesProfile(
  req: { bankId: string | null; walletId: string | null; cardNetworkId: string | null; cardSegmentId: string | null },
  bankIds: Set<string>,
  walletIds: Set<string>,
  cardSegmentIds: Set<string>,
): boolean {
  const hasConstraint = req.bankId || req.walletId
  if (!hasConstraint) return true // aplica a todos
  if (req.bankId && bankIds.has(req.bankId)) return true
  if (req.walletId && walletIds.has(req.walletId)) return true
  if (req.cardSegmentId && cardSegmentIds.has(req.cardSegmentId)) return true
  return false
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, preview } = await req.json()
  if (!subject) return NextResponse.json({ error: 'Falta subject' }, { status: 400 })

  // 1. Fetch top 60 promos activas con requirements
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', isCSIOnly: false },
    orderBy: [{ maxDiscountPct: 'desc' }, { id: 'asc' }],
    take: 60,
    select: {
      id: true, title: true, slug: true, validDays: true, validUntil: true,
      commerce: { select: { name: true, logoUrl: true } },
      category: { select: { name: true } },
      requirements: {
        select: { bankId: true, walletId: true, cardNetworkId: true, cardSegmentId: true, discountType: true, discountValue: true, cap: true, capUnlimited: true },
        orderBy: { discountValue: 'desc' },
        take: 1,
      },
    },
  })

  // 2. Fetch suscriptores con perfiles
  const subscribers = await prisma.user.findMany({
    where: { newsletterOptIn: true },
    select: {
      id: true, name: true, email: true,
      financialProfile: {
        select: {
          banks:   { select: { bankId: true } },
          wallets: { select: { walletId: true } },
          cards:   { select: { cardSegmentId: true } },
        }
      }
    }
  })

  if (preview) {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true, name: true, financialProfile: { select: { banks: { select: { bankId: true } }, wallets: { select: { walletId: true } }, cards: { select: { cardSegmentId: true } } } } } })
    if (!adminUser) return NextResponse.json({ error: 'No hay admin' }, { status: 500 })
    const html = buildPersonalizedHtml(adminUser, promos, subject)
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: adminUser.email,
      subject: `[PREVIEW] ${subject}`,
      html: emailWrapper(html, adminUser.id),
    })
    return NextResponse.json({ ok: true, sent: 1, mode: 'preview' })
  }

  // 3. Enviar en lotes de 50
  let sent = 0, errors = 0
  const BATCH = 50
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH)
    await Promise.all(batch.map(async (user) => {
      try {
        const html = buildPersonalizedHtml(user, promos, subject)
        await resend.emails.send({
          from: 'PromoAR <noreply@promoar.com.ar>',
          to: user.email,
          subject,
          html: emailWrapper(html, user.id),
        })
        sent++
      } catch {
        errors++
      }
    }))
    if (i + BATCH < subscribers.length) await new Promise(r => setTimeout(r, 1000))
  }

  await prisma.newsletterLog.create({
    data: { subject, html: '[personalizada — top 3 promos por perfil]', sentTo: sent, errors },
  })

  return NextResponse.json({ ok: true, sent, errors })
}

function buildPersonalizedHtml(
  user: { id: string; name: string | null; financialProfile: { banks: { bankId: string }[]; wallets: { walletId: string }[]; cards: { cardSegmentId: string | null }[] } | null },
  promos: any[],
  subject: string,
): string {
  const profile = user.financialProfile
  const hasProfile = !!profile && (profile.banks.length > 0 || profile.wallets.length > 0 || profile.cards.length > 0)

  const firstName = user.name?.split(' ')[0] || null

  let top3: any[]

  if (!hasProfile) {
    // Sin perfil: top 3 general por descuento
    top3 = promos.slice(0, 3)
  } else {
    const bankIds = new Set(profile.banks.map(b => b.bankId))
    const walletIds = new Set(profile.wallets.map(w => w.walletId))
    const cardSegmentIds = new Set(profile.cards.map(c => c.cardSegmentId).filter(Boolean) as string[])

    const matched = promos.filter(p => {
      const req = p.requirements[0]
      if (!req) return false
      return matchesProfile(req, bankIds, walletIds, cardSegmentIds)
    })

    // Si tiene pocas promos matcheadas, completar con las mejores generales
    top3 = matched.slice(0, 3)
    if (top3.length < 3) {
      const matchedIds = new Set(top3.map(p => p.id))
      const fillers = promos.filter(p => !matchedIds.has(p.id)).slice(0, 3 - top3.length)
      top3 = [...top3, ...fillers]
    }
  }

  const promoData = top3.map(p => {
    const req = p.requirements[0]
    return {
      title: p.title,
      slug: p.slug,
      commerceName: p.commerce.name,
      commerceLogo: p.commerce.logoUrl,
      categoryName: p.category.name,
      discountType: req?.discountType || 'PERCENTAGE_DESCUENTO',
      discountValue: req?.discountValue || 0,
      entityName: '—',
      validDays: p.validDays,
      validUntil: p.validUntil,
      hasCap: req && !req.capUnlimited && req.cap != null && req.cap > 0,
    }
  })

  return personalizedPromoEmail(firstName, promoData, hasProfile, subject)
}
