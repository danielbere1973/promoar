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
    promos?: Record<string, {
      skuId: string
      segment: string
      promoCode: string
      effectiveDiscount: number
      category?: string
      productId?: string
      productName?: string
      ean?: string
      salePrice?: number
    }>
  }

  if (!site || !promos) {
    return NextResponse.json({ error: 'Missing site or promos' }, { status: 400 })
  }

  // Borrar promos anteriores del site antes de insertar las nuevas
  await prisma.vtexPromoCache.deleteMany({ where: { site } })

  const entries = Object.values(promos)
  if (entries.length === 0) return NextResponse.json({ saved: 0 })

  // Insert en batches de 100
  let saved = 0
  const BATCH = 100
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    await prisma.vtexPromoCache.createMany({
      data: batch.map(promo => ({
        site,
        skuId: promo.skuId,
        segment: promo.segment,
        promoCode: promo.promoCode,
        effectiveDiscount: promo.effectiveDiscount,
        category: promo.category ?? null,
        productId: promo.productId ?? null,
        productName: promo.productName ?? null,
        ean: promo.ean ?? null,
        salePrice: promo.salePrice ?? null,
      })),
      skipDuplicates: true,
    })
    saved += batch.length
  }

  console.log(`[vtex-promos] ${site}: ${saved} promos guardadas`)
  return NextResponse.json({ ok: true, saved })
}
