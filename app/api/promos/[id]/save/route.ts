import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Usuario invalido' }, { status: 401 })

    const promoId = params.id
    
    const existing = await prisma.savedPromo.findUnique({
      where: { userId_promoId: { userId: user.id, promoId } },
    })

    if (existing) {
      // Unsave
      await prisma.savedPromo.delete({
        where: { userId_promoId: { userId: user.id, promoId } }
      })
      return NextResponse.json({ saved: false })
    } else {
      // Save
      await prisma.savedPromo.create({
        data: { userId: user.id, promoId }
      })
      return NextResponse.json({ saved: true })
    }

  } catch (error) {
    console.error('[POST /api/promos/[id]/save]', error)
    return NextResponse.json({ error: 'Error al guardar promo' }, { status: 500 })
  }
}
