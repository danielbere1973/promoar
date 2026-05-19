export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Bulk update category for multiple promos
export async function PATCH(req: NextRequest) {
  try {
    const { ids, categoryId } = await req.json()
    if (!ids?.length || !categoryId) return NextResponse.json({ error: 'ids y categoryId requeridos' }, { status: 400 })

    // Actualizar categoría de las promos
    const result = await prisma.promo.updateMany({
      where: { id: { in: ids } },
      data: { categoryId },
    })

    // Aprender: actualizar defaultCategoryId de los comercios asociados
    const promos = await prisma.promo.findMany({
      where: { id: { in: ids } },
      select: { commerceId: true },
    })
    const commerceIds = [...new Set(promos.map(p => p.commerceId))]
    if (commerceIds.length > 0) {
      await (prisma.commerce as any).updateMany({
        where: { id: { in: commerceIds } },
        data: { defaultCategoryId: categoryId },
      })
    }

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    console.error('[PATCH /api/admin/promos]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

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

