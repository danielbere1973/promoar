'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Flame, ExternalLink, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

type RunStatus = 'queued' | 'in_progress' | 'completed'
type RunConclusion = 'success' | 'failure' | 'cancelled' | null

type WarmRun = {
  id: number
  status: RunStatus
  conclusion: RunConclusion
  url: string
  startedAt: string
  updatedAt: string
}

const POLL_MS = 20000

export default function WarmCachePanel() {
  const [run, setRun] = useState<WarmRun | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/warm-cache')
      const data = await res.json()
      if (res.ok) {
        setRun(data.run ?? null)
        setStatusError('')
      } else {
        setStatusError(data.error || 'Error al consultar el estado')
      }
    } catch {
      setStatusError('No se pudo conectar con GitHub')
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Auto-refresco cada 15-30s mientras hay una corrida en curso.
  useEffect(() => {
    const running = run?.status === 'queued' || run?.status === 'in_progress'
    if (running && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, POLL_MS)
    }
    if (!running && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [run?.status, fetchStatus])

  // DESHABILITADO (22/11/2026) — warm proactivo abandonado, ver CLAUDE.md
  // sección "Warm proactivo de /api/internal/warm-detail — ABANDONADO".
  // El endpoint /api/admin/warm-cache devuelve 410 ahora; este botón ya no
  // dispara nada. Se deja el panel solo para ver el historial de corridas
  // viejas (GET sigue funcionando), no para lanzar una nueva.

  const isRunning = run?.status === 'queued' || run?.status === 'in_progress'

  function statusBadge() {
    if (loadingStatus) return <span className="text-xs text-gray-400">Consultando...</span>
    if (statusError) return <span className="text-xs text-red-600 font-medium">⚠️ {statusError}</span>
    if (!run) return <span className="text-xs text-gray-400">Sin corridas registradas todavía</span>

    if (run.status === 'queued') {
      return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1"><Clock size={13} /> En cola</span>
    }
    if (run.status === 'in_progress') {
      return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1"><Loader2 size={13} className="animate-spin" /> En curso</span>
    }
    if (run.conclusion === 'success') {
      return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1"><CheckCircle2 size={13} /> Terminada OK</span>
    }
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1"><XCircle size={13} /> Falló{run.conclusion ? ` (${run.conclusion})` : ''}</span>
  }

  return (
    <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <Flame size={14} className="text-orange-500" /> Precalentar cache de detalle
      </p>
      <p className="text-[11px] text-gray-400 mb-3">
        Deshabilitado: lo que este workflow escribe no lo lee la página real en producción
        (causa exacta no confirmable, backend de caché cerrado de Vercel) — ver CLAUDE.md.
        Se abandonó el warm proactivo; el caché de detalle ahora se llena solo con TTL de 7 días.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled
          title="Deshabilitado — ver CLAUDE.md, sección Warm proactivo abandonado"
          className="px-4 py-2 bg-gray-200 text-gray-400 text-sm font-bold rounded-xl cursor-not-allowed"
        >
          Precalentar cache (deshabilitado)
        </button>

        {statusBadge()}

        {run?.url && (
          <a
            href={run.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            Ver corrida en GitHub <ExternalLink size={12} />
          </a>
        )}
      </div>

      {run && (
        <p className="text-[11px] text-gray-400 mt-2">
          Última corrida: {new Date(run.startedAt).toLocaleString('es-AR')}
          {run.status === 'completed' && ` — actualizada ${new Date(run.updatedAt).toLocaleString('es-AR')}`}
        </p>
      )}
    </div>
  )
}
