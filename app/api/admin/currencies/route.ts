import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const currencies = await prisma.currency.findMany({ orderBy: { code: 'asc' } })
  return NextResponse.json({ currencies })
}

export async function POST(req: Request) {
  try {
    const { name, code, symbol } = await req.json()
    const currency = await prisma.currency.create({
      data: { name, code, symbol }
    })
    return NextResponse.json(currency)
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing Id' }, { status: 400 })
    await prisma.currency.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
