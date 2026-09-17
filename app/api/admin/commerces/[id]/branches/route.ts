export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCommerceDetailCache } from '@/lib/cache/detailCache'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: commerceId } = params
    const body = await req.json()
    const { name, address, city, province, lat, lng, source, osmId } = body

    if (lat === undefined || lng === undefined || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return NextResponse.json({ error: 'Coordenadas latitud y longitud válidas son obligatorias' }, { status: 400 })
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    const branch = await prisma.commerceBranch.create({
      data: {
        commerceId,
        name: name?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        province: province?.trim() || null,
        lat: latitude,
        lng: longitude,
        source: source || 'MANUAL',
        osmId: osmId ? String(osmId) : null,
      },
    })

    invalidateCommerceDetailCache()

    return NextResponse.json({ branch }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/admin/commerces/[id]/branches]', error)
    return NextResponse.json({ error: error.message || 'Error al crear sucursal' }, { status: 500 })
  }
}
