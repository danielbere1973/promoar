export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
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

const prefInclude = {
  user: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true, icon: true } },
  commerce: { select: { id: true, name: true } },
}

// GET /api/admin/notification-preferences
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prefs = await prisma.notificationPreference.findMany({
    include: prefInclude,
    orderBy: [{ user: { email: 'asc' } }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ preferences: prefs })
}

// POST /api/admin/notification-preferences — alta
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { userId, type, categoryId, commerceId, minDiscount, maxPerWeek, active, validUntil } = body

  if (!userId || !type) return NextResponse.json({ error: 'userId y type son requeridos' }, { status: 400 })

  const pref = await prisma.notificationPreference.create({
    data: {
      userId,
      type,
      categoryId: categoryId || null,
      commerceId: commerceId || null,
      minDiscount: minDiscount ? Number(minDiscount) : null,
      maxPerWeek: maxPerWeek ? Number(maxPerWeek) : 3,
      active: active !== undefined ? active : true,
      validUntil: validUntil ? new Date(validUntil) : null,
    },
    include: prefInclude,
  })

  return NextResponse.json({ preference: pref }, { status: 201 })
}

// PATCH /api/admin/notification-preferences — edición completa
export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, active, maxPerWeek, minDiscount, validUntil, resetWeek, categoryId, commerceId, type } = body
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const data: Record<string, any> = {}
  if (active !== undefined) data.active = active
  if (maxPerWeek !== undefined) data.maxPerWeek = Number(maxPerWeek)
  if (minDiscount !== undefined) data.minDiscount = minDiscount === '' ? null : Number(minDiscount)
  if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null
  if (categoryId !== undefined) data.categoryId = categoryId || null
  if (commerceId !== undefined) data.commerceId = commerceId || null
  if (type !== undefined) data.type = type
  if (resetWeek) { data.sentThisWeek = 0; data.weekStartedAt = null }

  const updated = await prisma.notificationPreference.update({
    where: { id },
    data,
    include: prefInclude,
  })

  return NextResponse.json({ preference: updated })
}

// DELETE /api/admin/notification-preferences
export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  await prisma.notificationPreference.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
