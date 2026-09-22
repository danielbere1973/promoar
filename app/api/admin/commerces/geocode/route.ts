export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'La dirección debe tener al menos 3 caracteres' }, { status: 400 })
    }

    const cleanQuery = query.trim()
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
    nominatimUrl.searchParams.set('q', cleanQuery)
    nominatimUrl.searchParams.set('format', 'json')
    nominatimUrl.searchParams.set('addressdetails', '1')
    nominatimUrl.searchParams.set('limit', '5')
    nominatimUrl.searchParams.set('countrycodes', 'ar')

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'PromoAR-CommerceAdmin/1.0 (soporte@promoar.com.ar)',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Error en Nominatim: ${response.status}` }, { status: 502 })
    }

    const rawResults = await response.json()
    if (!Array.isArray(rawResults)) {
      return NextResponse.json({ results: [] })
    }

    const results = rawResults.map((item: any) => {
      const addr = item.address || {}
      const street = addr.road || addr.pedestrian || addr.street || ''
      const number = addr.house_number || ''
      const addressLine = [street, number].filter(Boolean).join(' ') || item.display_name.split(',')[0]

      const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || 'CABA'
      const province = addr.state || 'Buenos Aires'

      return {
        placeId: String(item.place_id),
        osmId: String(item.osm_id),
        osmType: item.osm_type,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
        address: addressLine,
        city,
        province,
        rawAddress: addr,
      }
    })

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('[POST /api/admin/commerces/geocode]', error)
    return NextResponse.json({ error: error.message || 'Error al geocodificar dirección' }, { status: 500 })
  }
}
