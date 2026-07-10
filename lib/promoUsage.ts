import { CapPeriod } from '@prisma/client'

// Argentina es UTC-3 fijo (sin horario de verano) — el server (Vercel) corre en UTC.
export function getArgNow(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}

export function getCurrentPeriod(capPeriod: CapPeriod, now: Date = getArgNow()): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  switch (capPeriod) {
    case 'DAILY':
      return { start, end }

    case 'WEEKLY': {
      // Lunes a domingo. getDay(): 0=domingo..6=sábado
      const dayOfWeek = start.getDay()
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() + diffToMonday)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      return { start: weekStart, end: weekEnd }
    }

    case 'MONTHLY': {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1)
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)
      return { start: monthStart, end: monthEnd }
    }

    case 'PER_TRANSACTION':
    case 'TOTAL':
    default: {
      // Sin reset periódico: período abierto "para siempre" desde una fecha fija de referencia.
      const openStart = new Date(2000, 0, 1)
      const openEnd = new Date(2100, 0, 1)
      return { start: openStart, end: openEnd }
    }
  }
}

export function getPeriodLabel(capPeriod: CapPeriod): string {
  switch (capPeriod) {
    case 'DAILY': return 'diario'
    case 'WEEKLY': return 'semanal'
    case 'MONTHLY': return 'mensual'
    case 'TOTAL': return 'total'
    case 'PER_TRANSACTION': return 'por transacción'
    default: return ''
  }
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function formatRenewalDate(capPeriod: CapPeriod, periodEnd: Date): string | null {
  if (capPeriod === 'TOTAL' || capPeriod === 'PER_TRANSACTION') return null

  const renewal = new Date(periodEnd)
  renewal.setDate(renewal.getDate() + 1)
  renewal.setHours(0, 0, 0, 0)

  if (capPeriod === 'DAILY') return 'mañana'

  const dd = String(renewal.getDate()).padStart(2, '0')
  const mm = String(renewal.getMonth() + 1).padStart(2, '0')

  if (capPeriod === 'WEEKLY') {
    return `el ${DIAS[renewal.getDay()]} ${dd}/${mm}`
  }
  // MONTHLY
  return `el ${dd}/${mm}`
}
