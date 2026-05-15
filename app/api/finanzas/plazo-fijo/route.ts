import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 21600 // 6 horas — las tasas cambian una vez por día

interface BCRAEntry {
  codigo: number
  entidad: string
  logo_url: string
  tasa_con_relacion: number
  tasa_sin_relacion: number
  web: string
}

function calcTEA(tna: number): number {
  if (!tna || tna <= 0) return 0
  return Math.round(((Math.pow(1 + tna / 36500, 365) - 1) * 100) * 100) / 100
}

export async function GET() {
  try {
    const res = await fetch('https://www.bcra.gob.ar/api/endpoints/plazos-fijos.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 21600 },
    })

    if (!res.ok) throw new Error(`BCRA HTTP ${res.status}`)

    const data = await res.json()
    if (!data.success) throw new Error('BCRA API devolvió success=false')

    const all: BCRAEntry[] = [...(data.top10 ?? []), ...(data.otros ?? [])]

    const items = all
      .filter(e => e.tasa_con_relacion > 0 || e.tasa_sin_relacion > 0)
      .map(e => ({
        codigo:         e.codigo,
        entidad:        e.entidad,
        logoUrl:        e.logo_url || null,
        tnaClientes:    e.tasa_con_relacion ?? 0,
        teaClientes:    calcTEA(e.tasa_con_relacion ?? 0),
        tnaNoClientes:  e.tasa_sin_relacion ?? 0,
        teaNoClientes:  calcTEA(e.tasa_sin_relacion ?? 0),
        webUrl:         e.web || null,
        isTop10:        (data.top10 ?? []).some((t: BCRAEntry) => t.codigo === e.codigo),
      }))
      .sort((a, b) => b.tnaClientes - a.tnaClientes)

    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[GET /api/finanzas/plazo-fijo]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
