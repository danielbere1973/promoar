'use client'
import { useEffect, useState } from 'react'

export default function SplashScreen({ loading }: { loading: boolean }) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  // Simula progreso: va rápido al 70%, luego frena hasta que loading=false
  useEffect(() => {
    let raf: number
    let start: number | null = null
    const FAST_DURATION = 1800 // ms para llegar a 70%
    const SLOW_TARGET = 88

    const animate = (ts: number) => {
      if (!start) start = ts
      const elapsed = ts - start
      const fast = Math.min((elapsed / FAST_DURATION) * 70, 70)
      // Después de 70%, avanza muy lento
      const slow = elapsed > FAST_DURATION
        ? Math.min(70 + ((elapsed - FAST_DURATION) / 8000) * (SLOW_TARGET - 70), SLOW_TARGET)
        : fast
      setProgress(Math.round(slow))
      if (slow < SLOW_TARGET || loading) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Cuando termina de cargar: completar a 100% y fade out
  useEffect(() => {
    if (!loading) {
      setProgress(100)
      const t = setTimeout(() => {
        setFadeOut(true)
        setTimeout(() => setVisible(false), 400)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [loading])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-400 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center gap-8 px-8 w-full max-w-sm">
        {/* Logo */}
        <img src="/logo.jpg" alt="PromoAR" className="w-48 h-auto object-contain" />

        {/* Tagline */}
        <div className="text-center space-y-1">
          <p className="text-lg font-black text-[#1E3A5F] leading-tight">
            Estás a punto de ver la magia...
          </p>
          <p className="text-sm font-semibold text-gray-400">
            Todas tus promos en un solo lugar
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="w-full space-y-2">
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #D94F2B, #e8724f)',
              }}
            />
          </div>
          <p className="text-center text-[11px] font-bold text-gray-400 tabular-nums">
            {progress}%
          </p>
        </div>
      </div>
    </div>
  )
}
