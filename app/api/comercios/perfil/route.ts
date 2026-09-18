import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { name, logoUrl, website, instagramUrl } = await request.json()
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    // Verificar que el usuario tenga un comercio aprobado
    const userCommerce = await prisma.userCommerce.findFirst({
      where: { userId: session.user.id, status: 'APPROVED' },
      include: { commerce: true }
    })

    if (!userCommerce) {
      return NextResponse.json({ error: 'No tienes un comercio aprobado' }, { status: 403 })
    }

    // Actualizar el comercio
    const updated = await prisma.commerce.update({
      where: { id: userCommerce.commerce.id },
      data: {
        name,
        logoUrl: logoUrl || null,
        website: website || null,
        instagramUrl: instagramUrl || null
      }
    })

    return NextResponse.json({ ok: true, commerce: updated })
  } catch (error: any) {
    console.error('Error al actualizar perfil de comercio:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
