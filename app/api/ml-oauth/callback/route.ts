import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const REDIRECT_URI = `${BASE_URL}/api/ml-oauth/callback`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${BASE_URL}/admin?ml_oauth=error&reason=${error}`)
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'ML_CLIENT_ID / ML_CLIENT_SECRET no configurados' }, { status: 500 })
  }

  const cookies = req.headers.get('cookie') || ''
  const mlCv = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('ml_cv='))
  const codeVerifier = mlCv ? mlCv.split('=')[1] : undefined

  try {
    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
    }
    if (codeVerifier) body.code_verifier = codeVerifier

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(10000),
    })

    const text = await res.text()
    if (!res.ok) {
      console.error(`[ML OAuth] code exchange HTTP ${res.status} — ${text}`)
      return NextResponse.json({ error: 'ML exchange failed', status: res.status, body: text, redirect_uri: REDIRECT_URI, client_id: clientId })
    }

    const data = JSON.parse(text)
    const accessToken: string = data.access_token
    const refreshToken: string | undefined = data.refresh_token
    const expiresIn: number = data.expires_in
    const scope: string = data.scope || ''

    // Guardar refresh_token si viene (scope offline_access), sino guardar access_token con TTL
    if (refreshToken) {
      await prisma.siteConfig.upsert({
        where: { key: 'ml_refresh_token' },
        update: { value: refreshToken },
        create: { key: 'ml_refresh_token', value: refreshToken },
      })
      console.log(`[ML OAuth] OK con refresh_token — scope: "${scope}", expires_in: ${expiresIn}s`)
    } else {
      // Sin refresh_token: guardamos el access_token directamente con su expiración
      const expiresAt = Date.now() + (expiresIn - 300) * 1000
      await prisma.siteConfig.upsert({
        where: { key: 'ml_access_token' },
        update: { value: JSON.stringify({ token: accessToken, expiresAt }) },
        create: { key: 'ml_access_token', value: JSON.stringify({ token: accessToken, expiresAt }) },
      })
      // Limpiar refresh_token viejo para no confundir el token endpoint
      await prisma.siteConfig.deleteMany({ where: { key: 'ml_refresh_token' } }).catch(() => {})
      console.log(`[ML OAuth] OK sin refresh_token — scope: "${scope}", expires_in: ${expiresIn}s, access_token guardado en DB`)
    }

    return NextResponse.redirect(
      `${BASE_URL}/admin?ml_oauth=ok&scope=${encodeURIComponent(scope)}`
    )
  } catch (e: any) {
    console.error(`[ML OAuth] excepción: ${e.message}`)
    return NextResponse.redirect(`${BASE_URL}/admin?ml_oauth=error&reason=exception`)
  }
}
