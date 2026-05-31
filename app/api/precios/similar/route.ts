import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Busca productos similares por categoría VTEX en un supermercado específico
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supermarket = searchParams.get('super') || ''
  const categoryId = searchParams.get('catId') || ''
  const excludeEan = searchParams.get('excludeEan') || ''

  if (!supermarket || !categoryId) {
    return NextResponse.json({ error: 'Missing super or catId' }, { status: 400 })
  }

  const VTEX_BASES: Record<string, string> = {
    'Jumbo': 'https://www.jumbo.com.ar',
    'Disco': 'https://www.disco.com.ar',
    'Vea': 'https://www.vea.com.ar',
    'Coto': 'https://www.cotodigital3.com.ar',
    'Carrefour': 'https://www.carrefour.com.ar',
    'Más Online': 'https://www.masonline.com.ar',
    'DIA': 'https://diaonline.supermercadosdia.com.ar',
  }

  const baseUrl = VTEX_BASES[supermarket]
  if (!baseUrl) return NextResponse.json({ results: [] })

  try {
    // Limpiar el categoryId — puede venir como "/2/38/" → extraer el último número
    const cleanCatId = categoryId.replace(/\/$/, '').split('/').filter(Boolean).pop() || categoryId

    const url = `${baseUrl}/api/catalog_system/pub/products/search?fq=C:/${cleanCatId}/&_from=0&_to=19&O=OrderByTopSaleDESC`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 300 }
    })

    if (!res.ok) return NextResponse.json({ results: [] })

    const products = await res.json()

    const results = products
      .flatMap((p: any) => p.items || [])
      .filter((item: any) => !excludeEan || String(item.ean) !== excludeEan)
      .slice(0, 20)
      .map((item: any) => {
        const p = products.find((prod: any) => prod.items?.some((i: any) => i.itemId === item.itemId))
        const offer = item.sellers?.[0]?.commertialOffer || {}
        const price = offer.Price || 0
        return {
          ean: String(item.ean || ''),
          itemId: item.itemId,
          name: p?.productName || item.name || '',
          brand: p?.brand || '',
          price,
          imageUrl: item.images?.[0]?.imageUrl || '',
        }
      })
      .filter((r: any) => r.price > 0)

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
