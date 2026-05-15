import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Caché en memoria — evita cachear el HTML crudo (2.75MB > límite Next.js)
const TTL_MS = 20 * 60 * 1000 // 20 minutos
const memCache = new Map<string, { items: any[]; ts: number }>()

// URLs públicas de IOL (no requieren login)
const IOL_URLS: Record<string, string> = {
  cedears:   'https://iol.invertironline.com/mercado/cotizaciones/argentina/Cedears/todos',
  bonos:     'https://iol.invertironline.com/mercado/cotizaciones/argentina/Bonos/todos',
  ons:       'https://iol.invertironline.com/mercado/cotizaciones/argentina/Obligaciones%20Negociables/todos',
  acciones:  'https://iol.invertironline.com/mercado/cotizaciones/argentina/Acciones/todos',
  cauciones: 'https://iol.invertironline.com/mercado/cotizaciones/argentina/cauciones/todas',
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'es-AR,es;q=0.9',
}

function parseNum(s: string): number {
  if (!s || s.trim() === '-' || s.trim() === '') return 0
  // Formato AR: "9.790,00" → 9790.00
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

function parseVariacion(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(',', '.').replace('%', '').trim()) || 0
}

// Parser específico para cauciones
// Estructura: <td class="links"><strong>PLAZO</strong></td><td>MONEDA</td><td>MONTO</td>...
function parseCauciones(html: string): any[] {
  const items: any[] = []
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) return items

  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowPattern.exec(tbodyMatch[1])) !== null) {
    const row = rowMatch[1]

    // Plazo: extraer de <strong>N</strong>
    const strongMatch = row.match(/<strong[^>]*>(\d+)<\/strong>/)
    if (!strongMatch) continue
    const plazo = parseInt(strongMatch[1])

    // Resto de celdas
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let cellMatch
    while ((cellMatch = cellPattern.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    }

    if (cells.length < 4) continue

    items.push({
      simbolo:  `${plazo}d`,
      plazo,
      moneda:   cells[1] ?? '',
      montoPesos: parseNum(cells[2] ?? ''),
      tasa:     parseNum(cells[4] ?? '') || parseNum(cells[5] ?? ''),
    })
  }

  return items.filter(i => i.plazo > 0)
}

// Parsear tabla HTML de IOL
// Estructura: <tr><td>SIMBOLO</td><td>PRECIO</td><td>VARIACION%</td>...
function parseTabla(html: string): any[] {
  const items: any[] = []

  // Encontrar el tbody
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) return items

  const tbody = tbodyMatch[1]

  // Extraer todas las filas
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowPattern.exec(tbody)) !== null) {
    const row = rowMatch[1]

    // Extraer celdas — limpiar tags HTML internos
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let cellMatch

    while ((cellMatch = cellPattern.exec(row)) !== null) {
      // Limpiar HTML interno: links, spans, etc.
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      cells.push(text)
    }

    if (cells.length < 3) continue
    const simbolo = cells[0]
    if (!simbolo || simbolo.length > 20) continue

    items.push({
      simbolo:    cells[0] ?? '',
      precio:     parseNum(cells[1] ?? ''),
      variacion:  parseVariacion(cells[2] ?? ''),
      compra:     parseNum(cells[4] ?? ''),
      venta:      parseNum(cells[5] ?? ''),
      maximo:     parseNum(cells[7] ?? ''),
      minimo:     parseNum(cells[8] ?? ''),
      cierre:     parseNum(cells[9] ?? ''),
      monto:      parseNum(cells[10] ?? ''),
      tir:        cells[11] ? parseVariacion(cells[11]) : undefined,
    })
  }

  return items.filter(i => i.simbolo && i.precio > 0)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tipo: string } }
) {
  const tipo = params.tipo.toLowerCase()
  const url  = IOL_URLS[tipo]

  if (!url) {
    return NextResponse.json({ error: `Tipo desconocido: ${tipo}` }, { status: 400 })
  }

  try {
    // Servir desde caché en memoria si está vigente
    const cached = memCache.get(tipo)
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json({ items: cached.items, tipo, updatedAt: new Date(cached.ts).toISOString() })
    }

    // Fetch sin cache de Next.js (el HTML pesa >2MB)
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })

    if (!res.ok) throw new Error(`IOL scraper HTTP ${res.status}`)

    const html  = await res.text()
    const items = tipo === 'cauciones' ? parseCauciones(html) : parseTabla(html)

    if (items.length === 0) {
      console.warn(`[IOL Scraper /${tipo}] 0 items — html length: ${html.length}`)
      // Mostrar snippet alrededor de "tbody" para ver la estructura real
      const tbodyIdx = html.toLowerCase().indexOf('tbody')
      if (tbodyIdx > 0) {
        console.warn(`[IOL Scraper /${tipo}] tbody snippet:`, html.slice(tbodyIdx, tbodyIdx + 500))
      } else {
        console.warn(`[IOL Scraper /${tipo}] Sin tbody — primeros 500 chars:`, html.slice(0, 500))
      }
    }

    // Ordenar por monto operado descendente (más líquidos primero)
    items.sort((a, b) => b.monto - a.monto)

    // Guardar en caché en memoria (solo los datos parseados, ~KB en vez de ~3MB)
    memCache.set(tipo, { items, ts: Date.now() })

    return NextResponse.json({ items, tipo, updatedAt: new Date().toISOString() })

  } catch (error) {
    console.error(`[IOL Scraper /${tipo}]`, error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
