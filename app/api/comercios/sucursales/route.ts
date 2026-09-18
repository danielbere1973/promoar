import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await prisma.userCommerce.findFirst({
    where: { userId: session.user.id, status: 'APPROVED' },
    include: { commerce: true }
  })
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const branches = await prisma.commerceBranch.findMany({
    where: { commerceId: userCommerce.commerceId },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ branches })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await prisma.userCommerce.findFirst({
    where: { userId: session.user.id, status: 'APPROVED' }
  })
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const { name, address, city, province } = await request.json()
    if (!address || !city || !province) {
      return NextResponse.json({ error: 'Dirección, ciudad y provincia son obligatorios' }, { status: 400 })
    }

    // Geocodificar con Nominatim
    const query = `${address}, ${city}, ${province}`
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
    nominatimUrl.searchParams.set('q', query)
    nominatimUrl.searchParams.set('format', 'json')
    nominatimUrl.searchParams.set('limit', '1')
    nominatimUrl.searchParams.set('countrycodes', 'ar')

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'PromoAR-B2B/1.0 (soporte@promoar.com.ar)',
      },
    })

    if (!response.ok) throw new Error('Error al geocodificar')
    const results = await response.json()
    
    if (results.length === 0) {
      return NextResponse.json({ error: 'No se pudo encontrar la dirección en el mapa. Verificá que sea correcta.' }, { status: 400 })
    }

    const item = results[0]
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)

    // Crear la sucursal
    const branch = await prisma.commerceBranch.create({
      data: {
        commerceId: userCommerce.commerceId,
        name: name || null,
        address,
        city,
        province,
        lat,
        lng,
        source: 'B2B',
        osmId: String(item.osm_id)
      }
    })

    return NextResponse.json({ ok: true, branch })
  } catch (error: any) {
    console.error('Error creando sucursal:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userCommerce = await prisma.userCommerce.findFirst({
    where: { userId: session.user.id, status: 'APPROVED' }
  })
  if (!userCommerce) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  try {
    // Validar que la sucursal le pertenece al comercio
    const branch = await prisma.commerceBranch.findUnique({ where: { id } })
    if (!branch || branch.commerceId !== userCommerce.commerceId) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    await prisma.commerceBranch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch(error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
