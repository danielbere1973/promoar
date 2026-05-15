import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/admin/card-segments?cardNetworkId=&cardType=
export async function GET(req: NextRequest) {
  const cardNetworkId = req.nextUrl.searchParams.get('cardNetworkId')
  const cardType = req.nextUrl.searchParams.get('cardType')

  try {
    const segments = await prisma.cardSegment.findMany({
      where: {
        ...(cardNetworkId ? { cardNetworkId } : {}),
        ...(cardType ? { cardType: cardType as any } : {}),
      },
      include: { cardNetwork: { select: { name: true } } },
      orderBy: [{ cardNetworkId: 'asc' }, { cardType: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(segments)
  } catch (error) {
    console.error('[GET /api/admin/card-segments]', error)
    return NextResponse.json({ error: 'Error al obtener segmentos de tarjeta' }, { status: 500 })
  }
}

// POST /api/admin/card-segments  { cardNetworkId, cardType, name }
export async function POST(req: NextRequest) {
  try {
    const { cardNetworkId, cardType, name } = await req.json()
    if (!cardNetworkId || !cardType || !name) {
      return NextResponse.json({ error: 'Faltan campos: cardNetworkId, cardType, name' }, { status: 400 })
    }
    const segment = await prisma.cardSegment.create({
      data: { cardNetworkId, cardType, name },
      include: { cardNetwork: { select: { name: true } } },
    })
    return NextResponse.json(segment)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe ese segmento para esa red y tipo' }, { status: 409 })
    }
    console.error('[POST /api/admin/card-segments]', error)
    return NextResponse.json({ error: 'Error al crear segmento de tarjeta' }, { status: 500 })
  }
}

// PUT /api/admin/card-segments  { id, cardNetworkId, cardType, name }
export async function PUT(req: NextRequest) {
  try {
    const { id, cardNetworkId, cardType, name } = await req.json()
    if (!id || !cardNetworkId || !cardType || !name) {
      return NextResponse.json({ error: 'Faltan campos: id, cardNetworkId, cardType, name' }, { status: 400 })
    }
    const segment = await prisma.cardSegment.update({
      where: { id },
      data: { cardNetworkId, cardType, name },
      include: { cardNetwork: { select: { name: true } } },
    })
    return NextResponse.json(segment)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe ese segmento para esa red y tipo' }, { status: 409 })
    }
    console.error('[PUT /api/admin/card-segments]', error)
    return NextResponse.json({ error: 'Error al actualizar segmento de tarjeta' }, { status: 500 })
  }
}

// DELETE /api/admin/card-segments?id=
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    await prisma.cardSegment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/admin/card-segments]', error)
    return NextResponse.json({ error: 'Error al eliminar segmento de tarjeta' }, { status: 500 })
  }
}
