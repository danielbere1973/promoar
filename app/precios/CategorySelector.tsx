'use client'

import React, { useState } from 'react'
import { ChevronRight, ListFilter } from 'lucide-react'
import { CATEGORIES, CategoryNode } from './categories'

interface Props {
  onSelectCategory: (categoryId: string) => void
}

export default function CategorySelector({ onSelectCategory }: Props) {
  const [activePath, setActivePath] = useState<CategoryNode[]>([])
  const [isOpen, setIsOpen] = useState(false)

  // Current level to display
  const currentLevelNodes = activePath.length === 0 
    ? CATEGORIES 
    : activePath[activePath.length - 1].children || []

  const handleSelect = (node: CategoryNode) => {
    if (node.children && node.children.length > 0) {
      setActivePath([...activePath, node])
    } else {
      // Hoja final
      onSelectCategory(node.id)
      setIsOpen(false)
      setActivePath([])
    }
  }

  const goBack = (index: number) => {
    setActivePath(activePath.slice(0, index + 1))
  }

  return (
    <div className="relative z-30">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#1A1A1A] border border-white/10 hover:border-indigo-500/50 px-4 py-3 rounded-xl text-white transition-all shadow-lg"
      >
        <ListFilter className="w-5 h-5 text-indigo-400" />
        <span className="font-medium">Navegar Categorías</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          
          {/* Breadcrumbs */}
          {activePath.length > 0 && (
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center flex-wrap gap-1 text-xs text-slate-400">
              <button onClick={() => setActivePath([])} className="hover:text-white transition-colors">Inicio</button>
              {activePath.map((node, i) => (
                <React.Fragment key={node.id}>
                  <ChevronRight className="w-3 h-3" />
                  <button 
                    onClick={() => goBack(i)}
                    className={`hover:text-white transition-colors ${i === activePath.length - 1 ? 'text-white font-medium' : ''}`}
                  >
                    {node.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* List */}
          <div className="py-2 max-h-64 overflow-y-auto custom-scrollbar">
            {currentLevelNodes.map(node => (
              <button
                key={node.id}
                onClick={() => handleSelect(node)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-between group"
              >
                <span>{node.name}</span>
                {node.children && node.children.length > 0 && (
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
