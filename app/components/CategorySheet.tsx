'use client'
import { X, Check } from 'lucide-react'

type Categoria = { id: string; name: string; slug: string; icon: string; color: string; promoCount?: number }

type Props = {
  isOpen: boolean
  onClose: () => void
  categorias: Categoria[]
  selected: string[]
  onChange: (slugs: string[]) => void
}

export default function CategorySheet({ isOpen, onClose, categorias, selected, onChange }: Props) {
  if (!isOpen) return null

  function toggle(slug: string) {
    onChange(selected.includes(slug) ? selected.filter(s => s !== slug) : [...selected, slug])
  }

  const sorted = [...categorias].sort((a, b) => (b.promoCount ?? 0) - (a.promoCount ?? 0))

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-800 rounded-t-[32px] lg:rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Categorías</h2>
            {selected.length > 0 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">{selected.length} seleccionada{selected.length > 1 ? 's' : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 dark:bg-slate-700 rounded-full text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Lista compacta de categorías */}
        <div className="overflow-y-auto flex-1 px-4 py-3">
          <div className="grid grid-cols-2 gap-1.5">
            {sorted.map(cat => {
              const isSelected = selected.includes(cat.slug)
              return (
                <button
                  key={cat.slug}
                  onClick={() => toggle(cat.slug)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-700'
                      : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-base leading-none shrink-0">{cat.icon}</span>
                  <span className={`text-[11px] font-bold flex-1 text-left leading-tight truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-slate-300'}`}>
                    {cat.name}
                  </span>
                  {cat.promoCount != null && cat.promoCount > 0 && (
                    <span className={`text-[10px] font-black shrink-0 ${isSelected ? 'text-indigo-400 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500'}`}>
                      {cat.promoCount}
                    </span>
                  )}
                  {isSelected && (
                    <div className="w-3.5 h-3.5 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                      <Check size={8} strokeWidth={3.5} className="text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-5 pt-3 border-t border-gray-100 dark:border-slate-700 flex gap-2">
          <button
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 font-bold text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            onClick={onClose}
            className="flex-[2] py-3 rounded-2xl bg-gray-900 dark:bg-indigo-600 text-white font-bold text-sm shadow-lg hover:bg-gray-800 dark:hover:bg-indigo-700 transition-all"
          >
            {selected.length === 0 ? 'Ver todas' : `Ver promos`}
          </button>
        </div>
      </div>
    </div>
  )
}
