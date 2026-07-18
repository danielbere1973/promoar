export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || (token.role !== 'ADMIN' && token.role !== 'MODERATOR')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { tipo, commerceId, sourceUrl } = await req.json()

  let deleted = 0

  if (tipo === 'expired') {
    const result = await prisma.promo.deleteMany({
      where: { validUntil: { lt: new Date() } }
    })
    deleted = result.count

  } else if (tipo === 'by_commerce' && commerceId) {
    const result = await prisma.promo.deleteMany({
      where: { commerceId }
    })
    deleted = result.count

  } else if (tipo === 'by_source' && sourceUrl) {
    const result = await prisma.promo.deleteMany({
      where: { sourceUrl: { contains: sourceUrl } }
    })
    deleted = result.count

  } else if (tipo === 'all') {
    const result = await prisma.promo.deleteMany({})
    deleted = result.count

  } else {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  if (deleted > 0) invalidatePublicPromosCache()

  return NextResponse.json({ deleted })
}
