'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

export type LinkListOption = { href: string; label: string; logoUrl?: string | null }

type Props = {
  title: string
  options: LinkListOption[]
  searchable?: boolean
  searchPlaceholder?: string
}

// Desplegable de navegación para el sidebar de detalle — a diferencia de
// SidebarMultiSelect, cada ítem es un link que lleva a otra página (ver las
// promos de ESE banco/billetera), no un filtro de la página actual.
export default function SidebarLinkList({ title, options, searchable, searchPlaceholder }: Props) {
  const [query, setQuery] = useState('')

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query, searchable])

  return (
    <details className="group -mt-3">
      <summary className="flex items-center justify-between cursor-pointer list-none text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-2.5 py-1.5">
        <span>{title}</span>
        <span className="text-gray-300 dark:text-slate-600 group-open:rotate-180 transition-transform">▾</span>
      </summary>

      <div className="flex flex-col gap-1 mt-1">
        {searchable && (
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? 'Buscar...'}
            onClick={e => e.stopPropagation()}
            className="mx-2.5 mb-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-medium text-gray-700 dark:text-slate-200 placeholder:text-gray-400 focus:outline-none focus:border-[#1E3A5F] dark:focus:border-slate-500"
          />
        )}

        <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto no-scrollbar">
          {filteredOptions.map(opt => (
            <Link
              key={opt.href}
              href={opt.href}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {opt.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opt.logoUrl} alt={opt.label} className="w-5 h-5 rounded object-contain border border-gray-100 dark:border-slate-700 bg-white shrink-0" />
              ) : null}
              <span className="flex-1 truncate">{opt.label}</span>
            </Link>
          ))}
          {filteredOptions.length === 0 && (
            <p className="px-2.5 py-1.5 text-[11px] text-gray-400 dark:text-slate-500">Sin resultados</p>
          )}
        </div>
      </div>
    </details>
  )
}
