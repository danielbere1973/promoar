import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const DISCOUNT_TYPES = ['PERCENTAGE_REINTEGRO', 'PERCENTAGE_DESCUENTO', 'BONIFICACION', 'FIXED_AMOUNT', 'NXM', 'CUOTAS_SIN_INTERES']
const PAYMENT_CHANNELS = ['ANY', 'QR', 'NFC', 'TARJETA_FISICA', 'TRANSFERENCIA', 'DINERO_EN_CUENTA', 'LINK_DE_PAGO', 'EFECTIVO']

async function getApprovedUserCommerce(userId: string) {
  return prisma.userCommerce.findFirst({
    where: { userId, status: 'APPROVED' },
    include: { commerce: true }
  })
}

function slugify(title: string, suffix: string) {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base}-${suffix.slice(0, 8)}`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await getApprovedUserCommerce(session.user.id)
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const promos = await prisma.promo.findMany({
    where: { commerceId: userCommerce.commerceId, isDirect: true },
    include: { requirements: true, category: true },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ promos })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await getApprovedUserCommerce(session.user.id)
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const body = await request.json()
    const {
      title,
      description,
      discountType,
      discountValue,
      nxmN,
      nxmM,
      validDays,
      validUntil,
      paymentChannel,
      note
    } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'Título y descripción son obligatorios' }, { status: 400 })
    }
    if (!DISCOUNT_TYPES.includes(discountType)) {
      return NextResponse.json({ error: 'Tipo de descuento inválido' }, { status: 400 })
    }
    if (paymentChannel && !PAYMENT_CHANNELS.includes(paymentChannel)) {
      return NextResponse.json({ error: 'Medio de pago inválido' }, { status: 400 })
    }

    const categoryId = userCommerce.commerce.defaultCategoryId
    if (!categoryId) {
      return NextResponse.json({ error: 'Tu comercio no tiene una categoría asignada. Contactá a soporte.' }, { status: 400 })
    }

    const externalId = randomUUID()

    const promo = await prisma.promo.create({
      data: {
        title,
        description,
        categoryId,
        commerceId: userCommerce.commerceId,
        status: 'ACTIVE',
        isDirect: true,
        source: 'B2B',
        externalId,
        slug: slugify(title, externalId),
        validFrom: new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        validDays: typeof validDays === 'number' ? validDays : 127,
        requirements: {
          create: {
            paymentChannel: paymentChannel || 'ANY',
            discountType,
            discountValue: discountType === 'NXM' ? 0 : Number(discountValue) || 0,
            nxmN: discountType === 'NXM' ? Number(nxmN) || null : null,
            nxmM: discountType === 'NXM' ? Number(nxmM) || null : null,
            note: note || null
          }
        }
      },
      include: { requirements: true, category: true }
    })

    return NextResponse.json({ ok: true, promo })
  } catch (error: any) {
    console.error('Error creando promo directa:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await getApprovedUserCommerce(session.user.id)
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const body = await request.json()
    const { id, title, description, status, discountType, discountValue, nxmN, nxmM, validDays, validUntil, paymentChannel, note } = body

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const existing = await prisma.promo.findUnique({ where: { id }, include: { requirements: true } })
    if (!existing || existing.commerceId !== userCommerce.commerceId || !existing.isDirect) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    if (status && !['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }
    if (discountType && !DISCOUNT_TYPES.includes(discountType)) {
      return NextResponse.json({ error: 'Tipo de descuento inválido' }, { status: 400 })
    }
    if (paymentChannel && !PAYMENT_CHANNELS.includes(paymentChannel)) {
      return NextResponse.json({ error: 'Medio de pago inválido' }, { status: 400 })
    }

    const promo = await prisma.promo.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(validDays !== undefined && { validDays }),
        ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
        ...(existing.requirements[0] && {
          requirements: {
            update: {
              where: { id: existing.requirements[0].id },
              data: {
                ...(paymentChannel !== undefined && { paymentChannel }),
                ...(discountType !== undefined && { discountType }),
                ...(discountValue !== undefined && { discountValue: discountType === 'NXM' ? 0 : Number(discountValue) || 0 }),
                ...(nxmN !== undefined && { nxmN: Number(nxmN) || null }),
                ...(nxmM !== undefined && { nxmM: Number(nxmM) || null }),
                ...(note !== undefined && { note })
              }
            }
          }
        })
      },
      include: { requirements: true, category: true }
    })

    return NextResponse.json({ ok: true, promo })
  } catch (error: any) {
    console.error('Error editando promo directa:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await getApprovedUserCommerce(session.user.id)
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  try {
    const promo = await prisma.promo.findUnique({ where: { id } })
    if (!promo || promo.commerceId !== userCommerce.commerceId || !promo.isDirect) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    await prisma.promo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
