import { NextRequest, NextResponse } from 'next/server'
import { iolFetch } from '@/lib/iol-auth'

export const dynamic = 'force-dynamic'

// Mapa tipo UI → instrumento IOL + mercado
const TIPO_MAP: Record<string, { instrumento: string; mercado: string; label: string }> = {
  lecaps:    { instrumento: 'Letras',    mercado: 'bCBA', label: 'LECAPs / BONCAPs' },
  bonos:     { instrumento: 'Bonos',     mercado: 'bCBA', label: 'Bonos' },
  cedears:   { instrumento: 'cedears',   mercado: 'bCBA', label: 'CEDEARs' },
  ons:       { instrumento: 'on',        mercado: 'bCBA', label: 'ONs' },
  cauciones: { instrumento: 'cauciones', mercado: 'bCBA', label: 'Cauciones' },
}

// Decodifica fecha de vencimiento desde símbolo LECAP/BONCAP
// Formato: [S|X][DD][M][YY]  ej: S31O5 = 31-Oct-2025
const MONTH_CODE: Record<string, number> = {
  E:1, F:2, H:3, A:4, M:5, J:6, L:7, G:8, S:9, O:10, N:11, D:12,
}

function parseVencimiento(simbolo: string): Date | null {
  const m = simbolo.match(/^[A-Z](\d{1,2})([A-Z])(\d{1,2})$/)
  if (!m) return null
  const day   = parseInt(m[1])
  const month = MONTH_CODE[m[2]]
  const year  = 2000 + parseInt(m[3])
  if (!month) return null
  return new Date(year, month - 1, day)
}

function calcTNA(precio: number, vencimiento: Date): number | null {
  const hoy = new Date()
  const dias = Math.round((vencimiento.getTime() - hoy.getTime()) / 86_400_000)
  if (dias <= 0) return null
  // LECAP/BONCAP son de capitalización: TNA = ((100/precio)^(365/dias) - 1) * 100
  const tna = (Math.pow(100 / precio, 365 / dias) - 1) * 100
  return Math.round(tna * 100) / 100
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tipo: string } }
) {
  const tipo = params.tipo.toLowerCase()
  const config = TIPO_MAP[tipo]

  if (!config) {
    return NextResponse.json({ error: `Tipo desconocido: ${tipo}` }, { status: 400 })
  }

  try {
    const data = await iolFetch(
      `/api/v2/Cotizaciones/${config.mercado}/${config.instrumento}/Argentina`
    )

    const titulos: any[] = data.titulos ?? data ?? []

    const items = titulos
      .filter((t: any) => t.ultimoPrecio > 0)
      .map((t: any) => {
        const base = {
          simbolo:      t.simbolo,
          descripcion:  t.descripcion ?? t.simbolo,
          precio:       t.ultimoPrecio,
          variacion:    Math.round((t.variacion ?? 0) * 100) / 100,
          volumen:      t.volumen ?? 0,
          moneda:       t.moneda ?? 'peso_argentino',
          compra:       t.puntas?.precioCompra ?? null,
          venta:        t.puntas?.precioVenta ?? null,
        }

        // Para LECAPs/BONCAPs calcular TNA desde precio y vencimiento
        if (tipo === 'lecaps') {
          const venc = parseVencimiento(t.simbolo)
          const tna  = venc ? calcTNA(t.ultimoPrecio, venc) : null
          return {
            ...base,
            vencimiento: venc ? venc.toISOString().split('T')[0] : null,
            tna,
            esBoncap: t.simbolo?.startsWith('X') ?? false,
          }
        }

        return base
      })
      // LECAPs: ordenar por TNA descendente
      .sort((a: any, b: any) => {
        if (tipo === 'lecaps') return (b.tna ?? 0) - (a.tna ?? 0)
        return b.volumen - a.volumen
      })

    return NextResponse.json({ items, label: config.label, updatedAt: new Date().toISOString() })

  } catch (error) {
    console.error(`[IOL /${tipo}]`, error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
