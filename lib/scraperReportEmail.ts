import { Resend } from 'resend'

// Reporte ejecutivo de corridas de scraper por email — pedido por Pablo 4/9/2026
// ("no puede ser que yo no pueda ver el resultado en forma inmediata y, en lo
// posible, por mail"). Se dispara desde /api/admin/scrape al cerrar cada corrida.

const REPORT_TO = process.env.SCRAPER_REPORT_EMAIL || 'danielbere@gmail.com'

export type ScraperRunResult = {
  scraperId: string
  status: 'success' | 'error'
  found?: number
  processed?: number
  skipped?: number
  message?: string | null
  trigger?: string | null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildRow(r: ScraperRunResult): string {
  const ok = r.status === 'success'
  const badge = ok
    ? `<span style="background:#DCFCE7;color:#15803D;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">OK</span>`
    : `<span style="background:#FEE2E2;color:#B91C1C;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">ERROR</span>`
  const detail = ok
    ? `${r.found ?? 0} leídas · ${r.processed ?? 0} guardadas · ${r.skipped ?? 0} sin cambios`
    : escapeHtml((r.message || 'Error desconocido').slice(0, 200))
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;font-weight:700;color:#1E3A5F">${escapeHtml(r.scraperId)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee">${badge}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555">${detail}</td>
  </tr>`
}

function buildHtml(opts: { title: string; subtitle: string; results: ScraperRunResult[] }): string {
  const { title, subtitle, results } = opts
  const errCount = results.filter(r => r.status === 'error').length
  const rows = results.map(buildRow).join('')
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="background:${errCount > 0 ? '#7A1F1F' : '#1E3A5F'};padding:28px 32px">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px">PromoAR</p>
          <p style="margin:4px 0 0;color:${errCount > 0 ? '#f3c9c9' : '#93b4d4'};font-size:13px">${escapeHtml(title)}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px">
          <p style="margin:0;color:#555;font-size:13px">${escapeHtml(subtitle)}</p>
        </td></tr>
        <tr><td style="padding:8px 32px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <thead>
              <tr>
                <th align="left" style="padding:8px 12px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Scraper</th>
                <th align="left" style="padding:8px 12px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Estado</th>
                <th align="left" style="padding:8px 12px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Detalle</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="margin:0;color:#bbb;font-size:11px">PromoAR · Reporte automático de scrapers</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Envía el reporte de una corrida (individual o batch). No lanza si Resend falla —
// el resultado del scraper ya se guardó en ScraperRun, el email es best-effort.
export async function sendScraperReportEmail(opts: {
  results: ScraperRunResult[]
  batchLabel?: string // ej. "Ejecutar todos (local)"
  onlyOnError?: boolean // si true, no envía cuando todo salió OK (para el alert separado)
}): Promise<void> {
  const { results, batchLabel, onlyOnError } = opts
  if (results.length === 0) return

  const errCount = results.filter(r => r.status === 'error').length
  if (onlyOnError && errCount === 0) return

  if (!process.env.RESEND_API_KEY) {
    console.error('[scraperReportEmail] RESEND_API_KEY no configurada, se omite el envío')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const single = results.length === 1
  const title = onlyOnError
    ? `⚠️ ${errCount} scraper${errCount === 1 ? '' : 's'} con error`
    : single
      ? `Scraper ${results[0].scraperId}: ${results[0].status === 'success' ? 'OK' : 'ERROR'}`
      : `Corrida de scrapers${batchLabel ? ` — ${batchLabel}` : ''}`
  const subtitle = single
    ? `Resultado de la corrida de "${results[0].scraperId}"`
    : `${results.length} scraper${results.length === 1 ? '' : 's'} corrido${results.length === 1 ? '' : 's'}${errCount > 0 ? ` · ${errCount} con error` : ''}`

  try {
    await resend.emails.send({
      from: 'PromoAR <noreply@promoar.com.ar>',
      to: REPORT_TO,
      subject: `[PromoAR] ${title}`,
      html: buildHtml({ title, subtitle, results }),
    })
  } catch (e) {
    console.error('[scraperReportEmail] Error enviando email:', e)
  }
}
