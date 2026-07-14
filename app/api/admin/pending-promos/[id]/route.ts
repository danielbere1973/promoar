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
  const { title, description, commerceId, categoryId, validDays, requirements, deletedReqIds } = body

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

  // Borrar requirements marcados para eliminación
  if (deletedReqIds?.length) {
    await prisma.promoRequirement.deleteMany({ where: { id: { in: deletedReqIds } } })
  }

  const reqInclude = {
    bank: { select: { id: true, name: true } },
    wallet: { select: { id: true, name: true } },
    cardNetwork: { select: { id: true, name: true } },
    cardSegmentRef: { select: { id: true, name: true } },
  }

  // Crear/actualizar requirements si vienen
  if (requirements?.length) {
    for (const req of requirements) {
      const { reqId, bankId, walletId, cardNetworkId, cardSegmentId, paymentChannel,
              cap, capPeriod, capUnlimited, minPurchase } = req
      if (!reqId) {
        // Nuevo requirement — necesita al menos discountType/discountValue con default razonable
        await prisma.promoRequirement.create({
          data: {
            promoId: id,
            bankId: bankId || null,
            walletId: walletId || null,
            cardNetworkId: cardNetworkId || null,
            cardSegmentId: cardSegmentId || null,
            paymentChannel: paymentChannel || 'ANY',
            discountType: req.discountType || 'PERCENTAGE_REINTEGRO',
            discountValue: req.discountValue != null && req.discountValue !== '' ? Number(req.discountValue) : 0,
            cap: cap != null && cap !== '' ? Number(cap) : null,
            capPeriod: capPeriod || null,
            capUnlimited: Boolean(capUnlimited),
            minPurchase: minPurchase != null && minPurchase !== '' ? Number(minPurchase) : null,
          },
        })
        continue
      }
      const reqData: Record<string, any> = {}
      if (bankId !== undefined) reqData.bankId = bankId || null
      if (walletId !== undefined) reqData.walletId = walletId || null
      if (cardNetworkId !== undefined) reqData.cardNetworkId = cardNetworkId || null
      if (cardSegmentId !== undefined) reqData.cardSegmentId = cardSegmentId || null
      if (paymentChannel !== undefined) reqData.paymentChannel = paymentChannel
      if (req.discountType !== undefined) reqData.discountType = req.discountType
      if (req.discountValue !== undefined) reqData.discountValue = req.discountValue != null && req.discountValue !== '' ? Number(req.discountValue) : 0
      if (cap !== undefined) reqData.cap = cap != null && cap !== '' ? Number(cap) : null
      if (capPeriod !== undefined) reqData.capPeriod = capPeriod || null
      if (capUnlimited !== undefined) reqData.capUnlimited = Boolean(capUnlimited)
      if (minPurchase !== undefined) reqData.minPurchase = minPurchase != null && minPurchase !== '' ? Number(minPurchase) : null
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
        requirements: { include: reqInclude },
      },
    })
    return NextResponse.json({ promo: final })
  }

  // Si solo se borraron requirements (sin crear/editar), re-fetch igual para reflejarlo
  if (deletedReqIds?.length) {
    const final = await prisma.promo.findUnique({
      where: { id },
      include: {
        commerce: { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true, icon: true } },
        requirements: { include: reqInclude },
      },
    })
    return NextResponse.json({ promo: final })
  }

  return NextResponse.json({ promo: updated })
}
