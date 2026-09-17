export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { emailWrapper } from '@/lib/email/template'
import { personalizedPromoEmail, byDayPromoEmail } from '@/lib/email/promos-newsletter'
import { THEME_BY_ID, groupPromosByDay, getValidDayNames, NEWSLETTER_THEMES } from '@/lib/email/newsletter-themes'
import { normalizeProvince } from '@/lib/getPromos'

const resend = new Resend(process.env.RESEND_API_KEY)

const MODO_WALLET_ID = 'cmnulzh04000aqlkk8mnpzo46'
const NATIONAL_COVERAGE_THRESHOLD = 4

// Mismo criterio geográfico que /api/promos (ADR-001). A diferencia de un
// simple sí/no, devuelve el mismo coverageStatus de 4 valores que usa la UI
// de Explorar (o null si la promo debe excluirse) — así la newsletter puede
// priorizar cercanía confirmada igual que /promos, no solo filtrar.
type Coverage = 'NEARBY' | 'TERRITORIAL' | 'ONLINE' | 'UNKNOWN'

function coverageFor(promo: any, userProvinceNorm: string): Coverage | null {
  const salesChannel = promo.salesChannel ?? 'UNKNOWN'
  const geographicScope = promo.geographicScope ?? 'UNKNOWN'
  const locationModel = promo.commerce?.locationModel ?? 'UNKNOWN'

  if (salesChannel === 'ONLINE') {
    if (geographicScope === 'NO_GEOGRAPHIC_RESTRICTION' || geographicScope === 'NATIONWIDE') return 'ONLINE'
    if (geographicScope === 'PROVINCES') {
      const ps = promo.provinces as string[]
      if (!ps?.length) return 'UNKNOWN'
      const matches = ps.some(p => normalizeProvince(p) === userProvinceNorm || ['todas', 'all'].includes(normalizeProvince(p)))
      return matches ? 'ONLINE' : null
    }
    return 'ONLINE'
  }

  if (locationModel === 'MOBILE_SERVICE' || locationModel === 'NO_FIXED_LOCATION') return 'ONLINE'
  if (geographicScope === 'NATIONWIDE') return 'TERRITORIAL'

  if (geographicScope === 'PROVINCES') {
    const ps = promo.provinces as string[]
    if (!ps?.length) return 'UNKNOWN'
    const matches = ps.some(p => normalizeProvince(p) === userProvinceNorm || ['todas', 'all'].includes(normalizeProvince(p)))
    return matches ? 'TERRITORIAL' : null
  }

  const branches = promo.commerce?.branches as { province: string | null }[] | undefined
  if (!branches?.length) return 'UNKNOWN' // sin datos = deuda de información, pass-through

  const branchProvinces = new Set(branches.map(b => normalizeProvince(b.province as string)))
  if (locationModel === 'UNKNOWN' && branchProvinces.size >= NATIONAL_COVERAGE_THRESHOLD) return 'TERRITORIAL'
  return branchProvinces.has(userProvinceNorm) ? 'NEARBY' : null
}

