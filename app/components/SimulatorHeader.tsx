'use client'

import Link from 'next/link'

export type SimulatorType = 'supermercados' | 'combustible' | 'farmacias'

interface SimulatorHeaderProps {
  active: SimulatorType
}

export default function SimulatorHeader({ active }: SimulatorHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.01] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/promoar_logo_transparent.png"
            alt="PromoAR"
            className="h-9 sm:h-10 md:h-12 w-auto object-contain shrink-0"
          />
        </Link>

        {/* Pase entre simuladores */}
        <nav aria-label="Simuladores de ahorro" className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-bold">
          <Link
            href="/ahorro-interactivo/supermercados"
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
              active === 'supermercados'
                ? 'bg-[#D94F2B]/15 text-[#D94F2B] border border-[#D94F2B]/30 font-extrabold'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            🛒 Súper
          </Link>
          <Link
            href="/ahorro-interactivo/combustible"
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
              active === 'combustible'
                ? 'bg-[#D94F2B]/15 text-[#D94F2B] border border-[#D94F2B]/30 font-extrabold'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            ⛽ Nafta
          </Link>
          <Link
            href="/ahorro-interactivo/farmacias"
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
              active === 'farmacias'
                ? 'bg-[#D94F2B]/15 text-[#D94F2B] border border-[#D94F2B]/30 font-extrabold'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            💊 Farmacias
          </Link>
        </nav>

        {/* Botón de acceso a PromoAR */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-[#D94F2B] hover:bg-[#c44325] text-white text-xs md:text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 whitespace-nowrap"
        >
          <span>Entrá a PromoAR</span>
          <span className="text-white/80 font-normal">→</span>
        </Link>
      </div>
    </header>
  )
}
