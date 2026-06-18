export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'
import { NotifType } from '@prisma/client'

// GET /api/perfil/notificaciones — preferencias del usuario
export async function GET(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: user.id },
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
      commerce: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ preferences: prefs })
}

// POST /api/perfil/notificaciones — crear preferencia
export async function POST(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const body = await req.json()
  const { type, categoryId, commerceId, minDiscount, maxPerWeek } = body

  if (!type || !Object.values(NotifType).includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (type === 'CATEGORY' && !categoryId) {
    return NextResponse.json({ error: 'Falta categoryId' }, { status: 400 })
  }
  if (type === 'COMMERCE' && !commerceId) {
    return NextResponse.json({ error: 'Falta commerceId' }, { status: 400 })
  }

  // Free tier: máximo 1 preferencia de tipo CATEGORY
  const existing = await prisma.notificationPreference.findMany({
    where: { userId: user.id, type },
  })
  if (type === 'CATEGORY' && existing.length >= 1) {
    return NextResponse.json({ error: 'LIMIT_REACHED', message: 'Plan gratuito: solo 1 categoría' }, { status: 403 })
  }

  try {
    const pref = await prisma.notificationPreference.create({
      data: {
        userId: user.id,
        type,
        categoryId: categoryId ?? null,
        commerceId: commerceId ?? null,
        minDiscount: minDiscount ?? null,
        maxPerWeek: maxPerWeek ?? 3,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
        commerce: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
    })
    return NextResponse.json({ preference: pref }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe esta preferencia' }, { status: 409 })
    }
    throw e
  }
}
