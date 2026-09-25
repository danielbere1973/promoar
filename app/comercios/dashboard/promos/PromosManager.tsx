'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Plus, Tag, Pause, Play } from 'lucide-react'

type Requirement = {
  id: string
  paymentChannel: string
  discountType: string
  discountValue: number
  nxmN: number | null
  nxmM: number | null
  note: string | null
}

type Promo = {
  id: string
  title: string
  description: string
  status: string
  validDays: number
  validUntil: string | null
  requirements: Requirement[]
}

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  PERCENTAGE_REINTEGRO: 'Porcentaje (reintegro)',
  PERCENTAGE_DESCUENTO: 'Porcentaje (descuento directo)',
  BONIFICACION: 'Bonificación',
  FIXED_AMOUNT: 'Monto fijo',
  NXM: '2x1 / Nx M',
  CUOTAS_SIN_INTERES: 'Cuotas sin interés'
}

const PAYMENT_CHANNEL_LABELS: Record<string, string> = {
  ANY: 'Cualquier medio',
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  NFC: 'NFC',
  TARJETA_FISICA: 'Tarjeta física',
  DINERO_EN_CUENTA: 'Dinero en cuenta',
  LINK_DE_PAGO: 'Link de pago'
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Activa', className: 'bg-green-100 text-green-800' },
  PAUSED: { label: 'Pausada', className: 'bg-gray-100 text-gray-700' },
  DRAFT: { label: 'Borrador', className: 'bg-yellow-100 text-yellow-800' },
  EXPIRED: { label: 'Vencida', className: 'bg-red-100 text-red-700' }
}

const emptyForm = {
  title: '',
  description: '',
  discountType: 'PERCENTAGE_DESCUENTO',
  discountValue: '',
  nxmN: '',
  nxmM: '',
  paymentChannel: 'ANY',
  note: '',
  validUntil: ''
}

export default function PromosManager({ commerceId }: { commerceId: string }) {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/comercios/promos')
    if (res.ok) {
      const data = await res.json()
      setPromos(data.promos)
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
      const res = await fetch('/api/comercios/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al crear la promo')
      }

      await load()
      setAdding(false)
      setForm(emptyForm)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(promo: Promo) {
    const nextStatus = promo.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch('/api/comercios/promos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, status: nextStatus })
      })
      if (!res.ok) throw new Error('Error al actualizar')
      setPromos(prev => prev.map(p => (p.id === promo.id ? { ...p, status: nextStatus } : p)))
    } catch {
      alert('Error al actualizar el estado')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Seguro que querés eliminar esta promoción?')) return

    try {
      const res = await fetch(`/api/comercios/promos?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setPromos(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('Error al eliminar')
    }
  }

  function describeDiscount(req: Requirement) {
    if (req.discountType === 'NXM') return `${req.nxmN || '?'}x${req.nxmM || '?'}`
    if (req.discountType === 'FIXED_AMOUNT') return `$${req.discountValue}`
    return `${req.discountValue}%`
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Mis Promociones ({promos.length})</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva Promoción
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Nueva Promoción</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: 2x1 en Cervezas"
                required
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Llevando 2 unidades de cualquier cerveza, pagás 1"
                required
                rows={2}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de descuento</label>
                <select
                  value={form.discountType}
                  onChange={e => setForm({ ...form, discountType: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                >
                  {Object.entries(DISCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Condición / medio de pago</label>
                <select
                  value={form.paymentChannel}
                  onChange={e => setForm({ ...form, paymentChannel: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                >
                  {Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {form.discountType === 'NXM' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Llevás (N)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.nxmN}
                      onChange={e => setForm({ ...form, nxmN: e.target.value })}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pagás (M)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.nxmM}
                      onChange={e => setForm({ ...form, nxmM: e.target.value })}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {form.discountType === 'FIXED_AMOUNT' ? 'Monto ($)' : 'Porcentaje (%)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.discountValue}
                    onChange={e => setForm({ ...form, discountValue: e.target.value })}
                    required
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vence el (opcional)</label>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={e => setForm({ ...form, validUntil: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nota / condiciones (opcional)</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Ej: No acumulable con otras promociones"
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setAdding(false); setForm(emptyForm) }}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-1.5 text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Publicar Promoción'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm text-center py-8">Cargando promociones...</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Todavía no tenés promociones directas cargadas.
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Promoción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condición</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {promos.map(p => {
                const req = p.requirements[0]
                const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.DRAFT
                return (
                  <tr key={p.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        {p.title}
                      </div>
                      <div className="text-sm text-gray-500">{p.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {req && (
                        <>
                          <div className="text-sm text-gray-900">{describeDiscount(req)}</div>
                          <div className="text-xs text-gray-400">{PAYMENT_CHANNEL_LABELS[req.paymentChannel] || req.paymentChannel}</div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        {(p.status === 'ACTIVE' || p.status === 'PAUSED') && (
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className="text-gray-500 hover:text-gray-800"
                            title={p.status === 'ACTIVE' ? 'Pausar' : 'Reactivar'}
                          >
                            {p.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
