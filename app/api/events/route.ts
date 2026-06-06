import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, eventType, payload } = body

    if (!sessionId || !eventType) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const session = await getServerSession()
    const email = session?.user?.email

    let userId: string | null = null
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      userId = user?.id ?? null
    }

    await prisma.userEvent.create({
      data: {
        userId,
        sessionId,
        eventType,
        payload: payload ?? {},
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error saving event:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
