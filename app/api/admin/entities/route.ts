import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateEntitiesCache, invalidateCategoriesCache } from '@/lib/cache/filtersCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [categories, commerces, banks, wallets, cardNetworks, segments, currencies, accountTypes] = await Promise.all([
      prisma.category.findMany({ orderBy: { order: 'asc' } }),
      prisma.commerce.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.bank.findMany({ 
        include: { segments: true, cardNetworks: true, cardSegments: true },
        orderBy: { name: 'asc' } 
      }),
      prisma.wallet.findMany({
        include: { cardNetworks: true, cardSegments: true },
        where: { active: true },
        orderBy: { name: 'asc' }
      }),
      prisma.cardNetwork.findMany({ 
        include: { 
          banks: { select: { id: true, name: true } },
          wallets: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' } 
      }),
      prisma.bankSegment.findMany({ 
        include: { bank: { select: { name: true } } },
        orderBy: { name: 'asc' } 
      }),
      prisma.currency.findMany({ orderBy: { code: 'asc' } }),
      prisma.financialAccountType.findMany({ orderBy: { name: 'asc' } }),
    ])

    // Conteo de promos activas por comercio
    const promoCounts = await prisma.promo.groupBy({
      by: ['commerceId'],
      where: { status: 'ACTIVE' },
      _count: { commerceId: true },
    })
    const promoCountMap = Object.fromEntries(promoCounts.map(p => [p.commerceId, p._count.commerceId]))
    const commercesWithCount = commerces.map(c => ({ ...c, activePromos: promoCountMap[c.id] ?? 0 }))

    // cardSegments requiere migración — devuelve [] si la tabla aún no existe
    let cardSegments: any[] = []
    try {
      cardSegments = await (prisma as any).cardSegment.findMany({
        include: { 
          cardNetwork: { select: { name: true } },
          banks: { select: { id: true, name: true } }
        },
      })
      cardSegments.sort((a: any, b: any) => {
        const netA = a.cardNetwork?.name || ''
        const netB = b.cardNetwork?.name || ''
        if (netA !== netB) return netA.localeCompare(netB)
        if (a.cardType !== b.cardType) return a.cardType.localeCompare(b.cardType)
        return a.name.localeCompare(b.name)
      })
    } catch {
      // tabla card_segments no existe aún — migración pendiente
    }

    return NextResponse.json({
      categories, commerces: commercesWithCount, banks, wallets, cardNetworks, segments, cardSegments, currencies, accountTypes
    })
  } catch (error) {
    console.error('[GET /api/admin/entities]', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

function toSlug(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function POST(req: Request) {
  try {
    const { type, ...data } = await req.json()

    if (type === 'category') {
      const category = await prisma.category.create({
        data: {
          name: data.name,
          slug: toSlug(data.name),
          icon: data.icon || '🏷️',
          color: data.color || '#6366f1',
          order: data.order ?? 99,
        }
      })
      invalidateCategoriesCache()
      return NextResponse.json(category)
    }

    if (type === 'bank') {
      const bank = await prisma.bank.create({
        data: {
          name: data.name,
          slug: toSlug(data.name),
          logoUrl: data.logoUrl,
          active: data.active ?? true,
        }
      })
      invalidateEntitiesCache()
      return NextResponse.json(bank)
    }

    if (type === 'wallet') {
      const wallet = await prisma.wallet.create({
        data: {
          name: data.name,
          slug: toSlug(data.name),
          logoUrl: data.logoUrl,
          active: data.active ?? true,
        }
      })
      invalidateEntitiesCache()
      return NextResponse.json(wallet)
    }

    if (type === 'cardNetwork') {
      const network = await prisma.cardNetwork.create({
        data: {
          name: data.name,
          slug: toSlug(data.name),
        }
      })
      invalidateEntitiesCache()
      return NextResponse.json(network)
    }

    if (type === 'commerce') {
      const commerce = await prisma.commerce.create({
        data: {
          name: data.name,
          slug: toSlug(data.name),
          logoUrl: data.logoUrl || null,
          active: true,
        }
      })
      return NextResponse.json(commerce)
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Error creating entity' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { type, id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    if (type === 'category') {
      const category = await prisma.category.update({
        where: { id },
        data: {
          name: data.name,
          slug: toSlug(data.name),
          icon: data.icon,
          color: data.color,
          order: data.order != null ? Number(data.order) : undefined,
        }
      })
      invalidateCategoriesCache()
      return NextResponse.json(category)
    }

    if (type === 'bank') {
      // Handle relationship update if cardNetworkIds are provided
      const updateData: any = {
        name: data.name,
        logoUrl: data.logoUrl,
        active: data.active,
      }
      if (data.cardNetworkIds?.length) {
        updateData.cardNetworks = {
          set: data.cardNetworkIds.map((cid: string) => ({ id: cid }))
        }
      }
      if (data.cardSegmentIds?.length) {
        updateData.cardSegments = {
          set: data.cardSegmentIds.map((csid: string) => ({ id: csid }))
        }
      }
      const bank = await prisma.bank.update({
        where: { id },
        data: updateData
      })
      invalidateEntitiesCache()
      return NextResponse.json(bank)
    }

    if (type === 'wallet') {
      const updateData: any = {
        name: data.name,
        logoUrl: data.logoUrl,
        active: data.active,
      }
      if (data.cardNetworkIds?.length) {
        updateData.cardNetworks = {
          set: data.cardNetworkIds.map((cid: string) => ({ id: cid }))
        }
      }
      if (data.cardSegmentIds !== undefined) {
        updateData.cardSegments = {
          set: (data.cardSegmentIds as string[]).map(csid => ({ id: csid }))
        }
      }
      const wallet = await prisma.wallet.update({
        where: { id },
        data: updateData
      })
      invalidateEntitiesCache()
      return NextResponse.json(wallet)
    }

    if (type === 'cardNetwork') {
      const network = await prisma.cardNetwork.update({
        where: { id },
        data: { name: data.name }
      })
      invalidateEntitiesCache()
      return NextResponse.json(network)
    }

    if (type === 'commerce') {
      const commerce = await prisma.commerce.update({
        where: { id },
        data: {
          name: data.name,
          logoUrl: data.logoUrl || null,
          active: data.active ?? true,
        }
      })
      return NextResponse.json(commerce)
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Error updating entity' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')
    if (!id || !type) return NextResponse.json({ error: 'Missing ID or Type' }, { status: 400 })

    if (type === 'category') {
      await prisma.category.delete({ where: { id } })
      invalidateCategoriesCache()
    } else if (type === 'bank') {
      await prisma.bank.delete({ where: { id } })
      invalidateEntitiesCache()
    } else if (type === 'wallet') {
      await prisma.wallet.delete({ where: { id } })
      invalidateEntitiesCache()
    } else if (type === 'cardNetwork') {
      await prisma.cardNetwork.delete({ where: { id } })
      invalidateEntitiesCache()
    } else if (type === 'commerce') {
      await prisma.commerce.update({ where: { id }, data: { active: false } })
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting entity' }, { status: 500 })
  }
}
