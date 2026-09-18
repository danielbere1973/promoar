'use client'

import React, { useState, useEffect } from 'react'

type UserCommerceRow = {
  id: string
  status: string
  role: string
  user: { id: string, name: string | null, email: string | null }
  commerce: { id: string, name: string, logoUrl: string | null }
}

export default function UserCommercesView() {
  const [data, setData] = useState<UserCommerceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/user-commerces')
    if (res.ok) {
      const json = await res.json()
      setData(json.userCommerces || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(id: string, newStatus: 'APPROVED' | 'REJECTED') {
    if (!confirm(`¿Estás seguro de ${newStatus === 'APPROVED' ? 'aprobar' : 'rechazar'} esta solicitud?`)) return
    
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/user-commerces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })
      if (res.ok) {
        // Optimistic update
        setData(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u))
      } else {
        alert('Error al actualizar el estado')
      }
    } catch(e) {
      alert('Error de red')
    }
    setUpdating(null)
  }

  return (
    <div className="bg-white rounded shadow p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Solicitudes B2B (Comercios)</h2>
        <button onClick={load} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded">
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 py-4 text-center">Cargando...</div>
      ) : data.length === 0 ? (
        <div className="text-gray-500 py-4 text-center">No hay solicitudes B2B.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 px-3 text-sm text-gray-500">Usuario</th>
                <th className="py-2 px-3 text-sm text-gray-500">Comercio Solicitado</th>
                <th className="py-2 px-3 text-sm text-gray-500">Estado</th>
                <th className="py-2 px-3 text-sm text-gray-500">Rol</th>
                <th className="py-2 px-3 text-sm text-gray-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <div className="text-sm font-medium text-gray-800">{row.user.name || 'Sin Nombre'}</div>
                    <div className="text-xs text-gray-500">{row.user.email}</div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {row.commerce.logoUrl ? (
                        <img src={row.commerce.logoUrl} className="w-6 h-6 object-contain" alt="" />
                      ) : (
                        <div className="w-6 h-6 bg-gray-200 rounded-full" />
                      )}
                      <span className="text-sm text-gray-800 font-medium">{row.commerce.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                      row.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      row.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-600">{row.role}</td>
                  <td className="py-2 px-3 text-right space-x-2">
                    {row.status === 'PENDING' && (
                      <>
                        <button
                          disabled={updating === row.id}
                          onClick={() => updateStatus(row.id, 'APPROVED')}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded font-medium disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={updating === row.id}
                          onClick={() => updateStatus(row.id, 'REJECTED')}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded font-medium disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {row.status === 'APPROVED' && (
                      <button
                        disabled={updating === row.id}
                        onClick={() => updateStatus(row.id, 'REJECTED')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-3 py-1 rounded font-medium disabled:opacity-50"
                      >
                        Revocar
                      </button>
                    )}
                    {row.status === 'REJECTED' && (
                      <button
                        disabled={updating === row.id}
                        onClick={() => updateStatus(row.id, 'APPROVED')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-3 py-1 rounded font-medium disabled:opacity-50"
                      >
                        Re-Aprobar
                      </button>
                    )}
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
