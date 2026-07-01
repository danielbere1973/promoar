export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { newsletterOptIn } = await req.json()

  await prisma.user.update({
    where: { email },
    data: {
      newsletterOptIn: !!newsletterOptIn,
      newsletterOptInAt: newsletterOptIn ? new Date() : null,
    },
  })

  return NextResponse.json({ ok: true, newsletterOptIn: !!newsletterOptIn })
}
