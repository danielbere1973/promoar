export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { sourceId, targetId } = await req.json()
    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Missing sourceId or targetId' }, { status: 400 })
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: 'sourceId y targetId no pueden ser el mismo comercio' }, { status: 400 })
    }

    const [source, target] = await Promise.all([
      prisma.commerce.findUnique({ where: { id: sourceId } }),
      prisma.commerce.findUnique({ where: { id: targetId } }),
    ])
    if (!source) return NextResponse.json({ error: 'Comercio origen no encontrado' }, { status: 404 })
    if (!target) return NextResponse.json({ error: 'Comercio destino no encontrado' }, { status: 404 })

    // Mover sucursales una por una (puede haber colisión con @@unique([source, osmId]))
    const branches = await prisma.commerceBranch.findMany({ where: { commerceId: sourceId } })
    let branchesMoved = 0
    let branchesDuplicated = 0
    for (const branch of branches) {
      try {
        await prisma.commerceBranch.update({ where: { id: branch.id }, data: { commerceId: targetId } })
        branchesMoved++
      } catch (err: any) {
        if (err?.code === 'P2002') {
          // Ya existe una sucursal equivalente en el comercio destino
          await prisma.commerceBranch.delete({ where: { id: branch.id } })
          branchesDuplicated++
        } else {
          throw err
        }
      }
    }

    // Mover promos
    const promosResult = await prisma.promo.updateMany({
      where: { commerceId: sourceId },
      data: { commerceId: targetId },
    })

    // Mover catálogo de productos
    const productsResult = await prisma.commerceProduct.updateMany({
      where: { commerceId: sourceId },
      data: { commerceId: targetId },
    })

    // Re-apuntar alias existentes del comercio origen al destino (ignorar si ya existe el mismo alias en destino)
    const sourceAliases = await (prisma.commerceAlias as any).findMany({ where: { commerceId: sourceId } })
    for (const a of sourceAliases) {
      try {
        await (prisma.commerceAlias as any).update({ where: { id: a.id }, data: { commerceId: targetId } })
      } catch (err: any) {
        if (err?.code === 'P2002') {
          await (prisma.commerceAlias as any).delete({ where: { id: a.id } })
        } else {
          throw err
        }
      }
    }

    // Crear alias del nombre del comercio origen -> destino (si no existe ya)
    try {
      await (prisma.commerceAlias as any).create({
        data: { alias: source.name, commerceId: targetId },
      })
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err
    }

    await prisma.commerce.delete({ where: { id: sourceId } })

    return NextResponse.json({
      success: true,
      branchesMoved,
      branchesDuplicated,
      promosMoved: promosResult.count,
      productsMoved: productsResult.count,
    })
  } catch (error) {
    console.error('[POST /api/admin/commerce-merge]', error)
    return NextResponse.json({ error: 'Error fusionando comercios' }, { status: 500 })
  }
}
