'use client'
import { X, Check } from 'lucide-react'

type Categoria = { id: string; name: string; slug: string; icon: string; color: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  categorias: Categoria[]
  selected: string[]   // slugs seleccionados
  onChange: (slugs: string[]) => void
}

export default function CategorySheet({ isOpen, onClose, categorias, selected, onChange }: Props) {
  if (!isOpen) return null

  function toggle(slug: string) {
    onChange(selected.includes(slug) ? selected.filter(s => s !== slug) : [...selected, slug])
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-t-[40px] lg:rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-50">
          <div>
            <h2 className="text-xl font-black text-gray-900">Categorías</h2>
            {selected.length > 0 && (
              <p className="text-xs text-indigo-600 font-semibold mt-0.5">{selected.length} seleccionada{selected.length > 1 ? 's' : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Grid de categorías */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          <div className="grid grid-cols-3 gap-3">
            {categorias.map(cat => {
              const isSelected = selected.includes(cat.slug)
              return (
                <button
                  key={cat.slug}
                  onClick={() => toggle(cat.slug)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                      <Check size={9} strokeWidth={3.5} className="text-white" />
                    </div>
                  )}
                  <span className="text-2xl leading-none">{cat.icon}</span>
                  <span className={`text-[11px] font-bold text-center leading-tight ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-50 bg-gray-50/30 flex gap-3">
          <button
            onClick={clearAll}
            disabled={selected.length === 0}
            className="flex-1 px-4 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            onClick={onClose}
            className="flex-[1.5] px-4 py-3.5 rounded-2xl bg-gray-900 text-white font-bold text-sm shadow-lg hover:bg-gray-800 transition-all"
          >
            {selected.length === 0 ? 'Ver todas' : `Ver promos`}
          </button>
        </div>
      </div>
    </div>
  )
}
