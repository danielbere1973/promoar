'use client'

import React from 'react'
import Link from 'next/link'

export type PreciosSection = 'super' | 'farmacias' | 'tech'

interface SectionItem {
  id: PreciosSection
  label: string
  icon: string
  href: string
  description: string
  activeColor: string
}

const SECTIONS: SectionItem[] = [
  {
    id: 'super',
    label: 'Supermercados',
    icon: '🛒',
    href: '/precios/super',
    description: 'Coto, Carrefour, Jumbo, Disco, Vea, Día y más',
    activeColor: 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm',
  },
  {
    id: 'farmacias',
    label: 'Farmacias',
    icon: '💊',
    href: '/precios/farmacias',
    description: 'Farmacity, Farmaplus, OpenFarma',
    activeColor: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
  },
  {
    id: 'tech',
    label: 'Electrónica',
    icon: '📺',
    href: '/precios/tech',
    description: 'Frávega, Megatone, Naldo, Coppel, ML y más',
    activeColor: 'bg-purple-600 text-white border-purple-600 shadow-sm',
  },
]

// 1. Navegación en el Sidebar (vertical)
export function PreciosSidebarNav({ currentSection }: { currentSection: PreciosSection }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2 font-bold px-1">
        Sección
      </p>
      <div className="space-y-1">
        {SECTIONS.map(s => {
          const isActive = currentSection === s.id
          return (
            <Link
              key={s.id}
              href={s.href}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2.5 transition-all font-medium border ${
                isActive
                  ? `${s.activeColor} font-bold shadow`
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// 2. Navegación horizontal en píldoras (arriba del buscador, tanto desktop como mobile)
export function PreciosTabsNav({ currentSection }: { currentSection: PreciosSection }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
      <div className="bg-gray-200/80 dark:bg-slate-900/90 p-1 rounded-2xl border border-gray-300/60 dark:border-slate-800 flex items-center gap-1 shadow-inner">
        {SECTIONS.map(s => {
          const isActive = currentSection === s.id
          return (
            <Link
              key={s.id}
              href={s.href}
              className={`px-3.5 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all duration-200 ${
                isActive
                  ? `${s.activeColor} shadow-md`
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
