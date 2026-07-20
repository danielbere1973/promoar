export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateEntitiesCache } from '@/lib/cache/filtersCache'

export async function GET() {
  const accountTypes = await prisma.financialAccountType.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ accountTypes })
}

export async function POST(req: Request) {
  try {
    const { name, description } = await req.json()
    const item = await prisma.financialAccountType.create({
      data: { name, description }
    })
    invalidateEntitiesCache()
    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing Id' }, { status: 400 })
    await prisma.financialAccountType.delete({ where: { id } })
    invalidateEntitiesCache()
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
