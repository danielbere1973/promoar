export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Usuario invalido' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const take = Math.min(parseInt(searchParams.get('take') || '50', 10) || 50, 200)

    const events = await prisma.promoUsageEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        promo: {
          select: {
            id: true,
            title: true,
            slug: true,
            commerce: { select: { id: true, name: true, logoUrl: true } },
          },
        },
        requirement: {
          select: {
            discountType: true,
            discountValue: true,
            capPeriod: true,
            bank: { select: { name: true, slug: true } },
            wallet: { select: { name: true, slug: true } },
          },
        },
      },
    })

    const historial = events.map(ev => ({
      id: ev.id,
      fecha: ev.createdAt,
      monto: ev.amount,
      promo: {
        id: ev.promo.id,
        title: ev.promo.title,
        slug: ev.promo.slug,
      },
      comercio: ev.promo.commerce,
      entidad: ev.requirement.bank?.name || ev.requirement.wallet?.name || null,
      discountType: ev.requirement.discountType,
      discountValue: ev.requirement.discountValue,
      capPeriod: ev.requirement.capPeriod,
    }))

    return NextResponse.json({ historial })
  } catch (error) {
    console.error('[GET /api/perfil/historial-uso]', error)
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
  }
}
