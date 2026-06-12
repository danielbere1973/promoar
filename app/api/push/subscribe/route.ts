import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint, keys } = body?.subscription ?? body ?? {}

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
    }

    const session = await getServerSession()
    const email = session?.user?.email

    let userId: string | null = null
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const userAgent = req.headers.get('user-agent') ?? undefined

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId, userAgent },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId, userAgent },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en push/subscribe:', error)
    return NextResponse.json({ error: 'Error al guardar la suscripción' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    if (!endpoint) {
      return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 })
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en push/unsubscribe:', error)
    return NextResponse.json({ error: 'Error al eliminar la suscripción' }, { status: 500 })
  }
}
