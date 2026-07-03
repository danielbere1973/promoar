import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const REDIRECT_URI = `${BASE_URL}/api/ml-oauth/callback`

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.redirect(`${BASE_URL}/login`)
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } })
  if (user?.role !== 'ADMIN') {
    return NextResponse.redirect(`${BASE_URL}/admin?ml_oauth=error&reason=forbidden`)
  }

  const clientId = process.env.ML_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'ML_CLIENT_ID no configurado' }, { status: 500 })
  }

  const authUrl = new URL('https://auth.mercadolibre.com.ar/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', 'read')

  return NextResponse.redirect(authUrl.toString())
}
