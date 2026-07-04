export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { welcomeEmail } from '@/lib/email/welcome'
import { activateProfileEmail } from '@/lib/email/activate-profile'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') return new NextResponse('Unauthorized', { status: 401 })

  const type = req.nextUrl.searchParams.get('type')

  if (type === 'welcome') {
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { name: true },
    })
    const html = welcomeEmail(user?.name ?? 'Usuario')
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (type === 'activate-profile') {
    const topPromos = await prisma.promo.findMany({
      where: { status: 'ACTIVE', isCSIOnly: false, maxDiscountPct: { gte: 20, lte: 100 } },
      orderBy: [{ maxDiscountPct: 'desc' }, { commerce: { activePromoCount: 'desc' } }],
      take: 3,
      select: {
        commerce: { select: { name: true } },
        category: { select: { name: true } },
        requirements: {
          select: { discountValue: true, bank: { select: { name: true } }, wallet: { select: { name: true } } },
          orderBy: { discountValue: 'desc' },
          take: 1,
        },
      },
    })
    const promoData = topPromos.map(p => ({
      commerce: p.commerce.name,
      discount: `${p.requirements[0]?.discountValue ?? 0}%`,
      entity: p.requirements[0]?.bank?.name || p.requirements[0]?.wallet?.name || 'Banco',
      category: p.category.name,
    }))
    const html = activateProfileEmail('Nombre', promoData)
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  return new NextResponse('type requerido: welcome | activate-profile', { status: 400 })
}
