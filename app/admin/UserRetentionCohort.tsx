'use client'

import React, { useEffect, useState } from 'react'
import { RefreshCw, Users2 } from 'lucide-react'

type Retention = { offset: number; retained: number; pct: number | null }
type Cohort = { cohortWeek: string; size: number; retention: Retention[] }
type Summary = { w1: number | null; w2: number | null; w4: number | null }
type CohortData = {
  weeksBack: number
  totalLoggedInUsers: number
  maxOffset: number
  cohorts: Cohort[]
  summary: Summary
  sessions: { totalSessions: number; cohorts: Cohort[]; summary: Summary }
}

function pct(n: number | null): string {
  if (n === null) return '—'
  return `${(n * 100).toFixed(0)}%`
}

function cellColor(pct: number | null): string {
  if (pct === null) return 'bg-slate-50 text-slate-300'
  if (pct >= 0.4) return 'bg-emerald-100 text-emerald-800'
  if (pct >= 0.2) return 'bg-amber-100 text-amber-800'
  if (pct > 0) return 'bg-orange-100 text-orange-800'
  return 'bg-slate-100 text-slate-400'
}

function formatWeek(mondayStr: string): string {
  const d = new Date(mondayStr + 'T00:00:00.000Z')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function UserRetentionCohort() {
  const [data, setData] = useState<CohortData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weeks, setWeeks] = useState(12)
  const [scope, setScope] = useState<'logged' | 'all'>('logged')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/analytics/retention-cohort?weeks=${weeks}`)
      if (!res.ok) throw new Error('Error al cargar retención')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message || 'Error al cargar retención')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [weeks])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Users2 size={18} /> Retención de usuarios
          </h2>
          <p className="text-xs text-slate-400">
            Cohort semanal — de los activos cada semana, qué % volvió a tener actividad las semanas siguientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setScope('logged')}
              className={`text-xs font-bold px-3 py-2 ${scope === 'logged' ? 'bg-[#1E3A5F] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Logueados
            </button>
            <button
              onClick={() => setScope('all')}
              className={`text-xs font-bold px-3 py-2 ${scope === 'all' ? 'bg-[#1E3A5F] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Todos (sesión)
            </button>
          </div>
          <select
            value={weeks}
            onChange={e => setWeeks(Number(e.target.value))}
            className="text-sm font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-600"
          >
            <option value={8}>Últimas 8 semanas</option>
            <option value={12}>Últimas 12 semanas</option>
            <option value={26}>Últimas 26 semanas</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading && !data && <p className="text-sm text-slate-400 py-8 text-center">Cargando...</p>}
      {error && <p className="text-sm text-red-500 py-8 text-center">{error}</p>}

      {data && (() => {
        const cohorts = scope === 'logged' ? data.cohorts : data.sessions.cohorts
        const summary = scope === 'logged' ? data.summary : data.sessions.summary
        const totalCount = scope === 'logged' ? data.totalLoggedInUsers : data.sessions.totalSessions
        return (
        <>
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Volvió semana +1</p>
              <p className="text-xl font-black text-slate-800">{pct(summary.w1)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Volvió semana +2</p>
              <p className="text-xl font-black text-slate-800">{pct(summary.w2)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Volvió semana +4</p>
              <p className="text-xl font-black text-slate-800">{pct(summary.w4)}</p>
            </div>
          </div>

          {cohorts.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-8">
              Sin datos con eventos en el período. Hace falta tracking con sesión activa.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="py-1.5 pr-3 text-left text-slate-400 font-bold">Cohorte (semana de)</th>
                    <th className="py-1.5 pr-3 text-right text-slate-400 font-bold">{scope === 'logged' ? 'Usuarios' : 'Sesiones'}</th>
                    {Array.from({ length: data.maxOffset + 1 }, (_, i) => (
                      <th key={i} className="py-1.5 px-2 text-center text-slate-400 font-bold">
                        {i === 0 ? 'Sem. 0' : `+${i}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.slice().reverse().map(c => (
                    <tr key={c.cohortWeek} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-bold text-slate-600">{formatWeek(c.cohortWeek)}</td>
                      <td className="py-1.5 pr-3 text-right text-slate-500">{c.size}</td>
                      {c.retention.map(r => (
                        <td key={r.offset} className="py-1.5 px-1">
                          <div className={`rounded-md py-1 text-center font-bold ${cellColor(r.pct)}`}>
                            {r.pct === null ? '—' : `${(r.pct * 100).toFixed(0)}%`}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-slate-400 mt-3">
            {totalCount} {scope === 'logged' ? 'usuarios logueados distintos' : 'sesiones (invitados + logueados) distintas'} con actividad en el período. "Sem. 0" es siempre 100% (es la semana en la que entraron al cohort).
          </p>
        </>
        )
      })()}
    </div>
  )
}