// Orden de prioridad para newsletter: cercanía confirmada primero, luego
// cobertura territorial/online confirmada, recién al final lo que no tiene
// datos de ubicación — dentro de cada grupo se conserva el orden por
// descuento que ya trae `promos` (query ordenado por maxDiscountPct desc).
const COVERAGE_RANK: Record<Coverage, number> = { NEARBY: 0, TERRITORIAL: 1, ONLINE: 1, UNKNOWN: 2 }

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
  const token = await getAuthToken(req)
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, themeId = 'top3-finde', preview, userIds } = await req.json()
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
      salesChannel: true, geographicScope: true, provinces: true,
      commerce: {
        select: {
          name: true, logoUrl: true, locationModel: true,
          branches: { select: { province: true }, where: { province: { not: null } } },
        },
      },
      category: { select: { name: true } },
      requirements: {
        select: { bankId: true, walletId: true, cardNetworkId: true, cardSegmentId: true, discountType: true, discountValue: true, nxmN: true, nxmM: true, cap: true, capUnlimited: true, bank: { select: { name: true } }, wallet: { select: { name: true } } },
        orderBy: { discountValue: 'desc' },
        take: 1,
      },
    },
  })

  // Filtrar por día si el tema lo requiere
  const filteredPromos = theme.dayBitmask
    ? promos.filter(p => ((p.validDays ?? 127) & theme.dayBitmask!) !== 0)
    : promos

  // 2. Fetch suscriptores con perfiles (filtrar por userIds si se especifica)
  const subscriberWhere: any = userIds?.length
    ? { id: { in: userIds } }
    : { newsletterOptIn: true }
  const subscribers = await prisma.user.findMany({
    where: subscriberWhere,
    select: {
      id: true, name: true, email: true, addressState: true,
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
    // Usar el email del token de sesión, no findFirst(role=ADMIN)
    const sessionUser = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true, email: true, name: true, addressState: true, financialProfile: { select: { banks: { select: { bankId: true } }, wallets: { select: { walletId: true } }, cards: { select: { cardSegmentId: true } } } } }
    })
    if (!sessionUser) return NextResponse.json({ error: 'No se encontró el usuario' }, { status: 500 })
    const html = buildHtml(sessionUser, filteredPromos, theme, subject)
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: sessionUser.email,
      subject: `[PREVIEW] ${subject}`,
      html: emailWrapper(html, sessionUser.id),
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
  user: { id: string; name: string | null; addressState?: string | null; financialProfile: { banks: { bankId: string }[]; wallets: { walletId: string }[]; cards: { cardSegmentId: string | null }[] } | null },
  promos: any[],
  theme: ReturnType<typeof Object.values<any>>[0],
  subject: string,
): string {
  const profile = user.financialProfile
  const hasProfile = !!profile && (profile.banks.length > 0 || profile.wallets.length > 0 || profile.cards.length > 0)
  const firstName = user.name?.split(' ')[0] || null

  // Filtro + orden geográfico (mismo criterio que /api/promos, ADR-001): si el
  // usuario tiene provincia registrada, se descartan promos que no aplican a
  // su zona y se prioriza cercanía confirmada antes que cobertura desconocida
  // — Array.sort es estable en Node, así que el orden por descuento original
  // se conserva dentro de cada grupo de cobertura.
  const geoPromos = user.addressState
    ? (() => {
        const userProvinceNorm = normalizeProvince(user.addressState as string)
        return promos
          .map(p => ({ p, coverage: coverageFor(p, userProvinceNorm) }))
          .filter((x): x is { p: any; coverage: Coverage } => x.coverage !== null)
          .sort((a, b) => COVERAGE_RANK[a.coverage] - COVERAGE_RANK[b.coverage])
          .map(x => x.p)
      })()
    : promos

  let matched: any[]

  if (!hasProfile) {
    matched = geoPromos.slice(0, theme.take)
  } else {
    const bankIds = new Set(profile.banks.map((b: any) => b.bankId))
    const walletIds = new Set(profile.wallets.map((w: any) => w.walletId).filter((id: string) => id !== MODO_WALLET_ID))
    const cardSegmentIds = new Set(profile.cards.map((c: any) => c.cardSegmentId).filter(Boolean) as string[])

    const profileMatched = geoPromos.filter(p => {
      const req = p.requirements[0]
      if (!req) return false
      return matchesProfile(req, bankIds, walletIds, cardSegmentIds)
    })

    matched = profileMatched.slice(0, theme.take)
    if (matched.length < Math.min(3, theme.take)) {
      const matchedIds = new Set(matched.map(p => p.id))
      const fillers = geoPromos.filter(p => !matchedIds.has(p.id)).slice(0, theme.take - matched.length)
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
      nxmN: req?.nxmN ?? null,
      nxmM: req?.nxmM ?? null,
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
          nxmN: req?.nxmN ?? null,
          nxmM: req?.nxmM ?? null,
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
