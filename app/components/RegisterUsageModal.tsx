'use client'
import React, { useState } from 'react'
import { X } from 'lucide-react'

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function formatRenewalDate(capPeriod: string | null | undefined, periodEnd: Date): string | null {
  if (!capPeriod || capPeriod === 'TOTAL' || capPeriod === 'PER_TRANSACTION') return null
  const renewal = new Date(periodEnd)
  renewal.setDate(renewal.getDate() + 1)
  renewal.setHours(0, 0, 0, 0)
  if (capPeriod === 'DAILY') return 'mañana'
  const dd = String(renewal.getDate()).padStart(2, '0')
  const mm = String(renewal.getMonth() + 1).padStart(2, '0')
  if (capPeriod === 'WEEKLY') return `el ${DIAS_SEMANA[renewal.getDay()]} ${dd}/${mm}`
  return `el ${dd}/${mm}`
}

function periodLabel(capPeriod: string | null | undefined): string {
  switch (capPeriod) {
    case 'DAILY': return 'diario'
    case 'WEEKLY': return 'semanal'
    case 'MONTHLY': return 'mensual'
    case 'TOTAL': return 'total'
    default: return ''
  }
}

// Hoy en hora Argentina (UTC-3 fijo), formato yyyy-mm-dd para el <input type="date">.
function todayArgISO(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

// Estimación local del fin de período actual, solo para mostrar la fecha de renovación
// antes de guardar (el backend recalcula el período real al procesar el POST).
function estimatePeriodEnd(capPeriod: string | null | undefined): Date {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000) // aprox. hora Argentina
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  if (capPeriod === 'WEEKLY') {
    const dow = end.getDay()
    const diffToSunday = dow === 0 ? 0 : 7 - dow
    end.setDate(end.getDate() + diffToSunday)
  } else if (capPeriod === 'MONTHLY') {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  }
  return end
}

export type UsageModalRequirement = {
  id: string
  cap: number | null
  capPeriod: string | null
  usage?: { amountUsed: number; cap: number; exhausted: boolean; periodEnd: string | Date } | null
}

type Props = {
  requirement: UsageModalRequirement
  commerceName: string
  discountLabel: string
  onClose: () => void
  onSaved: (usage: { amountUsed: number; cap: number; exhausted: boolean; periodEnd: string } | null) => void
}

export default function RegisterUsageModal({ requirement, commerceName, discountLabel, onClose, onSaved }: Props) {
  const hasCap = requirement.cap != null && !!requirement.capPeriod
  const currentUsed = requirement.usage?.amountUsed ?? 0
  const cap = requirement.cap ?? 0
  const available = Math.max(0, cap - currentUsed)
  const exhausted = hasCap && available <= 0
  const periodEnd = requirement.usage?.periodEnd ?? estimatePeriodEnd(requirement.capPeriod)
  const renewalLabel = hasCap ? formatRenewalDate(requirement.capPeriod, new Date(periodEnd)) : null

  const [amount, setAmount] = useState('')
  const [spentAt, setSpentAt] = useState(() => todayArgISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresá un monto válido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/promo-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId: requirement.id, amount: parsed, spentAt }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'No se pudo registrar el uso')
        setSaving(false)
        return
      }
      const data = await res.json()
      if (!data.usage) {
        onSaved(null)
        return
      }
      onSaved({
        amountUsed: data.usage.amountUsed,
        cap: requirement.cap!,
        exhausted: data.usage.amountUsed >= requirement.cap!,
        periodEnd: data.usage.periodEnd,
      })
    } catch {
      setError('No se pudo registrar el uso')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#0D1B2E] rounded-3xl px-6 pt-6 pb-5 text-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#6E88B8]">
            {commerceName} · {discountLabel}
          </p>
          <button onClick={onClose} className="shrink-0 -mt-1 -mr-1 p-1 text-[#6E88B8] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <h3 className="text-lg font-black mb-1">Registrar uso</h3>
        <p className="text-xs text-[#9AAFD4] leading-relaxed mb-5">
          {exhausted
            ? 'Ya usaste todo el tope disponible este período.'
            : 'Contanos cuánto gastaste con esta promo. Lo sumamos a tu consumo del período.'}
        </p>

        {hasCap && (
          <div className="flex items-center justify-between bg-white/5 rounded-xl px-3.5 py-2.5 mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#6E88B8]">
                Tope {periodLabel(requirement.capPeriod)}
              </div>
              <div className="text-sm font-extrabold">${cap.toLocaleString('es-AR')}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#6E88B8]">Disponible</div>
              <div className={`text-sm font-extrabold ${exhausted ? 'text-red-300' : 'text-emerald-300'}`}>
                ${available.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        )}

        {exhausted ? (
          <>
            <div className="flex gap-2 items-start bg-[#E8471C]/10 border border-[#E8471C]/30 rounded-xl px-3 py-2.5 text-[11px] text-red-200 leading-relaxed mb-5">
              <span>⚠️</span>
              <span>
                Agotaste el tope de ${cap.toLocaleString('es-AR')} este período.
                {renewalLabel && ` Se renueva ${renewalLabel} — hasta entonces no vas a recibir el beneficio.`}
              </span>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-extrabold bg-white/10 text-[#C4CEE6] hover:bg-white/15 transition-colors">
              Entendido
            </button>
          </>
        ) : (
          <>
            <label className="block text-[11px] font-bold text-[#9AAFD4] mb-1.5">¿Cuándo lo gastaste?</label>
            <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/15 focus-within:border-white/40 rounded-xl px-3.5 py-3 mb-4">
              <input
                type="date"
                value={spentAt}
                max={todayArgISO()}
                onChange={e => setSpentAt(e.target.value)}
                className="bg-transparent outline-none w-full text-sm font-bold text-white [color-scheme:dark]"
              />
            </div>

            <label className="block text-[11px] font-bold text-[#9AAFD4] mb-1.5">Monto gastado</label>
            <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/15 focus-within:border-white/40 rounded-xl px-3.5 py-3 mb-1.5">
              <span className="text-lg font-extrabold text-[#6E88B8]">$</span>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="bg-transparent outline-none w-full text-xl font-extrabold text-white placeholder:text-[#48568A]"
              />
            </div>
            {error && <p className="text-[11px] text-red-300 mb-2">{error}</p>}
            {hasCap && (
              <p className="text-[10.5px] text-[#6E88B8] mb-5">
                {renewalLabel
                  ? `Se renueva ${renewalLabel} — hasta entonces sumamos todo lo que cargues.`
                  : 'Este tope no se renueva periódicamente.'}
              </p>
            )}
            <div className="flex gap-2.5">
              <button onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-white/[0.08] text-[#C4CEE6] hover:bg-white/[0.14] transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-[#E8471C] text-white hover:bg-[#d43e18] transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
