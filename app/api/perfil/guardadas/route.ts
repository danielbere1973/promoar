import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        savedPromos: {
          include: {
            promo: {
              include: {
                category: true,
                commerce: true,
                requirements: {
                  include: { bank: true, wallet: true, cardNetwork: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
        }
      }
    })

    if (!user) return NextResponse.json({ error: 'Usuario invalido' }, { status: 401 })

    // Extraemos solo el objeto promo de cada relacion SavedPromo
    const guardadas = ((user as any).savedPromos || []).map((sp: any) => sp.promo)

    return NextResponse.json({ promos: guardadas })
  } catch (error) {
    console.error('[GET /api/perfil/guardadas]', error)
    return NextResponse.json({ error: 'Error al obtener guardadas' }, { status: 500 })
  }
}
