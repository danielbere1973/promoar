'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, AlertCircle, Info, Calculator, Wallet } from 'lucide-react'
import type { BilleteraTasaItem } from '@/app/api/finanzas/billeteras/route'

export default function BilleterasClient({ initialData }: { initialData?: { items: BilleteraTasaItem[]; updatedAt: string | null } }) {
  const [items, setItems] = useState<BilleteraTasaItem[]>(initialData?.items ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(false)
  const [simulatedSpend, setSimulatedSpend] = useState<number>(300000)
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'remunerada' | 'fci'>('todos')
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialData?.updatedAt ?? null)

  useEffect(() => {
    if (initialData) return
    setLoading(true)
    fetch('/api/finanzas/billeteras')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setItems(d.items ?? [])
        setUpdatedAt(d.updatedAt)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [initialData])

  const filteredItems = items.filter(i => {
    if (tipoFilter === 'remunerada') return i.tipo === 'Cuenta Remunerada'
    if (tipoFilter === 'fci') return i.tipo === 'Fondo Común (FCI)'
    return true
  })

  const PRESET_AMOUNTS = [100000, 300000, 500000, 1000000]

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 animate-pulse flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/3" />
              <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
            </div>
            <div className="h-8 bg-gray-100 dark:bg-slate-700 rounded-xl w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-3xl p-6 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-700 dark:text-red-300">No se pudieron cargar las tasas de billeteras</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">Por favor verificá tu conexión o reintentá en unos segundos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Calculadora interactiva de rendimientos */}
      <div className="bg-gradient-to-br from-[#1D3D6E] via-[#142840] to-[#0A1428] rounded-[28px] p-5 text-white shadow-lg border border-[#26406F]">
        <div className="flex items-center gap-2 mb-2">
          <Calculator size={18} className="text-[#8AADD4]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#8AADD4]">
            Simulador de Rendimiento Diario
          </span>
        </div>
        <p className="text-sm font-bold text-slate-200 mb-3">
          ¿Cuántos pesos dejás en la cuenta?
        </p>

        {/* Input de saldo simulado */}
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/15 mb-3">
          <span className="text-lg font-black text-slate-300 font-mono">$</span>
          <input
            type="number"
            min={10000}
            max={10000000}
            step={10000}
            value={simulatedSpend}
            onChange={e => setSimulatedSpend(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-full bg-transparent text-right text-xl font-black font-mono text-white outline-none"
          />
        </div>

        {/* Presets rápidos */}
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_AMOUNTS.map(amt => (
            <button
              key={amt}
              type="button"
              onClick={() => setSimulatedSpend(amt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                simulatedSpend === amt
                  ? 'bg-[#D94F2B] text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              ${amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
            </button>
          ))}
        </div>
      </div>

      {/* Tip de liquidez */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-snug">
          <strong>Liquidez 24/7:</strong> A diferencia del plazo fijo, acá tu plata nunca queda bloqueada. Podés transferir o pagar tus compras en cualquier momento mientras genera intereses diarios.
        </p>
      </div>

      {/* Filtro por tipo de producto */}
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
        {(['todos', 'remunerada', 'fci'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setTipoFilter(f)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              tipoFilter === f
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            {f === 'todos' ? 'Todas' : f === 'remunerada' ? 'Cuentas Remuneradas' : 'Fondos (FCI)'}
          </button>
        ))}
      </div>

      {/* Lista de billeteras ordenadas por TNA */}
      <div className="space-y-3">
        {filteredItems.map((item, idx) => {
          const monthlyReturn = Math.round(simulatedSpend * (item.tna / 100) / 12)
          const dailyReturn = Math.round(simulatedSpend * (item.tna / 100) / 365)
          const isTop = idx === 0

          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-slate-800/90 border rounded-3xl p-4 sm:p-5 transition-all shadow-sm ${
                isTop
                  ? 'border-[#D94F2B]/50 ring-1 ring-[#D94F2B]/20 dark:border-[#D94F2B]/40'
                  : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.logoUrl}
                      alt={item.nombre}
                      className="w-11 h-11 rounded-2xl object-contain bg-gray-50 dark:bg-slate-700 p-1 border border-gray-100 dark:border-slate-600"
                    />
                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[#1D3D6E] dark:bg-[#26406F] text-white text-[10px] font-black flex items-center justify-center">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                        {item.nombre}
                      </h3>
                      {item.destacado && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {item.destacado}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                      {item.tipo} · <span className="font-semibold text-gray-600 dark:text-slate-300">{item.tope}</span>
                    </p>
                  </div>
                </div>

                {/* Tasa destacada */}
                <div className="text-right shrink-0">
                  <div className="text-xl sm:text-2xl font-black text-[#D94F2B] font-mono leading-none">
                    {item.tna.toFixed(1)}%
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 dark:text-slate-400 mt-1 uppercase">
                    TNA anual
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    TEA {item.tea.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Ganancia simulada en pesos */}
              {simulatedSpend > 0 && (
                <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-slate-400 text-[11px]">
                    Rinde con tu saldo:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 dark:text-slate-300 font-mono text-[11px]">
                      +${dailyReturn.toLocaleString('es-AR')}/día
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      +${monthlyReturn.toLocaleString('es-AR')}/mes
                    </span>
                  </div>
                </div>
              )}

              {item.notas && (
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 leading-tight">
                  ℹ️ {item.notas}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Pie con hora de actualización y fuentes */}
      <div className="pt-3 pb-6 text-center space-y-1 text-[11px] text-gray-400 dark:text-slate-500">
        <div className="flex items-center justify-center gap-1.5 font-medium">
          <RefreshCw size={12} />
          <span>Tasas TNA de referencia vigentes · Actualizado diario</span>
        </div>
        <p className="text-[10px] text-gray-400/80 dark:text-slate-500/80">
          Fuentes: Relevamientos de mercado, comparatasas.ar, BCRA y términos oficiales de cada entidad.
        </p>
      </div>
    </div>
  )
}
