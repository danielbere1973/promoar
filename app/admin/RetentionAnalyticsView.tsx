'use client'

import React, { useEffect, useState } from 'react'
import { Eye, MousePointerClick, BookmarkCheck, Users, TrendingUp, RefreshCw } from 'lucide-react'

type AnalyticsData = {
  since: string
  days: number
  totals: {
    homeViews: number
    impressions: number
    clicks: number
    saves: number
    authenticatedHomeViews: number
    anonymousHomeViews: number
  }
  rates: {
    clickThroughRate: number
    saveRate: number
  }
  funnel: {
    sessionsWithHomeView: number
    sessionsWithImpression: number
    sessionsWithClick: number
    sessionsWithSave: number
  }
  rubros: { rubroId: string; impressions: number; clicks: number; ctr: number }[]
  series: { day: string; HOME_VIEW: number; RECOMMENDATION_IMPRESSION: number; RECOMMENDATION_CLICK: number; ACTION_SAVE_OR_USE: number }[]
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={16} />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-black text-slate-800">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  )
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const widthPct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-xs font-bold text-slate-600">{label}</span>
      <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
        <div className="h-full bg-[#1E3A5F] rounded-lg transition-all" style={{ width: `${widthPct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-sm font-black text-slate-700">{value}</span>
    </div>
  )
}

export default function RetentionAnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(14)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`)
      if (!res.ok) throw new Error('Error al cargar analytics')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message || 'Error al cargar analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  if (loading && !data) {
    return <div className="p-8 text-center text-slate-400 text-sm">Cargando analytics...</div>
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 text-sm">{error}</div>
  }

  if (!data) return null

  const { totals, rates, funnel, rubros } = data
  const maxSeries = Math.max(1, ...data.series.map(d => Math.max(d.HOME_VIEW, d.RECOMMENDATION_IMPRESSION, d.RECOMMENDATION_CLICK, d.ACTION_SAVE_OR_USE)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800">Retención — Mi Ahorro de Hoy</h2>
          <p className="text-xs text-slate-400">Paso 0 · eventos desde {new Date(data.since).toLocaleDateString('es-AR')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-600"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Home views" value={totals.homeViews} sub={`${totals.authenticatedHomeViews} logueados · ${totals.anonymousHomeViews} anónimos`} />
        <KpiCard icon={Eye} label="Impresiones" value={totals.impressions} />
        <KpiCard icon={MousePointerClick} label="Clicks" value={totals.clicks} sub={`CTR ${pct(rates.clickThroughRate)}`} />
        <KpiCard icon={BookmarkCheck} label="Guardados / usados" value={totals.saves} sub={`${pct(rates.saveRate)} de los clicks`} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp size={16} /> Funnel de sesiones únicas
        </h3>
        <div className="space-y-3">
          <FunnelBar label="Vieron el Home" value={funnel.sessionsWithHomeView} max={funnel.sessionsWithHomeView} />
          <FunnelBar label="Vieron una recomendación" value={funnel.sessionsWithImpression} max={funnel.sessionsWithHomeView} />
          <FunnelBar label="Clickearon una recomendación" value={funnel.sessionsWithClick} max={funnel.sessionsWithHomeView} />
          <FunnelBar label="Guardaron / usaron" value={funnel.sessionsWithSave} max={funnel.sessionsWithHomeView} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 overflow-x-auto">
        <h3 className="text-sm font-black text-slate-700 mb-4">Serie diaria</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="py-1 pr-4">Día</th>
              <th className="py-1 pr-4">Home views</th>
              <th className="py-1 pr-4">Impresiones</th>
              <th className="py-1 pr-4">Clicks</th>
              <th className="py-1 pr-4">Guardados</th>
            </tr>
          </thead>
          <tbody>
            {data.series.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-300">Sin eventos en el período</td></tr>
            )}
            {data.series.map(d => (
              <tr key={d.day} className="border-t border-slate-100">
                <td className="py-1.5 pr-4 font-bold text-slate-600">{d.day}</td>
                <td className="py-1.5 pr-4">{d.HOME_VIEW}</td>
                <td className="py-1.5 pr-4">{d.RECOMMENDATION_IMPRESSION}</td>
                <td className="py-1.5 pr-4">{d.RECOMMENDATION_CLICK}</td>
                <td className="py-1.5 pr-4">{d.ACTION_SAVE_OR_USE}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-black text-slate-700 mb-4">Rubros — impresiones vs clicks</h3>
        {rubros.length === 0 ? (
          <p className="text-sm text-slate-300 text-center py-4">Sin datos todavía</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="py-1 pr-4">Rubro</th>
                <th className="py-1 pr-4">Impresiones</th>
                <th className="py-1 pr-4">Clicks</th>
                <th className="py-1 pr-4">CTR</th>
              </tr>
            </thead>
            <tbody>
              {rubros.map(r => (
                <tr key={r.rubroId} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 font-bold text-slate-600">{r.rubroId}</td>
                  <td className="py-1.5 pr-4">{r.impressions}</td>
                  <td className="py-1.5 pr-4">{r.clicks}</td>
                  <td className="py-1.5 pr-4">{pct(r.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
