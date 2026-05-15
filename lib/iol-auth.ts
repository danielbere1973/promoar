/**
 * IOL (InvertirOnline) — gestión de token con caché en memoria.
 * Bearer token válido 15 min → se renueva automáticamente con refresh_token.
 */

const TOKEN_URL = 'https://api.invertironline.com/token'

interface TokenCache {
  accessToken: string
  refreshToken: string
  expiresAt: number  // timestamp ms
}

let cache: TokenCache | null = null

async function fetchNewToken(): Promise<TokenCache> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username:   process.env.IOL_USERNAME ?? '',
      password:   process.env.IOL_PASSWORD ?? '',
      grant_type: 'password',
    }),
  })
  if (!res.ok) throw new Error(`IOL auth failed: HTTP ${res.status}`)
  const data = await res.json()
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + (data.expires_in ?? 840) * 1000 - 30_000, // -30s de margen
  }
}

async function refreshToken(rt: string): Promise<TokenCache> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: rt,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`IOL refresh failed: HTTP ${res.status}`)
  const data = await res.json()
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + (data.expires_in ?? 840) * 1000 - 30_000,
  }
}

export async function getIOLToken(): Promise<string> {
  // Token vigente
  if (cache && Date.now() < cache.expiresAt) {
    return cache.accessToken
  }
  // Refresh si hay token guardado
  if (cache?.refreshToken) {
    try {
      cache = await refreshToken(cache.refreshToken)
      return cache.accessToken
    } catch {
      // Si el refresh falla, re-autenticar
    }
  }
  // Login fresco
  cache = await fetchNewToken()
  return cache.accessToken
}

export async function iolFetch(path: string): Promise<any> {
  const token = await getIOLToken()
  const res = await fetch(`https://api.invertironline.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IOL API error: HTTP ${res.status} — ${path} | ${body.slice(0, 200)}`)
  }
  return res.json()
}
