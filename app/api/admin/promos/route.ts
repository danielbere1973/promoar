export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0,0,0,0)

    // Auto-expiration logic: Move active promos that have already expired to EXPIRED status
    try {
      await prisma.promo.updateMany({
        where: {
          status: 'ACTIVE',
          validUntil: { lt: startOfToday }
        },
        data: {
          status: 'EXPIRED'
        }
      })
    } catch (e) {
      console.error('Error in auto-expiration logic:', e)
    }

    const promos = await prisma.promo.findMany({
      include: {
        category: true,
        commerce: true,
        requirements: {
          include: {
            bank: { select: { id: true, name: true } },
            wallet: { select: { id: true, name: true } },
            cardNetwork: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ promos })
  } catch (error) {
    console.error('[GET /api/admin/promos]', error)
    return NextResponse.json({ error: 'Error al obtener promociones' }, { status: 500 })
  }
}
