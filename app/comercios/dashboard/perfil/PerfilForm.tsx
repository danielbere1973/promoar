'use client'

import React, { useState } from 'react'

type Commerce = {
  id: string
  name: string
  logoUrl: string | null
  website: string | null
  instagramUrl: string | null
}

export default function PerfilForm({ commerce }: { commerce: Commerce }) {
  const [formData, setFormData] = useState({
    name: commerce.name,
    website: commerce.website || '',
    instagramUrl: commerce.instagramUrl || '',
    logoUrl: commerce.logoUrl || ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    setError('')

    try {
      const res = await fetch('/api/comercios/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar el perfil')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">
          Perfil guardado correctamente.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Fantasía</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        <p className="mt-1 text-xs text-gray-500">Este es el nombre con el que los usuarios ven tu comercio.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
        <div className="flex gap-4 items-start">
          <input
            type="url"
            value={formData.logoUrl}
            onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
            placeholder="https://..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {formData.logoUrl ? (
            <img src={formData.logoUrl} alt="Logo preview" className="w-10 h-10 object-contain rounded border border-gray-200 bg-white" />
          ) : (
            <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-xs">Sin logo</div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
        <input
          type="url"
          value={formData.website}
          onChange={e => setFormData({ ...formData, website: e.target.value })}
          placeholder="https://www.tucomercio.com.ar"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
        <input
          type="url"
          value={formData.instagramUrl}
          onChange={e => setFormData({ ...formData, instagramUrl: e.target.value })}
          placeholder="https://instagram.com/tucomercio"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
