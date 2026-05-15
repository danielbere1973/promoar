import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const forMe = searchParams.get('for_me') === 'true'
    const session = await getServerSession()
    const email = session?.user?.email || req.headers.get('x-user-email')

    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)
    const dayBit = 1 << today.getDay()

    // 1. Obtener perfil del usuario si forMe=true
    let userCards: any[] = []
    if (forMe && email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { financialProfile: { include: { cards: true } } }
      })
      userCards = user?.financialProfile?.cards || []
    }

    // 2. Traemos todas las categorías
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
    })

    // 3. Calculamos conteos (simplificado para performance)
    const result = await Promise.all(
      categories.map(async (cat) => {
        const where: any = {
          categoryId: cat.id,
          status: 'ACTIVE',
          validFrom: { lte: today },
          OR: [
            { validUntil: null },
            { validUntil: { gte: startOfToday } },
          ],
        }

        // Si es personalizado, filtramos por los requisitos que matchean las tarjetas del usuario
        if (forMe && email && userCards.length > 0) {
          where.requirements = {
            some: {
              OR: userCards.map(c => ({
                AND: [
                  c.bankId ? { bankId: c.bankId } : { bankId: null },
                  c.walletId ? { walletId: c.walletId } : { walletId: null },
                  c.cardNetworkId ? { cardNetworkId: c.cardNetworkId } : {},
                  c.cardType ? { cardType: c.cardType } : {},
                ]
              }))
            }
          }
        }

        const promos = await prisma.promo.findMany({
          where,
          select: { validDays: true },
        })

        const todayCount = promos.filter(p => (p.validDays & dayBit) !== 0).length

        const popularSlugs = ['combustible', 'supermercados', 'hogar', 'indumentaria', 'transporte']
        const isPopular = popularSlugs.includes(cat.slug)

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          color: cat.color,
          order: cat.order,
          promoCount: todayCount,
          totalCount: promos.length,
          isPopular,
        }
      })
    )

    return NextResponse.json({ categories: result })
  } catch (error) {
    console.error('[GET /api/categories]', error)
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }
}
