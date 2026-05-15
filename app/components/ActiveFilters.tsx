'use client'
import { X } from 'lucide-react'

type FilterItem = {
  id: string
  label: string
  type: string
}

type Props = {
  filters: FilterItem[]
  onRemove: (id: string, type: string) => void
  onClearAll: () => void
}

export default function ActiveFilters({ filters, onRemove, onClearAll }: Props) {
  if (filters.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-5 py-2 overflow-x-auto scrollbar-hide bg-white/50 border-b border-gray-100">
      <div className="flex gap-1.5 items-center shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filtros:</span>
        {filters.map((f) => (
          <div 
            key={`${f.type}-${f.id}`}
            className="flex items-center gap-1 bg-indigo-50 border border-indigo-100/60 rounded-full px-2.5 py-1 text-indigo-700 shadow-sm animate-in zoom-in-95 duration-200"
          >
            <span className="text-[10px] font-bold whitespace-nowrap">{f.label}</span>
            <button 
              onClick={() => onRemove(f.id, f.type)}
              className="hover:bg-indigo-100 p-0.5 rounded-full transition-colors"
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
      
      {filters.length > 1 && (
        <button 
          onClick={onClearAll}
          className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2"
        >
          Limpiar todo
        </button>
      )}
    </div>
  )
}
