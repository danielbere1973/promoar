'use client'
import { useEffect } from 'react'

export default function MLOAuthHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code || !code.startsWith('TG-')) return

    // Limpiar el code de la URL inmediatamente
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    // Mandar el code al callback que lo canjea por token
    fetch(`/api/ml-oauth/callback?code=${encodeURIComponent(code)}`)
      .then(r => {
        if (r.redirected) {
          window.location.href = r.url
        }
      })
      .catch(() => {})
  }, [])

  return null
}
