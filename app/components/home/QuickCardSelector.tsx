'use client'
import React from 'react'
import type { QuickSelectorOption } from '@/lib/homeQuickSelector'

type Props = {
  options: QuickSelectorOption[]
  selected: string | null
  onSelect: (key: string | null) => void
}

// Quick Selector — CPO Directive Prioridad 3 "Mi Ahorro de Hoy" (27/8/2026).
// Carrusel horizontal de los medios de pago del perfil del usuario. Single
// select: elegir una tarjeta filtra los rubros a lo que sirve para esa
// tarjeta (lib/homeQuickSelector.ts, en memoria, sin fetch nuevo). "Todas"
// vuelve al estado sin filtrar.
export default function QuickCardSelector({ options, selected, onSelect }: Props) {
  if (options.length < 2) return null

  return (
    <div className="flex gap-2 overflow-x-auto px-4 md:px-0 pb-1 -mx-4 md:mx-0 no-scrollbar" role="tablist" aria-label="Filtrar por tarjeta">
      <button
        role="tab"
        aria-selected={selected === null}
        onClick={() => onSelect(null)}
        className={`shrink-0 flex items-center gap-2 rounded-full pl-3 pr-4 py-2 text-[12px] font-extrabold border transition-colors first:ml-4 md:first:ml-0 ${
          selected === null
            ? 'bg-[#1D3D6E] dark:bg-[#3A6BC4] text-white border-transparent'
            : 'bg-white dark:bg-[#0F2040] text-[#5A6B85] dark:text-slate-400 border-[#E4E8EF] dark:border-slate-700'
        }`}
      >
        Todas
      </button>

      {options.map(opt => {
        const isSelected = selected === opt.key
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(isSelected ? null : opt.key)}
            className={`shrink-0 flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 text-[12px] font-extrabold border transition-colors last:mr-4 md:last:mr-0 ${
              isSelected
                ? 'bg-[#1D3D6E] dark:bg-[#3A6BC4] text-white border-transparent'
                : 'bg-white dark:bg-[#0F2040] text-[#0D1B2E] dark:text-white border-[#E4E8EF] dark:border-slate-700'
            }`}
          >
            {opt.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opt.logoUrl} alt="" className="w-6 h-6 rounded-full object-contain bg-white shrink-0" />
            ) : (
              <span className={`w-6 h-6 rounded-full shrink-0 ${isSelected ? 'bg-white/20' : 'bg-[#EEF2F8] dark:bg-[#16294B]'}`} />
            )}
            <span className="truncate max-w-[100px]">{opt.name}</span>
          </button>
        )
      })}
    </div>
  )
}
