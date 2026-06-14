export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const aliases = await (prisma.commerceAlias as any).findMany({
      include: { commerce: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ aliases })
  } catch (error) {
    console.error('[GET /api/admin/commerce-aliases]', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { alias, commerceId } = await req.json()
    if (!alias || !commerceId) {
      return NextResponse.json({ error: 'Missing alias or commerceId' }, { status: 400 })
    }
    const created = await (prisma.commerceAlias as any).create({
      data: { alias: alias.trim(), commerceId },
      include: { commerce: { select: { id: true, name: true, logoUrl: true } } },
    })
    return NextResponse.json(created)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ese alias ya existe' }, { status: 409 })
    }
    console.error('[POST /api/admin/commerce-aliases]', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await (prisma.commerceAlias as any).delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/commerce-aliases]', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
