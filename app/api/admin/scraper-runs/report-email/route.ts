import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'
import { sendScraperReportEmail, ScraperRunResult } from '@/lib/scraperReportEmail'

export const dynamic = 'force-dynamic'

// POST /api/admin/scraper-runs/report-email — dispara el email de reporte ejecutivo
// al terminar una corrida (individual o batch). Lo llama el admin panel en el frontend
// después de acumular los resultados de todos los scrapers corridos, para no mandar
// un email por cada scraper cuando se usa "Ejecutar todos" (39 scrapers = 39 emails).
export async function POST(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { results: ScraperRunResult[]; batchLabel?: string }
  if (!Array.isArray(body.results) || body.results.length === 0) {
    return NextResponse.json({ error: 'Missing results' }, { status: 400 })
  }

  // Dos envíos: el resumen completo siempre, y un alert separado solo si hubo errores
  // (mismo contenido pero asunto distinto — pedido explícito de Pablo: "Email al
  // terminar cada corrida" + "Email de alerta si algo falló", ambos, no uno u otro).
  await sendScraperReportEmail({ results: body.results, batchLabel: body.batchLabel })
  await sendScraperReportEmail({ results: body.results, batchLabel: body.batchLabel, onlyOnError: true })

  return NextResponse.json({ ok: true })
}
