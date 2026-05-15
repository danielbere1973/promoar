import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/promos/[id] — detalle completo de una promo (para edición)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const promo = await prisma.promo.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        commerce: true,
        requirements: {
          include: {
            bank: { select: { id: true, name: true } },
            wallet: { select: { id: true, name: true } },
            cardNetwork: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!promo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ promo })
  } catch (error) {
    console.error('[GET /api/promos/:id]', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// PUT /api/promos/[id] — actualizar promo completa
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const {
      title, description,
      uniqueUsePerPeriod, maxUsesPerPeriod, stackable, stackableNote,
      validFrom, validUntil, validDays, validDaysNote,
      validFromHour, validToHour,
      categoryId, commerceId, requirements,
      status, sourceUrl, sourceNote, sourceText, specificDates, provinces,
    } = body

    // Borramos los requirements existentes y los recreamos
    await prisma.promoRequirement.deleteMany({ where: { promoId: params.id } })

    const promo = await prisma.promo.update({
      where: { id: params.id },
      data: {
        title,
        description,
        uniqueUsePerPeriod: uniqueUsePerPeriod ?? false,
        maxUsesPerPeriod: maxUsesPerPeriod ? parseInt(maxUsesPerPeriod) : null,
        stackable: stackable ?? false,
        stackableNote: stackableNote || null,
        validFrom: new Date(validFrom),
        validUntil: validUntil ? new Date(validUntil) : null,
        validDays: validDays ?? 127,
        validDaysNote: validDaysNote || null,
        validFromHour: validFromHour ? parseInt(validFromHour) : null,
        validToHour: validToHour ? parseInt(validToHour) : null,
        categoryId,
        commerceId,
        status: status ?? 'ACTIVE',
        sourceUrl: sourceUrl || null,
        sourceNote: sourceNote || null,
        sourceText: sourceText || null,
        specificDates: specificDates ? JSON.stringify(specificDates) : null,
        provinces: Array.isArray(provinces) ? provinces : [],
        requirements: requirements?.length
          ? {
              create: requirements.map((r: any) => ({
                bankId: r.bankId || null,
                walletId: r.walletId || null,
                cardNetworkId: r.cardNetworkId || null,
                cardType: r.cardType as 'CREDIT' | 'DEBIT' | 'PREPAID' | null || null,
                paymentChannel: r.paymentChannel as 'ANY' | 'QR' | 'NFC' | 'TARJETA_FISICA' || 'ANY',
                accountType: r.accountType as 'ANY' | 'HABERES' | 'JUBILADO' | 'ANSES' || 'ANY',
                segment: r.segment || null,
                discountType: r.discountType || 'PERCENTAGE_REINTEGRO',
                discountValue: r.discountValue ? parseFloat(r.discountValue) : 0,
                nxmN: r.nxmN ? parseInt(r.nxmN) : null,
                nxmM: r.nxmM ? parseInt(r.nxmM) : null,
                minPurchase: r.minPurchase ? parseFloat(r.minPurchase) : null,
                cap: r.cap ? parseFloat(r.cap) : null,
                capPeriod: r.capPeriod || null,
                note: r.note || null,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        commerce: true,
        requirements: { include: { bank: true, wallet: true, cardNetwork: true } },
      },
    })

    return NextResponse.json({ promo })
  } catch (error) {
    console.error('[PUT /api/promos/:id]', error)
    return NextResponse.json({ error: 'Error al actualizar promo' }, { status: 500 })
  }
}

// PATCH /api/promos/[id] — update parcial (solo los campos enviados)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data: any = {}
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.status     !== undefined) data.status     = body.status
    if (body.title      !== undefined) data.title      = body.title

    const promo = await prisma.promo.update({
      where: { id: params.id },
      data,
      include: { category: true, commerce: true },
    })
    return NextResponse.json({ promo })
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// DELETE /api/promos/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.promo.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/promos/:id]', error)
    return NextResponse.json({ error: 'Error al borrar promo' }, { status: 500 })
  }
}
