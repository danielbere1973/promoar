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

// PATCH /api/admin/pending-promos/[id] — editar promo en draft
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const { title, description, commerceId, categoryId, validDays, requirements } = body

  // Actualizar campos de la promo
  const promoData: Record<string, any> = {}
  if (title !== undefined) promoData.title = title
  if (description !== undefined) promoData.description = description
  if (commerceId !== undefined) promoData.commerceId = commerceId
  if (categoryId !== undefined) promoData.categoryId = categoryId
  if (validDays !== undefined) promoData.validDays = Number(validDays)

  const updated = await prisma.promo.update({
    where: { id },
    data: promoData,
    include: {
      commerce: { select: { id: true, name: true, logoUrl: true } },
      category: { select: { id: true, name: true, icon: true } },
      requirements: {
        include: {
          bank: { select: { id: true, name: true } },
          wallet: { select: { id: true, name: true } },
          cardNetwork: { select: { id: true, name: true } },
          cardSegmentRef: { select: { id: true, name: true } },
        },
      },
    },
  })

  // Actualizar requirements si vienen
  if (requirements?.length) {
    for (const req of requirements) {
      const { reqId, bankId, walletId, cardNetworkId, cardSegmentId, paymentChannel } = req
      if (!reqId) continue
      const reqData: Record<string, any> = {}
      if (bankId !== undefined) reqData.bankId = bankId || null
      if (walletId !== undefined) reqData.walletId = walletId || null
      if (cardNetworkId !== undefined) reqData.cardNetworkId = cardNetworkId || null
      if (cardSegmentId !== undefined) reqData.cardSegmentId = cardSegmentId || null
      if (paymentChannel !== undefined) reqData.paymentChannel = paymentChannel
      if (Object.keys(reqData).length) {
        await prisma.promoRequirement.update({ where: { id: reqId }, data: reqData })
      }
    }

    // Re-fetch con requirements actualizados
    const final = await prisma.promo.findUnique({
      where: { id },
      include: {
        commerce: { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true, icon: true } },
        requirements: {
          include: {
            bank: { select: { id: true, name: true } },
            wallet: { select: { id: true, name: true } },
            cardNetwork: { select: { id: true, name: true } },
            cardSegmentRef: { select: { id: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json({ promo: final })
  }

  return NextResponse.json({ promo: updated })
}
