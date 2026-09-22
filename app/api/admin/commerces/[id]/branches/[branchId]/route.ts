export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCommerceDetailCache } from '@/lib/cache/detailCache'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; branchId: string } }
) {
  try {
    const { id: commerceId, branchId } = params
    const body = await req.json()

    const dataToUpdate: any = {}
    if ('name' in body) dataToUpdate.name = body.name?.trim() || null
    if ('address' in body) dataToUpdate.address = body.address?.trim() || null
    if ('city' in body) dataToUpdate.city = body.city?.trim() || null
    if ('province' in body) dataToUpdate.province = body.province?.trim() || null
    if ('lat' in body && !isNaN(parseFloat(body.lat))) dataToUpdate.lat = parseFloat(body.lat)
    if ('lng' in body && !isNaN(parseFloat(body.lng))) dataToUpdate.lng = parseFloat(body.lng)
    if ('source' in body) dataToUpdate.source = body.source

    const updated = await prisma.commerceBranch.update({
      where: { id: branchId },
      data: dataToUpdate,
    })

    invalidateCommerceDetailCache()

    return NextResponse.json({ branch: updated })
  } catch (error: any) {
    console.error('[PATCH /api/admin/commerces/[id]/branches/[branchId]]', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar sucursal' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; branchId: string } }
) {
  try {
    const { branchId } = params

    await prisma.commerceBranch.delete({
      where: { id: branchId },
    })

    invalidateCommerceDetailCache()

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/commerces/[id]/branches/[branchId]]', error)
    return NextResponse.json({ error: error.message || 'Error al eliminar sucursal' }, { status: 500 })
  }
}
