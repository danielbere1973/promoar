export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

const SECRET = process.env.NEXTAUTH_SECRET || 'promoar-newsletter-secret'

export function generateUnsubscribeToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'unsubscribe' }, SECRET, { expiresIn: '90d' })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/unsubscribe?error=invalid', req.url))

  try {
    const payload = jwt.verify(token, SECRET) as { userId: string; purpose: string }
    if (payload.purpose !== 'unsubscribe') throw new Error('invalid')

    await prisma.user.update({
      where: { id: payload.userId },
      data: { newsletterOptIn: false, newsletterOptInAt: null },
    })

    return NextResponse.redirect(new URL('/unsubscribe?ok=1', req.url))
  } catch {
    return NextResponse.redirect(new URL('/unsubscribe?error=invalid', req.url))
  }
}
