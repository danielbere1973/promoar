export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCommerceDetailCache } from '@/lib/cache/detailCache'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').trim()
    const categoryId = searchParams.get('categoryId') || ''
    const hasBranches = searchParams.get('hasBranches') || 'all' // 'all' | 'yes' | 'no'
    const locationModel = searchParams.get('locationModel') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    if (categoryId) {
      where.defaultCategoryId = categoryId
    }

    if (locationModel) {
      where.locationModel = locationModel
    }

    if (hasBranches === 'yes') {
      where.branches = { some: {} }
    } else if (hasBranches === 'no') {
      where.branches = { none: {} }
    }

    const [total, commerces, categories] = await Promise.all([
      prisma.commerce.count({ where }),
      prisma.commerce.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          website: true,
          instagramUrl: true,
          active: true,
          locationModel: true,
          stacksWithBankPromos: true,
          defaultCategory: {
            select: { id: true, name: true, color: true, icon: true },
          },
          _count: {
            select: {
              branches: true,
              promos: { where: { status: 'ACTIVE' } },
              aliases: true,
            },
          },
        },
        orderBy: [
          { activePromoCount: 'desc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.category.findMany({
        select: { id: true, name: true, icon: true, color: true },
        orderBy: { order: 'asc' },
      }),
    ])

    return NextResponse.json({
      commerces,
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('[GET /api/admin/commerces]', error)
    return NextResponse.json({ error: error.message || 'Error al listar comercios' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, logoUrl, website, instagramUrl, defaultCategoryId, locationModel, stacksWithBankPromos } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del comercio es requerido' }, { status: 400 })
    }

    const trimmedName = name.trim()
    let baseSlug = slugify(trimmedName)
    let finalSlug = baseSlug
    let counter = 1

    while (await prisma.commerce.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter}`
      counter++
    }

    const commerce = await prisma.commerce.create({
      data: {
        name: trimmedName,
        slug: finalSlug,
        logoUrl: logoUrl?.trim() || null,
        website: website?.trim() || null,
        instagramUrl: instagramUrl?.trim() || null,
        defaultCategoryId: defaultCategoryId || null,
        locationModel: locationModel || 'UNKNOWN',
        stacksWithBankPromos: stacksWithBankPromos || 'UNKNOWN',
        active: true,
      },
      include: {
        defaultCategory: true,
        _count: {
          select: { branches: true, promos: true, aliases: true },
        },
      },
    })

    return NextResponse.json({ commerce }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/admin/commerces]', error)
    return NextResponse.json({ error: error.message || 'Error al crear comercio' }, { status: 500 })
  }
}
