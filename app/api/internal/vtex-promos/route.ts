import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { site, promos } = body as {
    site?: string
    promos?: Record<string, { promoCode: string; effectiveDiscount: number; category?: string }>
  }

  if (!site || !promos) {
    return NextResponse.json({ error: 'Missing site or promos' }, { status: 400 })
  }

  const entries = Object.entries(promos)
  if (entries.length === 0) return NextResponse.json({ saved: 0 })

  // Upsert en batches de 100
  let saved = 0
  const BATCH = 100
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    await prisma.$transaction(
      batch.map(([skuId, promo]) =>
        prisma.vtexPromoCache.upsert({
          where: { site_skuId: { site, skuId } },
          update: { promoCode: promo.promoCode, effectiveDiscount: promo.effectiveDiscount, category: promo.category ?? null },
          create: { site, skuId, promoCode: promo.promoCode, effectiveDiscount: promo.effectiveDiscount, category: promo.category ?? null },
        })
      )
    )
    saved += batch.length
  }

  console.log(`[vtex-promos] ${site}: ${saved} promos guardadas`)
  return NextResponse.json({ ok: true, saved })
}
