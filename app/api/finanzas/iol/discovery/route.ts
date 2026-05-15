import { NextResponse } from 'next/server'
import { getIOLToken } from '@/lib/iol-auth'

export const dynamic = 'force-dynamic'

// Variantes a probar
const CANDIDATES = [
  // Portafolio (sabemos que funciona) — ver body completo
  { label: 'portafolio-bCBA',    path: '/api/v2/portafolio/bCBA' },
  // Cotización individual de símbolos conocidos
  { label: 'titulo-GGAL',        path: '/api/v2/Titulos/GGAL/Cotizacion' },
  { label: 'titulo-S31O5',       path: '/api/v2/Titulos/S31O5/Cotizacion' },
  { label: 'titulo-MELI',        path: '/api/v2/Titulos/MELI/Cotizacion' },
  // Buscar títulos por tipo
  { label: 'buscar-letras',      path: '/api/v2/Titulos/BuscarTitulos?Mercado=bCBA&Tipo=Letras' },
  { label: 'buscar-bonos',       path: '/api/v2/Titulos/BuscarTitulos?Mercado=bCBA&Tipo=Bonos' },
  { label: 'buscar-cedears',     path: '/api/v2/Titulos/BuscarTitulos?Mercado=bCBA&Tipo=CEDEAR' },
  // Operaciones disponibles
  { label: 'operaciones',        path: '/api/v2/operaciones' },
  // Cotizaciones con query params en lugar de path
  { label: 'cot-query-bonos',   path: '/api/v2/Cotizaciones?mercado=bCBA&instrumento=Bonos&pais=Argentina' },
]

export async function GET() {
  // 1. Verificar que el token funciona con un endpoint simple
  let token: string
  try {
    token = await getIOLToken()
    console.log('[Discovery] Token obtenido, primeros 20 chars:', token.slice(0, 20))
  } catch (e) {
    return NextResponse.json({ error: 'AUTH FAILED', detail: String(e) }, { status: 500 })
  }

  // 2. Verificar auth con endpoint conocido
  const authTest = await fetch('https://api.invertironline.com/api/v2/cuentas/estado', {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log('[Discovery] /api/v2/cuentas/estado status:', authTest.status)
  // 401 = token inválido, cualquier otra cosa = token OK pero path puede ser incorrecto
  if (authTest.status === 401) {
    return NextResponse.json({ error: 'TOKEN INVÁLIDO (401)' }, { status: 500 })
  }

  const results: { label: string; path: string; status: number; items?: number | null; preview?: string }[] = []

  for (const c of CANDIDATES) {
    try {
      const res = await fetch(`https://api.invertironline.com${c.path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await res.text().catch(() => '')
      let body: any = null
      try { body = JSON.parse(text) } catch {}
      const items = body?.titulos?.length ?? (Array.isArray(body) ? body.length : null)
      const preview = res.ok ? text.slice(0, 300) : text.slice(0, 100)
      results.push({ label: c.label, path: c.path, status: res.status, items, preview })
    } catch (e) {
      results.push({ label: c.label, path: c.path, status: -1, items: null, preview: String(e) })
    }
  }

  return NextResponse.json(results)
}
