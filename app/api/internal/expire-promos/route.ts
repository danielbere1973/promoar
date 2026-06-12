import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  const result = await prisma.promo.updateMany({
    where: { status: 'ACTIVE', validUntil: { lt: startOfToday } },
    data: { status: 'EXPIRED' },
  })

  return NextResponse.json({ expired: result.count })
}
