export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

async function isAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return false
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const commerces = await prisma.commerce.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ commerces })
}
