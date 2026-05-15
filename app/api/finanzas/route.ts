import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await prisma.financeItem.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    })

    // Agruparlos para que el front los consuma facil
    const tnaWallets = items.filter(i => i.type === 'FCI_MM').sort((a,b) => (b.rateTNA || 0) - (a.rateTNA || 0))
    const cauciones = items.filter(i => i.type === 'CAUCION').sort((a,b) => (a.rateTNA || 0) - (b.rateTNA || 0))
    const lecaps = items.filter(i => i.type === 'LECAP')
    const ons = items.filter(i => i.type === 'ON').sort((a,b) => (b.rateTNA || 0) - (a.rateTNA || 0))

    return NextResponse.json({
      tnaWallets,
      cauciones,
      lecaps,
      ons
    })
  } catch (error) {
    console.error('[GET /api/finanzas]', error)
    return NextResponse.json({ error: 'Error al obtener finanzas' }, { status: 500 })
  }
}
