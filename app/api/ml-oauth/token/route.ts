import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

let mlTokenCache: { token: string; expiresAt: number } | null = null

export async function GET() {
  if (mlTokenCache && Date.now() < mlTokenCache.expiresAt) {
    return NextResponse.json({ token: mlTokenCache.token })
  }

  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET

  try {
    if (clientId && clientSecret) {
      const dbRefresh = await prisma.siteConfig.findUnique({ where: { key: 'ml_refresh_token' } }).catch(() => null)
      const refreshToken = dbRefresh?.value || process.env.ML_REFRESH_TOKEN
      if (refreshToken) {
        const res = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.refresh_token) {
            await prisma.siteConfig.upsert({
              where: { key: 'ml_refresh_token' },
              update: { value: data.refresh_token },
              create: { key: 'ml_refresh_token', value: data.refresh_token },
            }).catch(() => {})
          }
          mlTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
          return NextResponse.json({ token: data.access_token })
        }
      }
    }

    const dbAccess = await prisma.siteConfig.findUnique({ where: { key: 'ml_access_token' } }).catch(() => null)
    if (dbAccess?.value) {
      const { token, expiresAt } = JSON.parse(dbAccess.value)
      if (Date.now() < expiresAt) {
        mlTokenCache = { token, expiresAt }
        return NextResponse.json({ token })
      }
    }

    return NextResponse.json({ token: null })
  } catch {
    return NextResponse.json({ token: null })
  }
}
