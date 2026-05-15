import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const POPULAR_THRESHOLD = 20

// Tarjetas prioritarias siempre primero en este orden
const CARD_PRIORITY = ['Visa', 'Mastercard', 'American Express', 'Amex', 'AMEX']

function sortCards(cards: { id: string; name: string; slug: string }[]) {
  return cards.sort((a, b) => {
    const ai = CARD_PRIORITY.findIndex(p => a.name.toLowerCase().includes(p.toLowerCase()))
    const bi = CARD_PRIORITY.findIndex(p => b.name.toLowerCase().includes(p.toLowerCase()))
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.name.localeCompare(b.name, 'es')
  })
}

function groupByPopularity<T extends { name: string }>(
  items: (T & { _count: { promoRequirements: number } })[],
  threshold: number
): (T & { popular: boolean })[] {
  const withFlag = items.map(({ _count, ...item }) => ({
    ...(item as T),
    popular: _count.promoRequirements >= threshold,
  }))
  const pop  = withFlag.filter(i => i.popular).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const rest = withFlag.filter(i => !i.popular).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return [...pop, ...rest]
}

export async function GET() {
  try {
    const [banks, wallets, cardNetworks, segments, currencies, accountTypes] = await Promise.all([
      prisma.bank.findMany({
        where: { active: true },
        select: {
          id: true, name: true, slug: true, logoUrl: true,
          cardNetworks: { select: { id: true, name: true } },
          cardSegments: { select: { id: true, name: true, cardNetworkId: true, cardType: true } },
          _count: { select: { promoRequirements: true } },
        },
        orderBy: { name: 'asc' },
      }).then(banks => groupByPopularity(banks, POPULAR_THRESHOLD)),

      prisma.wallet.findMany({
        where: { active: true },
        select: {
          id: true, name: true, slug: true, logoUrl: true,
          _count: { select: { promoRequirements: true } },
        },
        orderBy: { name: 'asc' },
      }).then(wallets => groupByPopularity(wallets, POPULAR_THRESHOLD)),

      prisma.cardNetwork.findMany({
        select: { id: true, name: true, slug: true },
      }).then(sortCards),

      prisma.bankSegment.findMany({ select: { id: true, name: true, bankId: true }, orderBy: { name: 'asc' } }),
      prisma.currency.findMany({ select: { id: true, name: true, code: true, symbol: true }, orderBy: { code: 'asc' } }),
      prisma.financialAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])

    return NextResponse.json({ banks, wallets, cardNetworks, segments, currencies, accountTypes })
  } catch (error) {
    console.error('[GET /api/public/entities]', error)
    return NextResponse.json({ error: 'Error al obtener entidades' }, { status: 500 })
  }
}
