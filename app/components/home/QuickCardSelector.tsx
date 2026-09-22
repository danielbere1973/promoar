'use client'
import React, { useRef } from 'react'
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
//
// Chips circulares solo-logo (feedback Daniel 1/9/2026): el nombre no aporta
// nada que el logo no diga ya, y el texto obligaba a chips anchos tipo pill
// que se cortaban al borde de pantalla sin dejar claro que había más para
// scrollear. Circular + compacto entra más contenido visible por pantalla,
// hace el corte al borde obviamente "hay más" (mismo patrón que stories), y
// el nombre completo queda accesible vía aria-label/title en vez de texto.
export default function QuickCardSelector({ options, selected, onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startScrollLeft: 0 })

  if (options.length < 2) return null

  // Drag-to-scroll con mouse — `overflow-x-auto` por sí solo solo responde a
  // touch/trackpad/shift+wheel, no a click-and-drag con mouse normal. Sin esto,
  // en desktop con mouse no había ninguna forma de ver las opciones cortadas
  // al borde (confirmado por Daniel 1/9/2026: "no scrollea" era exactamente esto).
  function onMouseDown(e: React.MouseEvent) {
    const el = scrollerRef.current
    if (!el) return
    drag.current = { active: true, moved: false, startX: e.pageX, startScrollLeft: el.scrollLeft }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag.current.active) return
    const el = scrollerRef.current
    if (!el) return
    const delta = e.pageX - drag.current.startX
    if (Math.abs(delta) > 3) drag.current.moved = true
    el.scrollLeft = drag.current.startScrollLeft - delta
  }
  function endDrag() {
    drag.current.active = false
  }
  // Evita que un drag termine disparando el onClick del chip debajo del cursor.
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  return (
    <div
      ref={scrollerRef}
      className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-1 -mx-4 md:mx-0 no-scrollbar cursor-grab active:cursor-grabbing select-none"
      role="tablist"
      aria-label="Filtrar por tarjeta"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClickCapture={onClickCapture}
    >
      <button
        role="tab"
        aria-selected={selected === null}
        aria-label="Todas"
        onClick={() => onSelect(null)}
        className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-full text-[11px] font-extrabold border transition-colors first:ml-4 md:first:ml-0 ${
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
            aria-label={opt.name}
            title={opt.name}
            onClick={() => onSelect(isSelected ? null : opt.key)}
            className={`shrink-0 w-11 h-11 rounded-full border transition-colors overflow-hidden last:mr-4 md:last:mr-0 ${
              isSelected
                ? 'border-[#1D3D6E] dark:border-[#3A6BC4] ring-2 ring-[#1D3D6E] dark:ring-[#3A6BC4]'
                : 'border-[#E4E8EF] dark:border-slate-700'
            }`}
          >
            {opt.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opt.logoUrl} alt="" className="w-full h-full object-contain bg-white" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-[#EEF2F8] dark:bg-[#16294B] text-[13px] font-black text-[#5A6B85] dark:text-slate-400">
                {opt.name.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
