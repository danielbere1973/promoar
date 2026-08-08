import { NextRequest, NextResponse } from 'next/server'
import { getNearbyBranchesByCommerce } from '@/lib/nearbyBranches'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '5') // km, default 5

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 })
  }

  const result = await getNearbyBranchesByCommerce(lat, lng, radius)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
