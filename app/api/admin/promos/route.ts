export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Toggle isFeatured o bulk update category
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    // Toggle destacada
    if (body.id && 'isFeatured' in body) {
      const promo = await prisma.promo.update({
        where: { id: body.id },
        data: { isFeatured: body.isFeatured },
      })
      return NextResponse.json({ ok: true, isFeatured: promo.isFeatured })
    }

    const { ids, categoryId } = body
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
    const commerceIds = Array.from(new Set(promos.map(p => p.commerceId)))
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

const MAX_RESULTS = 1000

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('categoryId')
    const categoryIds = searchParams.get('categoryIds')?.split(',').filter(Boolean)
    const status = searchParams.get('status') // ej. 'EXPIRED'
    const q = searchParams.get('q')?.trim()
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)

    const where: any = {}
    if (status) {
      where.status = status
    } else {
      where.status = { in: ['ACTIVE', 'EXPIRED'] }
    }
    if (categoryId) where.categoryId = categoryId
    if (categoryIds?.length) where.categoryId = { in: categoryIds }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { commerce: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    // Sin ningún filtro (carga inicial sin categoría/búsqueda todavía elegida): no traer nada,
    // el payload completo (95MB+) cuelga las funciones serverless de Vercel.
    if (!categoryId && !categoryIds?.length && !status && !q) {
      return NextResponse.json({ promos: [] })
    }

    const [promos, total] = await Promise.all([
      prisma.promo.findMany({
        where,
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
        skip: page * MAX_RESULTS,
        take: MAX_RESULTS,
      }),
      prisma.promo.count({ where }),
    ])
    return NextResponse.json({ promos, total, hasMore: (page + 1) * MAX_RESULTS < total })
  } catch (error) {
    console.error('[GET /api/admin/promos]', error)
    return NextResponse.json({ error: 'Error al obtener promociones' }, { status: 500 })
  }
}

