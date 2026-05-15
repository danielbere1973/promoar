import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TTL_MS = 5 * 60 * 1000 // 5 minutos
const memCache = new Map<string, { items: any[]; ts: number }>()

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

// Listas curadas por sección
const LISTAS: Record<string, { symbol: string; nombre: string }[]> = {
  indices: [
    { symbol: '^MERV',   nombre: 'Merval' },
    { symbol: '^GSPC',   nombre: 'S&P 500' },
    { symbol: '^IXIC',   nombre: 'Nasdaq' },
    { symbol: '^DJI',    nombre: 'Dow Jones' },
    { symbol: '^RUT',    nombre: 'Russell 2000' },
    { symbol: '^NYA',    nombre: 'NYSE Composite' },
    { symbol: '^FTSE',   nombre: 'FTSE 100' },
    { symbol: '^N225',   nombre: 'Nikkei 225' },
    { symbol: '^STOXX50E', nombre: 'Euro Stoxx 50' },
  ],
  'acciones-ar': [
    { symbol: 'GGAL.BA',  nombre: 'Galicia' },
    { symbol: 'YPF.BA',   nombre: 'YPF' },
    { symbol: 'BMA.BA',   nombre: 'Banco Macro' },
    { symbol: 'BBAR.BA',  nombre: 'BBVA Argentina' },
    { symbol: 'TXAR.BA',  nombre: 'Ternium Argentina' },
    { symbol: 'ALUA.BA',  nombre: 'Aluar' },
    { symbol: 'SUPV.BA',  nombre: 'Supervielle' },
    { symbol: 'CRES.BA',  nombre: 'Cresud' },
    { symbol: 'PAMP.BA',  nombre: 'Pampa Energía' },
    { symbol: 'TRAN.BA',  nombre: 'Transener' },
    { symbol: 'CEPU.BA',  nombre: 'Central Puerto' },
    { symbol: 'COME.BA',  nombre: 'Sociedad Comercial' },
    { symbol: 'MIRG.BA',  nombre: 'Mirgor' },
    { symbol: 'LOMA.BA',  nombre: 'Loma Negra' },
    { symbol: 'HARG.BA',  nombre: 'Holcim Argentina' },
  ],
  usa: [
    { symbol: 'AAPL',    nombre: 'Apple' },
    { symbol: 'MSFT',    nombre: 'Microsoft' },
    { symbol: 'NVDA',    nombre: 'Nvidia' },
    { symbol: 'GOOGL',   nombre: 'Alphabet' },
    { symbol: 'AMZN',    nombre: 'Amazon' },
    { symbol: 'META',    nombre: 'Meta' },
    { symbol: 'TSLA',    nombre: 'Tesla' },
    { symbol: 'BRK-B',   nombre: 'Berkshire B' },
    { symbol: 'JPM',     nombre: 'JPMorgan' },
    { symbol: 'V',       nombre: 'Visa' },
    { symbol: 'WMT',     nombre: 'Walmart' },
    { symbol: 'XOM',     nombre: 'ExxonMobil' },
    { symbol: 'UNH',     nombre: 'UnitedHealth' },
    { symbol: 'JNJ',     nombre: 'J&J' },
    { symbol: 'MA',      nombre: 'Mastercard' },
  ],
}

async function fetchTicker(symbol: string, nombre: string) {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null

    const precio      = meta.regularMarketPrice ?? 0
    const cierre      = meta.chartPreviousClose ?? meta.previousClose ?? precio
    const variacion   = cierre > 0 ? Math.round(((precio - cierre) / cierre) * 10000) / 100 : 0
    const cambio      = Math.round((precio - cierre) * 100) / 100

    return {
      symbol,
      nombre,
      precio,
      variacion,
      cambio,
      moneda:   meta.currency ?? 'USD',
      mercado:  meta.exchangeName ?? '',
      volumen:  meta.regularMarketVolume ?? 0,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const tipo    = req.nextUrl.searchParams.get('tipo') ?? 'usa'
  const simbolo = req.nextUrl.searchParams.get('symbol')?.toUpperCase().trim()

  // ── Búsqueda de ticker individual ──
  if (simbolo) {
    const cacheKey = `sym:${simbolo}`
    const cached = memCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json({ items: cached.items, updatedAt: new Date(cached.ts).toISOString() })
    }
    const item = await fetchTicker(simbolo, simbolo)
    const items = item ? [item] : []
    memCache.set(cacheKey, { items, ts: Date.now() })
    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  }

  // ── Lista curada ──
  const lista = LISTAS[tipo]
  if (!lista) return NextResponse.json({ error: `Tipo desconocido: ${tipo}` }, { status: 400 })

  const cached = memCache.get(tipo)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ items: cached.items, updatedAt: new Date(cached.ts).toISOString() })
  }

  try {
    const results = await Promise.all(lista.map(t => fetchTicker(t.symbol, t.nombre)))
    const items = results.filter(Boolean)
    memCache.set(tipo, { items, ts: Date.now() })
    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[Yahoo Finance]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
