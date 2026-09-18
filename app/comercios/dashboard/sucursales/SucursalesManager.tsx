'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Plus, MapPin } from 'lucide-react'

type Branch = {
  id: string
  name: string | null
  address: string | null
  city: string | null
  province: string | null
  lat: number
  lng: number
}

export default function SucursalesManager({ commerceId }: { commerceId: string }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    province: ''
  })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/comercios/sucursales')
    if (res.ok) {
      const data = await res.json()
      setBranches(data.branches)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/comercios/sucursales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al agregar')
      }
      
      await load()
      setAdding(false)
      setForm({ name: '', address: '', city: '', province: '' })
    } catch(err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Seguro que querés eliminar esta sucursal?')) return
    
    try {
      const res = await fetch(`/api/comercios/sucursales?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setBranches(prev => prev.filter(b => b.id !== id))
    } catch(err) {
      alert('Error al eliminar')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Listado de Sucursales ({branches.length})</h2>
        {!adding && (
          <button 
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva Sucursal
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Agregar Nueva Sucursal</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre (Opcional)</label>
                <input 
                  type="text" 
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Ej: Sucursal Centro"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dirección exacta</label>
                <input 
                  type="text" 
                  value={form.address}
                  onChange={e => setForm({...form, address: e.target.value})}
                  placeholder="Av. Corrientes 1234"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad</label>
                <input 
                  type="text" 
                  value={form.city}
                  onChange={e => setForm({...form, city: e.target.value})}
                  placeholder="CABA"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provincia</label>
                <input 
                  type="text" 
                  value={form.province}
                  onChange={e => setForm({...form, province: e.target.value})}
                  placeholder="Buenos Aires"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            
            <p className="text-xs text-gray-500">
              Al guardar, el sistema buscará automáticamente las coordenadas de esta dirección en el mapa.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setAdding(false)}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-1.5 text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar y Ubicar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm text-center py-8">Cargando sucursales...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Todavía no tenés sucursales cargadas.
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {branches.map(b => (
                <tr key={b.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{b.name || 'Sin nombre'}</div>
                    <div className="text-sm text-gray-500">{b.address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{b.city}, {b.province}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleDelete(b.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
