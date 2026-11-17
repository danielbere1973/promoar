'use client'

import React, { useEffect, useState } from 'react'
import { MousePointerClick, RefreshCw, Store } from 'lucide-react'

type TopPromo = {
  promoId: string
  title: string
  slug: string | null
  commerceName: string
  commerceSlug: string
  logoUrl: string | null
  views: number
}
type TopCommerce = {
  commerceName: string
  slug: string | null
  logoUrl: string | null
  clicks: number
}
type Data = { days: number; topPromos: TopPromo[]; topCommerces: TopCommerce[] }

export default function TopClicksView() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(14)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/analytics/top-clicks?days=${days}`)
      if (!res.ok) throw new Error('Error al cargar ranking')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message || 'Error al cargar ranking')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <MousePointerClick size={18} /> Qué se clickea más
          </h2>
          <p className="text-xs text-slate-400">
            Promos individuales más vistas y comercios más clickeados (vistas de promo + clicks directos).
          </p>
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

      {loading && !data && <p className="text-sm text-slate-400 py-8 text-center">Cargando...</p>}
      {error && <p className="text-sm text-red-500 py-8 text-center">{error}</p>}

      {data && (
        <div className="grid md:grid-cols-2 gap-5 mt-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">Top promos</h3>
            {data.topPromos.length === 0 ? (
              <p className="text-sm text-slate-300 text-center py-6">Sin datos en el período</p>
            ) : (
              <ol className="space-y-1.5">
                {data.topPromos.map((p, i) => (
                  <li key={p.promoId} className="flex items-center gap-2 text-xs border-t border-slate-100 pt-1.5 first:border-0 first:pt-0">
                    <span className="w-5 shrink-0 text-right font-black text-slate-300">{i + 1}</span>
                    {p.logoUrl ? (
                      <img src={p.logoUrl} alt="" className="w-6 h-6 rounded object-contain shrink-0 bg-slate-50" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 truncate">{p.title}</p>
                      <p className="text-slate-400 truncate">{p.commerceName}</p>
                    </div>
                    <span className="font-black text-slate-700 shrink-0">{p.views}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
              <Store size={13} /> Top comercios
            </h3>
            {data.topCommerces.length === 0 ? (
              <p className="text-sm text-slate-300 text-center py-6">Sin datos en el período</p>
            ) : (
              <ol className="space-y-1.5">
                {data.topCommerces.map((c, i) => (
                  <li key={c.commerceName} className="flex items-center gap-2 text-xs border-t border-slate-100 pt-1.5 first:border-0 first:pt-0">
                    <span className="w-5 shrink-0 text-right font-black text-slate-300">{i + 1}</span>
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt="" className="w-6 h-6 rounded object-contain shrink-0 bg-slate-50" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-100 shrink-0" />
                    )}
                    <p className="flex-1 min-w-0 font-bold text-slate-700 truncate">{c.commerceName}</p>
                    <span className="font-black text-slate-700 shrink-0">{c.clicks}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
