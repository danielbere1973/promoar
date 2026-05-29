import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const promoId = searchParams.get('promo') || undefined
  const source = searchParams.get('src') || 'promos'

  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  // Registrar click de forma async (no bloquear el redirect)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  prisma.promoClick.create({
    data: {
      promoId: promoId ?? null,
      url,
      source,
      userId: token?.sub ?? null,
    }
  }).catch(() => {}) // silenciar errores — no queremos romper el redirect

  return NextResponse.redirect(url, { status: 302 })
}
