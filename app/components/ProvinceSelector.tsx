'use client'

import { useState } from 'react'
import { MapPin, X, Check } from 'lucide-react'

export const PROVINCIAS = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

type Props = {
  onSelect: (province: string) => void
  onDismiss: () => void
  currentProvince?: string
}

export default function ProvinceSelector({ onSelect, onDismiss, currentProvince }: Props) {
  const [selected, setSelected] = useState(currentProvince || '')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
              <MapPin size={16} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">¿Dónde estás?</h2>
              <p className="text-[11px] text-gray-400">Te mostramos las promos de tu zona</p>
            </div>
          </div>
          <button onClick={onDismiss} className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 py-2">
          {PROVINCIAS.map(prov => (
            <button
              key={prov}
              onClick={() => setSelected(prov)}
              className={`w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium transition-colors ${
                selected === prov
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {prov}
              {selected === prov && <Check size={15} className="text-indigo-600" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50"
          >
            Ahora no
          </button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-colors disabled:opacity-40"
          >
            Ver promos en {selected || '...'}
          </button>
        </div>
      </div>
    </div>
  )
}
