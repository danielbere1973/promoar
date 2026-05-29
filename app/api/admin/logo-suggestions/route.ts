import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const commerces = await prisma.commerce.findMany({
    where: { logoUrl: null, promos: { some: { status: 'ACTIVE' } } },
    select: { id: true, name: true, slug: true, website: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ commerces })
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updates } = await req.json() as { updates: { id: string; logoUrl: string }[] }

  let saved = 0
  for (const { id, logoUrl } of updates) {
    if (logoUrl) {
      await prisma.commerce.update({ where: { id }, data: { logoUrl } })
      saved++
    }
  }

  return NextResponse.json({ saved })
}
