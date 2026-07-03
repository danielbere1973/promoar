export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await prisma.newsletterLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ logs })
}
