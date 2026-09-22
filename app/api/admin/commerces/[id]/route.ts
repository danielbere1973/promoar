export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCommerceDetailCache } from '@/lib/cache/detailCache'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const commerce = await prisma.commerce.findUnique({
      where: { id },
      include: {
        defaultCategory: true,
        branches: {
          orderBy: [{ province: 'asc' }, { city: 'asc' }, { name: 'asc' }],
        },
        promos: {
          where: { status: 'ACTIVE' },
          include: {
            category: { select: { id: true, name: true, color: true, icon: true } },
            requirements: {
              include: {
                bank: { select: { id: true, name: true, logoUrl: true } },
                wallet: { select: { id: true, name: true, logoUrl: true } },
                cardNetwork: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        aliases: {
          orderBy: { alias: 'asc' },
        },
        _count: {
          select: {
            branches: true,
            promos: { where: { status: 'ACTIVE' } },
            aliases: true,
            products: true,
          },
        },
      },
    })

    if (!commerce) {
      return NextResponse.json({ error: 'Comercio no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ commerce })
  } catch (error: any) {
    console.error('[GET /api/admin/commerces/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error al obtener comercio' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()

    const dataToUpdate: any = {}
    if ('name' in body && body.name?.trim()) dataToUpdate.name = body.name.trim()
    if ('logoUrl' in body) dataToUpdate.logoUrl = body.logoUrl?.trim() || null
    if ('website' in body) dataToUpdate.website = body.website?.trim() || null
    if ('instagramUrl' in body) dataToUpdate.instagramUrl = body.instagramUrl?.trim() || null
    if ('defaultCategoryId' in body) dataToUpdate.defaultCategoryId = body.defaultCategoryId || null
    if ('locationModel' in body) dataToUpdate.locationModel = body.locationModel
    if ('stacksWithBankPromos' in body) dataToUpdate.stacksWithBankPromos = body.stacksWithBankPromos
    if ('active' in body) dataToUpdate.active = Boolean(body.active)

    const updated = await prisma.commerce.update({
      where: { id },
      data: dataToUpdate,
      include: {
        defaultCategory: true,
        _count: {
          select: { branches: true, promos: true, aliases: true },
        },
      },
    })

    invalidateCommerceDetailCache()
    await invalidatePublicPromosCache()

    return NextResponse.json({ commerce: updated })
  } catch (error: any) {
    console.error('[PATCH /api/admin/commerces/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar comercio' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const activePromos = await prisma.promo.count({
      where: { commerceId: id, status: 'ACTIVE' },
    })

    if (activePromos > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar porque tiene ${activePromos} promos activas. Desactivalo o reasigná las promos.` },
        { status: 400 }
      )
    }

    await prisma.commerce.delete({
      where: { id },
    })

    invalidateCommerceDetailCache()
    await invalidatePublicPromosCache()

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/commerces/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error al eliminar comercio' }, { status: 500 })
  }
}
