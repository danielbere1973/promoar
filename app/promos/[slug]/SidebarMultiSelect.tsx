'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export type MultiSelectOption = { value: string; label: string; icon?: string; logoUrl?: string | null; count?: number }

type Props = {
  title: string
  paramKey: string
  options: MultiSelectOption[]
  searchable?: boolean
  searchPlaceholder?: string
}

// Desplegable multiselección para el sidebar de detalle (banco/comercio) — la
// selección se guarda en la URL (?paramKey=slug1,slug2) y Next vuelve a pedir
// el Server Component con el filtro aplicado. Sin estado de servidor propio:
// la URL es la única fuente de verdad, por eso lee/escribe directo con
// useSearchParams/router.push en vez de levantar estado a un padre.
export default function SidebarMultiSelect({ title, paramKey, options, searchable, searchPlaceholder }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')

  const selected = useMemo(() => {
    const raw = searchParams.get(paramKey)
    return raw ? new Set(raw.split(',').filter(Boolean)) : new Set<string>()
  }, [searchParams, paramKey])

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query, searchable])

  function toggle(value: string) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)

    const params = new URLSearchParams(searchParams.toString())
    if (next.size > 0) params.set(paramKey, Array.from(next).join(','))
    else params.delete(paramKey)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <details className="group -mt-3" open={selected.size > 0}>
      <summary className="flex items-center justify-between cursor-pointer list-none text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-2.5 py-1.5">
        <span className="flex items-center gap-1.5">
          {title}
          {selected.size > 0 && (
            <span className="bg-[#D94F2B] text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
              {selected.size}
            </span>
          )}
        </span>
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
          {filteredOptions.map(opt => {
            const isActive = selected.has(opt.value)
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggle(opt.value)}
                  className="w-3.5 h-3.5 rounded accent-[#D94F2B] shrink-0"
                />
                {opt.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opt.logoUrl} alt={opt.label} className="w-5 h-5 rounded object-contain border border-gray-100 dark:border-slate-700 bg-white shrink-0" />
                ) : opt.icon ? (
                  <span>{opt.icon}</span>
                ) : null}
                <span className={`flex-1 truncate ${isActive ? 'text-gray-900 dark:text-white' : ''}`}>{opt.label}</span>
                {opt.count != null && (
                  <span className="text-[10px] text-gray-300 dark:text-slate-600">{opt.count}</span>
                )}
              </label>
            )
          })}
          {filteredOptions.length === 0 && (
            <p className="px-2.5 py-1.5 text-[11px] text-gray-400 dark:text-slate-500">Sin resultados</p>
          )}
        </div>
      </div>
    </details>
  )
}
