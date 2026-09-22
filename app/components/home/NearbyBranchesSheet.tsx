'use client'
import { useEffect, useState } from 'react'
import { X, MapPin } from 'lucide-react'

type BranchInfo = {
  address: string | null
  city: string | null
  province: string | null
  distanceKm: number
}

type Props = {
  commerceId: string
  commerceName: string
  onClose: () => void
}

// BottomSheet de sucursales cercanas — Prioridad 3, punto "Cercanía y Mapas"
// (directiva CPO 27/8/2026): sin mapa pesado, solo listado de direcciones.
// Reutiliza /api/branches/nearby (mismo endpoint que app/promos/explorar) y
// el mismo cache de ubicación en localStorage (key "userLocation", 1h) que
// ya usa lib/useHomeDecision.ts, para no pedir permiso de geolocalización
// dos veces si el usuario ya lo concedió en otra pantalla.
export default function NearbyBranchesSheet({ commerceId, commerceName, onClose }: Props) {
  const [branches, setBranches] = useState<BranchInfo[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function fetchNearby(lat: number, lng: number) {
      fetch(`/api/branches/nearby?lat=${lat}&lng=${lng}&radius=10`)
        .then(r => r.json())
        .then(data => {
          const entry = data?.[commerceId]
          setBranches(entry?.branches ?? [])
          setStatus('ready')
        })
        .catch(() => setStatus('error'))
    }

    try {
      const cached = localStorage.getItem('userLocation')
      if (cached) {
        const { lat, lng, ts } = JSON.parse(cached)
        if (Date.now() - ts < 3600000) {
          fetchNearby(lat, lng)
          return
        }
      }
    } catch {}

    if (!navigator.geolocation) {
      setStatus('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }))
        fetchNearby(lat, lng)
      },
      () => setStatus('denied'),
      { timeout: 8000 },
    )
  }, [commerceId])

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md md:mx-auto bg-white dark:bg-[#0F2040] rounded-t-3xl md:rounded-3xl max-h-[75vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2F5] dark:border-slate-700 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide">Sucursales cerca</p>
            <p className="text-[14px] font-bold text-[#0D1B2E] dark:text-white truncate">{commerceName}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-full hover:bg-[#F0F2F5] dark:hover:bg-slate-800 transition-colors">
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {status === 'loading' && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          )}

          {status === 'denied' && (
            <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center py-6">
              Activá la ubicación en tu navegador para ver las sucursales más cercanas.
            </p>
          )}

          {status === 'error' && (
            <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center py-6">
              No pudimos cargar las sucursales. Probá de nuevo en un momento.
            </p>
          )}

          {status === 'ready' && branches && branches.length === 0 && (
            <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center py-6">
              No encontramos sucursales de {commerceName} cerca tuyo.
            </p>
          )}

          {status === 'ready' && branches && branches.length > 0 && (
            <ul className="flex flex-col gap-2">
              {branches.map((b, i) => (
                <li key={i} className="flex items-start gap-3 bg-[#F7F8FA] dark:bg-slate-800/60 rounded-xl px-3.5 py-3">
                  <MapPin size={16} className="text-[#1D3D6E] dark:text-[#8AADD4] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#0D1B2E] dark:text-white truncate">
                      {b.address ?? 'Dirección no disponible'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {[b.city, b.province].filter(Boolean).join(', ')}
                      {b.city || b.province ? ' · ' : ''}
                      {b.distanceKm < 1 ? `${Math.round(b.distanceKm * 1000)} m` : `${b.distanceKm.toFixed(1)} km`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
