import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 7200 // 2 horas

const DIVISAS_TARGET = ['dolar', 'euro', 'real', 'libra']

function parseValue(str: string): number {
  const s = str.trim()
  // BNA puede usar "1.370,00" (AR) o "1370.0000" (US) según el día
  // Si tiene coma → formato AR (punto=miles, coma=decimal)
  // Si no tiene coma → formato US (punto=decimal)
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(s) || 0
}

export async function GET() {
  try {
    const res = await fetch('https://www.bna.com.ar', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      next: { revalidate: 7200 },
    })

    if (!res.ok) throw new Error(`BNA HTTP ${res.status}`)

    const html = await res.text()

    // Extraer fecha de la tabla
    const fechaMatch = html.match(/<th[^>]*class="fechaCot"[^>]*>([^<]+)<\/th>/)
    const fecha = fechaMatch ? fechaMatch[1].trim() : null

    // Extraer hora de actualización
    const horaMatch = html.match(/Hora\s+Actualizaci[oó]n[^:]*:\s*(\d{1,2}:\d{2})/)
    const hora = horaMatch ? horaMatch[1] : null

    // Extraer filas — el HTML de BNA tiene saltos y espacios variables entre tds
    // Buscamos el patrón: <td class="tit">NOMBRE</td> ... <td>COMPRA</td> ... <td>VENTA</td>
    const rowPattern = /<td[^>]*class="tit"[^>]*>\s*([^<]+?)\s*<\/td>[\s\S]*?<td>\s*([0-9.,]+)\s*<\/td>[\s\S]*?<td>\s*([0-9.,]+)\s*<\/td>/gi
    const divisas: { nombre: string; codigo: string; compra: number; venta: number; per100: boolean }[] = []

    let match
    while ((match = rowPattern.exec(html)) !== null) {
      const nombre = match[1].trim()
      const nombreLower = nombre.toLowerCase()
      const esPer100 = nombre.includes('*')

      const isTarget = DIVISAS_TARGET.some(d => nombreLower.includes(d))
      if (!isTarget) continue

      let codigo = 'OTRO'
      if (nombreLower.includes('dolar')) codigo = 'USD'
      else if (nombreLower.includes('euro')) codigo = 'EUR'
      else if (nombreLower.includes('real')) codigo = 'BRL'
      else if (nombreLower.includes('libra')) codigo = 'GBP'

      divisas.push({
        nombre: nombre.replace(/\s*\*\s*$/, '').trim(),
        codigo,
        compra: parseValue(match[2]),
        venta:  parseValue(match[3]),
        per100: esPer100,
      })
    }

    // Asegurar orden USD → EUR → BRL
    const order = ['USD', 'EUR', 'BRL', 'GBP']
    divisas.sort((a, b) => order.indexOf(a.codigo) - order.indexOf(b.codigo))

    return NextResponse.json({ divisas, fecha, hora, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[GET /api/finanzas/divisas]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
