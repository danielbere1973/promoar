import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Radio en km → grados (aprox, válido para Argentina)
function kmToDeg(km: number) {
  return km / 111
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '5') // km, default 5

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 })
  }

  const deg = kmToDeg(radius)
  const MAX_BRANCHES_PER_COMMERCE = 5

  // Buscar sucursales dentro del bounding box (rápido, sin trig en DB)
  const branches = await prisma.commerceBranch.findMany({
    where: {
      lat: { gte: lat - deg, lte: lat + deg },
      lng: { gte: lng - deg, lte: lng + deg },
    },
    select: { commerceId: true, lat: true, lng: true, address: true, city: true, province: true },
  })

  // Filtrar por distancia real y agrupar por commerceId
  type BranchWithDist = { address: string | null; city: string | null; province: string | null; lat: number; lng: number; distanceKm: number }
  const byCommerce = new Map<string, BranchWithDist[]>()
  for (const b of branches) {
    const dist = distanceKm(lat, lng, b.lat, b.lng)
    if (dist > radius) continue
    const arr = byCommerce.get(b.commerceId) ?? []
    arr.push({ address: b.address, city: b.city, province: b.province, lat: b.lat, lng: b.lng, distanceKm: dist })
    byCommerce.set(b.commerceId, arr)
  }

  // Resultado: { commerceId → { count, minDistKm, branches: [...top N más cercanas] } }
  const result: Record<string, { count: number; minDistKm: number; branches: BranchWithDist[] }> = {}
  for (const [id, arr] of Array.from(byCommerce)) {
    arr.sort((a, b) => a.distanceKm - b.distanceKm)
    result[id] = {
      count: arr.length,
      minDistKm: Math.round(arr[0].distanceKm * 10) / 10,
      branches: arr.slice(0, MAX_BRANCHES_PER_COMMERCE).map(b => ({ ...b, distanceKm: Math.round(b.distanceKm * 10) / 10 })),
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
