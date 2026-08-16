import { prisma } from '@/lib/prisma'

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

export type NearbyBranchInfo = {
  address: string | null
  city: string | null
  province: string | null
  lat: number
  lng: number
  distanceKm: number
}

export type NearbyByCommerce = Record<string, { count: number; minDistKm: number; branches: NearbyBranchInfo[] }>

const MAX_BRANCHES_PER_COMMERCE = 5

export async function getNearbyBranchesByCommerce(lat: number, lng: number, radius: number): Promise<NearbyByCommerce> {
  const deg = kmToDeg(radius)

  const branches = await prisma.commerceBranch.findMany({
    where: {
      lat: { gte: lat - deg, lte: lat + deg },
      lng: { gte: lng - deg, lte: lng + deg },
    },
    select: { commerceId: true, lat: true, lng: true, address: true, city: true, province: true },
  })

  const byCommerce = new Map<string, NearbyBranchInfo[]>()
  for (const b of branches) {
    const dist = distanceKm(lat, lng, b.lat, b.lng)
    if (dist > radius) continue
    const arr = byCommerce.get(b.commerceId) ?? []
    arr.push({ address: b.address, city: b.city, province: b.province, lat: b.lat, lng: b.lng, distanceKm: dist })
    byCommerce.set(b.commerceId, arr)
  }

  const result: NearbyByCommerce = {}
  for (const [id, arr] of Array.from(byCommerce)) {
    arr.sort((a, b) => a.distanceKm - b.distanceKm)
    result[id] = {
      count: arr.length,
      minDistKm: Math.round(arr[0].distanceKm * 10) / 10,
      branches: arr.slice(0, MAX_BRANCHES_PER_COMMERCE).map(b => ({ ...b, distanceKm: Math.round(b.distanceKm * 10) / 10 })),
    }
  }
  return result
}
