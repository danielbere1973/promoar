import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  // Única fuente de auto-expiración desde RFC-002 Fase 1 (antes también corría,
  // redundante, en cada GET público a /api/promos vía getPromosData).
  const result = await prisma.promo.updateMany({
    where: { status: 'ACTIVE', validUntil: { lt: startOfToday } },
    data: { status: 'EXPIRED' },
  })

  if (result.count > 0) invalidatePublicPromosCache()

  return NextResponse.json({ expired: result.count })
}
