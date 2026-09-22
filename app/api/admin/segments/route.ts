export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateEntitiesCache } from '@/lib/cache/filtersCache'
import { invalidateBankDetailCache } from '@/lib/cache/detailCache'

export async function GET(req: NextRequest) {
  const bankId = req.nextUrl.searchParams.get('bankId')
  
  try {
    const segments = await prisma.bankSegment.findMany({
      where: bankId ? { bankId } : {},
      include: { bank: { select: { name: true } } },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(segments)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener segmentos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, bankId } = body

    if (!name || !bankId) {
      return NextResponse.json({ error: 'Nombre y Banco son requeridos' }, { status: 400 })
    }

    const segment = await prisma.bankSegment.create({
      data: { name, bankId }
    })

    invalidateEntitiesCache()
    invalidateBankDetailCache()
    return NextResponse.json(segment)
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear segmento' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    await prisma.bankSegment.delete({ where: { id } })
    invalidateEntitiesCache()
    invalidateBankDetailCache()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar segmento' }, { status: 500 })
  }
}
