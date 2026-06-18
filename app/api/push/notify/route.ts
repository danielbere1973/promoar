import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import webpush from '@/lib/webpush'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

// POST /api/push/notify — interno, llamado al final de cada run del scraper
// Body: { promoIds: string[] }
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { promoIds } = await req.json() as { promoIds: string[] }
  if (!promoIds?.length) return NextResponse.json({ sent: 0 })

  // Cargar las promos nuevas con categoría y comercio
  const promos = await prisma.promo.findMany({
    where: { id: { in: promoIds }, status: 'ACTIVE' },
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
      commerce: { select: { id: true, name: true, slug: true } },
      requirements: {
        select: { discountValue: true, discountType: true, bank: { select: { name: true } }, wallet: { select: { name: true } } },
        take: 1,
        orderBy: { discountValue: 'desc' },
      },
    },
  })

  if (!promos.length) return NextResponse.json({ sent: 0 })

  // Índices para búsqueda rápida
  const promoByCategoryId = new Map<string, typeof promos>()
  const promoByCommerceId = new Map<string, typeof promos>()
  for (const p of promos) {
    if (p.categoryId) {
      if (!promoByCategoryId.has(p.categoryId)) promoByCategoryId.set(p.categoryId, [])
      promoByCategoryId.get(p.categoryId)!.push(p)
    }
    if (p.commerceId) {
      if (!promoByCommerceId.has(p.commerceId)) promoByCommerceId.set(p.commerceId, [])
      promoByCommerceId.get(p.commerceId)!.push(p)
    }
  }

  // Cargar todas las preferencias activas con sus suscripciones push
  const prefs = await prisma.notificationPreference.findMany({
    where: { active: true },
    include: {
      user: {
        select: {
          id: true,
          pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
        },
      },
    },
  })

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  let sent = 0
  const errors: string[] = []

  for (const pref of prefs) {
    const subs = pref.user.pushSubscriptions
    if (!subs.length) continue

    // Calcular sentThisWeek (resetear si pasó una semana)
    const weekStarted = pref.weekStartedAt
    const needsReset = !weekStarted || weekStarted < weekAgo
    const currentSent = needsReset ? 0 : pref.sentThisWeek

    // Verificar presupuesto semanal
    if (currentSent >= pref.maxPerWeek) continue

    // Cooldown 24h
    if (pref.lastSentAt && pref.lastSentAt > dayAgo) continue

    // Encontrar promos que matchean esta preferencia
    let matchingPromos: typeof promos = []
    if (pref.type === 'CATEGORY' && pref.categoryId) {
      matchingPromos = promoByCategoryId.get(pref.categoryId) ?? []
    } else if (pref.type === 'COMMERCE' && pref.commerceId) {
      matchingPromos = promoByCommerceId.get(pref.commerceId) ?? []
    }

    // Filtrar por descuento mínimo
    if (pref.minDiscount) {
      matchingPromos = matchingPromos.filter(p =>
        (p.requirements[0]?.discountValue ?? 0) >= pref.minDiscount!
      )
    }

    if (!matchingPromos.length) continue

    // Armar el contenido de la notificación
    const { title, body, url } = buildNotification(pref.type, matchingPromos)

    // Enviar a todas las suscripciones del usuario
    let userSent = false
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, icon: '/favicon.png', url })
        )
        userSent = true
        sent++
      } catch (err: any) {
        // Suscripción expirada → borrarla
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          errors.push(`sub ${sub.id}: ${err.message}`)
        }
      }
    }

    if (!userSent) continue

    // Actualizar contadores
    await prisma.notificationPreference.update({
      where: { id: pref.id },
      data: {
        sentThisWeek: currentSent + 1,
        weekStartedAt: needsReset ? now : pref.weekStartedAt,
        lastSentAt: now,
      },
    })

    // Log del evento
    await prisma.userEvent.create({
      data: {
        userId: pref.user.id,
        sessionId: 'push-notify',
        eventType: 'PUSH_SENT',
        payload: {
          prefId: pref.id,
          type: pref.type,
          categoryId: pref.categoryId,
          commerceId: pref.commerceId,
          promoCount: matchingPromos.length,
          title,
        },
      },
    })
  }

  return NextResponse.json({ sent, errors: errors.length ? errors : undefined })
}

function buildNotification(type: string, promos: any[]) {
  const count = promos.length
  const first = promos[0]

  if (type === 'CATEGORY') {
    const catName = first.category?.name ?? 'tu categoría favorita'
    const icon = first.category?.icon ?? '🔔'
    const catSlug = first.category?.slug ?? ''
    if (count === 1) {
      const req = first.requirements[0]
      const entity = req?.bank?.name ?? req?.wallet?.name ?? ''
      const discount = formatDiscount(req)
      return {
        title: `${icon} Nueva promo en ${catName}`,
        body: `${first.commerce?.name ?? first.title}${discount ? ' · ' + discount : ''}${entity ? ' con ' + entity : ''}`,
        url: `/promos/${first.slug ?? ''}`,
      }
    }
    return {
      title: `${icon} ${count} promos nuevas en ${catName}`,
      body: promos.slice(0, 3).map(p => p.commerce?.name ?? p.title).join(', '),
      url: `/promos?cats=${catSlug}`,
    }
  }

  if (type === 'COMMERCE') {
    const commerceName = first.commerce?.name ?? 'tu comercio favorito'
    const req = first.requirements[0]
    const discount = formatDiscount(req)
    return {
      title: `Nueva promo en ${commerceName}`,
      body: count === 1
        ? `${discount ? discount + ' · ' : ''}${first.title ?? first.description ?? ''}`.trim()
        : `${count} promos nuevas`,
      url: `/promos/${first.slug ?? ''}`,
    }
  }

  return {
    title: 'Nueva promo para vos',
    body: `${first.commerce?.name ?? first.title} — ${first.category?.name ?? ''}`,
    url: '/promos',
  }
}

function formatDiscount(req: any): string {
  if (!req) return ''
  const v = req.discountValue
  const t = req.discountType
  if (!v) return ''
  if (t === 'PERCENTAGE_REINTEGRO' || t === 'PERCENTAGE_DESCUENTO') return `${v}%`
  if (t === 'BONIFICACION') return `${v}% bonif.`
  if (t === 'FIXED_AMOUNT') return `$${v}`
  if (t === 'NXM') return `${v}x1`
  return `${v}`
}
