export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

// PATCH /api/perfil/notificaciones/[id] — toggle active / actualizar
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const pref = await prisma.notificationPreference.findUnique({ where: { id: params.id } })
  if (!pref || pref.userId !== user.id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const { active, minDiscount, maxPerWeek } = body

  const updated = await prisma.notificationPreference.update({
    where: { id: params.id },
    data: {
      ...(active !== undefined && { active }),
      ...(minDiscount !== undefined && { minDiscount }),
      ...(maxPerWeek !== undefined && { maxPerWeek }),
    },
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
      commerce: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  })

  return NextResponse.json({ preference: updated })
}

// DELETE /api/perfil/notificaciones/[id] — eliminar preferencia
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const pref = await prisma.notificationPreference.findUnique({ where: { id: params.id } })
  if (!pref || pref.userId !== user.id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  await prisma.notificationPreference.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
