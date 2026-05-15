import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// TEM → TNA (simple) y TEA (compuesta)
function temToTna(tem: number): number {
  return Math.round(tem * 12 * 100) / 100
}
function temToTea(tem: number): number {
  return Math.round(((Math.pow(1 + tem / 100, 12) - 1) * 100) * 100) / 100
}

// Decodificar nombre legible desde el ticker
// Formato: [S|X|T][DD][M][YY]
// S = LECAP, X = BONCAP, T = otros
const MONTH_CODE: Record<string, string> = {
  E:'Ene', F:'Feb', H:'Mar', A:'Abr', M:'May', J:'Jun',
  L:'Jul', G:'Ago', S:'Sep', O:'Oct', N:'Nov', D:'Dic',
}
function decodeTicker(ticker: string): { tipo: 'LECAP' | 'BONCAP' | 'OTRO'; desc: string } {
  const m = ticker.match(/^([A-Z])(\d{1,2})([A-Z])(\d{1,2})$/)
  if (!m) return { tipo: 'OTRO', desc: ticker }
  const prefix = m[1]
  const day    = m[2]
  const month  = MONTH_CODE[m[3]] ?? m[3]
  const year   = '20' + m[4]
  const desc   = `${parseInt(day)} ${month} ${year}`
  const tipo   = prefix === 'S' ? 'LECAP' : prefix === 'X' ? 'BONCAP' : 'OTRO'
  return { tipo, desc }
}

export async function GET() {
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/letras', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // cachear 1 hora
    })

    if (!res.ok) throw new Error(`ArgentinaDatos HTTP ${res.status}`)

    const data: any[] = await res.json()

    const hoy = new Date()

    const items = data
      .map((item: any) => {
        const { tipo, desc } = decodeTicker(item.ticker ?? '')
        const venc = item.fechaVencimiento ? new Date(item.fechaVencimiento + 'T00:00:00') : null
        const diasAlVenc = venc ? Math.round((venc.getTime() - hoy.getTime()) / 86_400_000) : null

        const tem  = item.tem  != null ? parseFloat(item.tem)  : null
        const vpv  = item.vpv  != null ? parseFloat(item.vpv)  : null
        const tna  = tem != null ? temToTna(tem) : null
        const tea  = tem != null ? temToTea(tem) : null

        return {
          ticker:          item.ticker,
          tipo,
          descripcion:     desc,
          vencimiento:     item.fechaVencimiento ?? null,
          diasAlVenc,
          precio:          vpv,
          tem,
          tna,
          tea,
        }
      })
      .filter(i => i.diasAlVenc == null || i.diasAlVenc > 0) // excluir vencidos
      .sort((a, b) => (b.tna ?? 0) - (a.tna ?? 0))

    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[GET /api/finanzas/lecaps]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
