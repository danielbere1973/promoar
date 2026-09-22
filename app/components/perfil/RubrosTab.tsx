'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

// Tab "Tus rubros" — CPO Approval "Tus rubros" Etapa 1 (16/8/2026), punto 8.
// UI de Bloque A únicamente (definicion-tus-rubros-ux-16-8-2026.md §3, §6, §7):
// selección libre 0..universo activo, sin recomendación de cantidad, sin fill
// automático, guardado explícito con diff. Bloque B ("También te podría
// interesar") es producto no autorizado todavía — no se implementa acá.

type RubroUniverseItem = { id: string; label: string; icon: string | null; active: boolean }

export default function RubrosTab() {
  const [universe, setUniverse] = useState<RubroUniverseItem[]>([])
  const [savedDeclared, setSavedDeclared] = useState<string[]>([])
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/perfil/rubros')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        if (cancelled) return
        setUniverse(data.universe ?? [])
        setSavedDeclared(data.declared ?? [])
        setPending(new Set(data.declared ?? []))
      })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar tus rubros.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const hasChanges =
    pending.size !== savedDeclared.length ||
    savedDeclared.some(id => !pending.has(id))

  function toggle(id: string, active: boolean) {
    if (!active && !pending.has(id)) return // no se puede agregar un rubro inactivo de cero
    setPending(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setJustSaved(false)
  }

  function discard() {
    setPending(new Set(savedDeclared))
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/perfil/rubros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declared: Array.from(pending) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Error al guardar')
      }
      const data = await res.json()
      setUniverse(data.universe ?? universe)
      setSavedDeclared(data.declared ?? [])
      setPending(new Set(data.declared ?? []))
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || 'No se pudieron guardar tus rubros.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-slate-700 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-24">
      <div className="bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl px-4 py-3">
        <p className="text-xs text-blue-700 dark:text-slate-300 font-medium leading-relaxed">
          Elegí los rubros que te interesan. En "Tus rubros" te mostramos hasta 5 por vez,
          priorizando los que tengan la mejor oportunidad hoy — el resto sigue guardado y
          puede aparecer otro día.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-2xl px-4 py-3">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {universe.map(rubro => {
          const isSelected = pending.has(rubro.id)
          const canToggle = rubro.active || isSelected
          return (
            <button
              key={rubro.id}
              type="button"
              disabled={!canToggle}
              onClick={() => toggle(rubro.id, rubro.active)}
              className={`relative text-left px-4 py-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                isSelected
                  ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700'
                  : canToggle
                    ? 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
                    : 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 bg-green-500 text-white rounded-full p-0.5">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              <span className="text-2xl leading-none">{rubro.icon ?? '🏷️'}</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{rubro.label}</span>
              {!rubro.active && (
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  Ya no disponible
                </span>
              )}
            </button>
          )
        })}
      </div>

      {universe.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">
          No hay rubros disponibles por ahora.
        </p>
      )}

      {hasChanges && (
        <div className="fixed bottom-20 left-0 right-0 px-5 z-20">
          <div className="max-w-lg mx-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-3 flex items-center gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar preferencias'}
            </button>
          </div>
        </div>
      )}

      {justSaved && !hasChanges && (
        <div className="fixed bottom-20 left-0 right-0 px-5 z-20 pointer-events-none">
          <div className="max-w-lg mx-auto bg-green-600 text-white text-xs font-semibold rounded-2xl shadow-lg px-4 py-3 text-center animate-in fade-in slide-in-from-bottom-2 duration-200">
            Preferencias guardadas
          </div>
        </div>
      )}
    </div>
  )
}
