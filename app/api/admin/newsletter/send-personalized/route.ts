export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { emailWrapper } from '@/lib/email/template'
import { personalizedPromoEmail, byDayPromoEmail } from '@/lib/email/promos-newsletter'
import { THEME_BY_ID, groupPromosByDay, getValidDayNames, NEWSLETTER_THEMES } from '@/lib/email/newsletter-themes'

const resend = new Resend(process.env.RESEND_API_KEY)

const MODO_WALLET_ID = 'cmnulzh04000aqlkk8mnpzo46'

function matchesProfile(
  req: { bankId: string | null; walletId: string | null; cardSegmentId: string | null },
  bankIds: Set<string>,
  walletIds: Set<string>,
  cardSegmentIds: Set<string>,
): boolean {
  const hasConstraint = req.bankId || req.walletId
  if (!hasConstraint) return true
  if (req.bankId && bankIds.has(req.bankId)) return true
  if (req.walletId && walletIds.has(req.walletId)) return true
  if (req.cardSegmentId && cardSegmentIds.has(req.cardSegmentId)) return true
  return false
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, themeId = 'top3-finde', preview } = await req.json()
  if (!subject) return NextResponse.json({ error: 'Falta subject' }, { status: 400 })

  const theme = THEME_BY_ID[themeId] || NEWSLETTER_THEMES[0]

  // 1. Fetch promos activas filtradas por categoría y días del tema
  const wherePromo: any = {
    status: 'ACTIVE',
    ...(theme.categoryIds ? { categoryId: { in: theme.categoryIds } } : {}),
    ...(theme.dayBitmask ? { validDays: { not: 0 } } : {}), // filtrado fino en memoria
  }

  const promos = await prisma.promo.findMany({
    where: wherePromo,
    orderBy: [{ isCSIOnly: 'asc' }, { maxDiscountPct: 'desc' }, { id: 'asc' }],
    take: 100,
    select: {
      id: true, title: true, slug: true, validDays: true, validUntil: true, isCSIOnly: true,
      commerce: { select: { name: true, logoUrl: true } },
      category: { select: { name: true } },
      requirements: {
        select: { bankId: true, walletId: true, cardNetworkId: true, cardSegmentId: true, discountType: true, discountValue: true, cap: true, capUnlimited: true, bank: { select: { name: true } }, wallet: { select: { name: true } } },
        orderBy: { discountValue: 'desc' },
        take: 1,
      },
    },
  })

  // Filtrar por día si el tema lo requiere
  const filteredPromos = theme.dayBitmask
    ? promos.filter(p => ((p.validDays ?? 127) & theme.dayBitmask!) !== 0)
    : promos

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
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, financialProfile: { select: { banks: { select: { bankId: true } }, wallets: { select: { walletId: true } }, cards: { select: { cardSegmentId: true } } } } }
    })
    if (!adminUser) return NextResponse.json({ error: 'No hay admin' }, { status: 500 })
    const html = buildHtml(adminUser, filteredPromos, theme, subject)
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
        const html = buildHtml(user, filteredPromos, theme, subject)
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
    data: { subject, html: `[personalizada — tema: ${theme.label}]`, sentTo: sent, errors },
  })

  return NextResponse.json({ ok: true, sent, errors })
}

function buildHtml(
  user: { id: string; name: string | null; financialProfile: { banks: { bankId: string }[]; wallets: { walletId: string }[]; cards: { cardSegmentId: string | null }[] } | null },
  promos: any[],
  theme: ReturnType<typeof Object.values<any>>[0],
  subject: string,
): string {
  const profile = user.financialProfile
  const hasProfile = !!profile && (profile.banks.length > 0 || profile.wallets.length > 0 || profile.cards.length > 0)
  const firstName = user.name?.split(' ')[0] || null

  let matched: any[]

  if (!hasProfile) {
    matched = promos.slice(0, theme.take)
  } else {
    const bankIds = new Set(profile.banks.map((b: any) => b.bankId))
    const walletIds = new Set(profile.wallets.map((w: any) => w.walletId).filter((id: string) => id !== MODO_WALLET_ID))
    const cardSegmentIds = new Set(profile.cards.map((c: any) => c.cardSegmentId).filter(Boolean) as string[])

    const profileMatched = promos.filter(p => {
      const req = p.requirements[0]
      if (!req) return false
      return matchesProfile(req, bankIds, walletIds, cardSegmentIds)
    })

    matched = profileMatched.slice(0, theme.take)
    if (matched.length < Math.min(3, theme.take)) {
      const matchedIds = new Set(matched.map(p => p.id))
      const fillers = promos.filter(p => !matchedIds.has(p.id)).slice(0, theme.take - matched.length)
      matched = [...matched, ...fillers]
    }
  }

  const promoData = matched.map(p => {
    const req = p.requirements[0]
    const entityName = req?.bank?.name || req?.wallet?.name || '—'
    return {
      title: p.title,
      slug: p.slug,
      commerceName: p.commerce.name,
      commerceLogo: p.commerce.logoUrl,
      categoryName: p.category.name,
      discountType: req?.discountType || 'PERCENTAGE_DESCUENTO',
      discountValue: req?.discountValue || 0,
      entityName,
      validDays: p.validDays,
      validUntil: p.validUntil,
      hasCap: req && !req.capUnlimited && req.cap != null && req.cap > 0,
    }
  })

  if (theme.groupByDay) {
    const grouped = groupPromosByDay(matched).map(g => ({
      dayLabel: g.dayLabel,
      promos: g.promos.map(p => {
        const req = p.requirements[0]
        return {
          title: p.title,
          slug: p.slug,
          commerceName: p.commerce.name,
          commerceLogo: p.commerce.logoUrl,
          categoryName: p.category.name,
          discountType: req?.discountType || 'PERCENTAGE_DESCUENTO',
          discountValue: req?.discountValue || 0,
          entityName: req?.bank?.name || req?.wallet?.name || '—',
          validDays: p.validDays,
          validUntil: p.validUntil,
          hasCap: req && !req.capUnlimited && req.cap != null && req.cap > 0,
        }
      }),
    }))
    return byDayPromoEmail(firstName, grouped, hasProfile, subject, theme.intro)
  }

  return personalizedPromoEmail(firstName, promoData, hasProfile, subject, theme.intro)
}
