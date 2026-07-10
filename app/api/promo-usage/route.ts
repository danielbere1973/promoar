export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'
import { getCurrentPeriod } from '@/lib/promoUsage'

export async function POST(req: NextRequest) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Usuario invalido' }, { status: 401 })

    const body = await req.json()
    const requirementId = body.requirementId as string | undefined
    const amount = parseFloat(body.amount)

    if (!requirementId || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Fecha real del gasto (puede ser distinta al día en que se carga, ej. se compra
    // el domingo y se registra el lunes — el período/tope se calcula sobre esta fecha).
    const spentAt = body.spentAt ? new Date(body.spentAt) : new Date()
    if (Number.isNaN(spentAt.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    const requirement = await prisma.promoRequirement.findUnique({
      where: { id: requirementId },
    })
    if (!requirement) {
      return NextResponse.json({ error: 'Requisito no encontrado' }, { status: 404 })
    }
    // Sin tope/período: solo queda en el historial de ahorro, no hay acumulador que trackear.
    if (!requirement.capPeriod || requirement.cap == null) {
      const event = await prisma.promoUsageEvent.create({
        data: {
          userId: user.id,
          promoId: requirement.promoId,
          requirementId,
          amount,
          createdAt: spentAt,
        },
      })
      return NextResponse.json({ usage: null, event })
    }

    const { start, end } = getCurrentPeriod(requirement.capPeriod, spentAt)

    const existing = await prisma.promoUsage.findUnique({
      where: {
        userId_requirementId_periodStart: {
          userId: user.id,
          requirementId,
          periodStart: start,
        },
      },
    })

    const cap = requirement.capUnlimited ? Infinity : requirement.cap
    const newAmount = Math.min((existing?.amountUsed || 0) + amount, cap)

    const [usage] = await prisma.$transaction([
      prisma.promoUsage.upsert({
        where: {
          userId_requirementId_periodStart: {
            userId: user.id,
            requirementId,
            periodStart: start,
          },
        },
        create: {
          userId: user.id,
          promoId: requirement.promoId,
          requirementId,
          amountUsed: newAmount,
          periodStart: start,
          periodEnd: end,
        },
        update: {
          amountUsed: newAmount,
        },
      }),
      // Log inmutable para el historial "Promos usadas" del perfil — nunca se edita/borra.
      prisma.promoUsageEvent.create({
        data: {
          userId: user.id,
          promoId: requirement.promoId,
          requirementId,
          amount,
          createdAt: spentAt,
        },
      }),
    ])

    return NextResponse.json({ usage })
  } catch (error) {
    console.error('[POST /api/promo-usage]', error)
    return NextResponse.json({ error: 'Error al registrar uso' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Usuario invalido' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const promoIds = searchParams.get('promoIds')?.split(',').filter(Boolean) ?? []
    if (!promoIds.length) {
      return NextResponse.json({ usages: [] })
    }

    const usages = await prisma.promoUsage.findMany({
      where: {
        userId: user.id,
        promoId: { in: promoIds },
        periodEnd: { gte: new Date() },
      },
    })

    return NextResponse.json({ usages })
  } catch (error) {
    console.error('[GET /api/promo-usage]', error)
    return NextResponse.json({ error: 'Error al obtener usos' }, { status: 500 })
  }
}
