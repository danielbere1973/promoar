import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const REDIRECT_URI = `${BASE_URL}/api/ml-oauth/callback`

export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } })
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clientId = process.env.ML_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'ML_CLIENT_ID no configurado' }, { status: 500 })
  }

  const authUrl = new URL('https://auth.mercadolibre.com.ar/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', 'read offline_access')

  return NextResponse.redirect(authUrl.toString())
}
