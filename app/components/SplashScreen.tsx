'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashScreen({ loading, onDone }: { loading: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  // Animación de progreso: va rápido a 70%, luego frena hasta que loading=false
  useEffect(() => {
    let raf: number
    let start: number | null = null
    const FAST_DURATION = 1800 // ms para llegar a 70%
    const SLOW_TARGET = 88

    const animate = (ts: number) => {
      if (!start) start = ts
      const elapsed = ts - start
      const fast = Math.min((elapsed / FAST_DURATION) * 70, 70)
      const slow = elapsed > FAST_DURATION
        ? Math.min(70 + ((elapsed - FAST_DURATION) / 8000) * (SLOW_TARGET - 70), SLOW_TARGET)
        : fast
      setProgress(Math.round(slow))
      if (slow < SLOW_TARGET) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Cuando termina de cargar: completar a 100% y fade out
  useEffect(() => {
    if (!loading) {
      setProgress(100)
      const t1 = setTimeout(() => {
        setFadeOut(true)
        const t2 = setTimeout(() => {
          onDone()
        }, 450)
        return () => clearTimeout(t2)
      }, 350)
      return () => clearTimeout(t1)
    }
  }, [loading])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.45s ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      <div className="flex flex-col items-center gap-8 px-8 w-full max-w-sm">
        {/* Logo */}
        <Image src="/promoar_logo.webp" alt="PromoAR" width={192} height={192} className="w-48 h-auto object-contain" priority />

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
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'repeating-linear-gradient(90deg, #74ACDF 0, #74ACDF 10px, #FFFFFF 10px, #FFFFFF 20px)',
                boxShadow: 'inset 0 0 0 1px #74ACDF33',
                transition: 'width 0.3s ease-out',
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
