'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check, RefreshCw, ChevronDown, Search } from 'lucide-react'

type User = { id: string; name: string | null; email: string }
type Category = { id: string; name: string; icon: string }
type Commerce = { id: string; name: string }
type Pref = {
  id: string
  type: string
  active: boolean
  minDiscount: number | null
  maxPerWeek: number
  sentThisWeek: number
  lastSentAt: string | null
  validUntil: string | null
  createdAt: string
  user: User
  category: Category | null
  commerce: Commerce | null
}

const NOTIF_TYPES = ['CATEGORY', 'COMMERCE', 'DIGEST', 'PROXIMITY']

const TYPE_LABELS: Record<string, string> = {
  CATEGORY: 'Categoría',
  COMMERCE: 'Comercio',
  DIGEST: 'Digest diario',
  PROXIMITY: 'Proximidad',
}

const TYPE_COLORS: Record<string, string> = {
  CATEGORY: 'bg-blue-50 text-blue-600',
  COMMERCE: 'bg-emerald-50 text-emerald-600',
  DIGEST: 'bg-amber-50 text-amber-600',
  PROXIMITY: 'bg-purple-50 text-purple-600',
}

type FormState = {
  userId: string
  type: string
  categoryId: string
  commerceId: string
  minDiscount: string
  maxPerWeek: string
  active: boolean
  validUntil: string
}

const emptyForm = (): FormState => ({
  userId: '',
  type: 'CATEGORY',
  categoryId: '',
  commerceId: '',
  minDiscount: '',
  maxPerWeek: '3',
  active: true,
  validUntil: '',
})

export default function NotifPrefsTab() {
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [commerces, setCommerces] = useState<Commerce[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [searchUser, setSearchUser] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Form panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [prefsRes, usersRes, catsRes, comRes] = await Promise.all([
      fetch('/api/admin/notification-preferences').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/public/entities').then(r => r.json()),
    ])
    setPrefs(prefsRes.preferences ?? [])
    setUsers(usersRes.users ?? [])
    setCategories(catsRes.categories ?? catsRes ?? [])
    // extract commerces from entities
    const ents = comRes
    const all: Commerce[] = [
      ...(ents.banks ?? []),
      ...(ents.wallets ?? []),
      ...(ents.networks ?? []),
      ...(ents.commerces ?? []),
    ]
    setCommerces(all)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setPanelOpen(true)
  }

  function openEdit(p: Pref) {
    setEditingId(p.id)
    setForm({
      userId: p.user.id,
      type: p.type,
      categoryId: p.category?.id ?? '',
      commerceId: p.commerce?.id ?? '',
      minDiscount: p.minDiscount !== null ? String(p.minDiscount) : '',
      maxPerWeek: String(p.maxPerWeek),
      active: p.active,
      validUntil: p.validUntil ? p.validUntil.slice(0, 10) : '',
    })
    setPanelOpen(true)
  }

  async function save() {
    if (!form.userId || !form.type) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch('/api/admin/notification-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            type: form.type,
            categoryId: form.categoryId,
            commerceId: form.commerceId,
            minDiscount: form.minDiscount,
            maxPerWeek: form.maxPerWeek,
            active: form.active,
            validUntil: form.validUntil,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setPrefs(p => p.map(x => x.id === editingId ? data.preference : x))
        }
      } else {
        const res = await fetch('/api/admin/notification-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: form.userId,
            type: form.type,
            categoryId: form.categoryId,
            commerceId: form.commerceId,
            minDiscount: form.minDiscount,
            maxPerWeek: form.maxPerWeek,
            active: form.active,
            validUntil: form.validUntil,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setPrefs(p => [...p, data.preference])
        }
      }
      setPanelOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function deletePref(id: string) {
    if (!confirm('¿Eliminar esta preferencia?')) return
    const res = await fetch('/api/admin/notification-preferences', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setPrefs(p => p.filter(x => x.id !== id))
  }

  async function toggleActive(pref: Pref) {
    const res = await fetch('/api/admin/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pref.id, active: !pref.active }),
    })
    if (res.ok) {
      const data = await res.json()
      setPrefs(p => p.map(x => x.id === pref.id ? data.preference : x))
    }
  }

  async function resetWeek(pref: Pref) {
    const res = await fetch('/api/admin/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pref.id, resetWeek: true }),
    })
    if (res.ok) {
      const data = await res.json()
      setPrefs(p => p.map(x => x.id === pref.id ? data.preference : x))
    }
  }

  function isExpired(p: Pref) {
    return p.validUntil && new Date(p.validUntil) < new Date()
  }

  const filtered = prefs.filter(p => {
    if (searchUser && !p.user.email.toLowerCase().includes(searchUser.toLowerCase()) &&
        !(p.user.name ?? '').toLowerCase().includes(searchUser.toLowerCase())) return false
    if (filterType && p.type !== filterType) return false
    if (filterCat && p.category?.id !== filterCat) return false
    if (filterStatus === 'active' && (!p.active || isExpired(p))) return false
    if (filterStatus === 'paused' && p.active) return false
    if (filterStatus === 'expired' && !isExpired(p)) return false
    return true
  })

  return (
    <div className="flex gap-4 h-full">
      {/* Main panel */}
      <div className="flex-1 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {/* Search user */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                placeholder="Usuario..."
                className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-100 w-40"
              />
            </div>
            {/* Filter type */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">Todos los tipos</option>
              {NOTIF_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            {/* Filter category */}
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            {/* Filter status */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="paused">Pausadas</option>
              <option value="expired">Vencidas</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length} resultados</span>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
              <Plus size={14} /> Nueva
            </button>
            <button onClick={fetchAll} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Sin resultados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Objetivo</th>
                  <th className="px-5 py-3">Desc. mín.</th>
                  <th className="px-5 py-3">Periodicidad</th>
                  <th className="px-5 py-3">Vigencia</th>
                  <th className="px-5 py-3">Semana</th>
                  <th className="px-5 py-3">Último envío</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => {
                  const expired = isExpired(p)
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${expired ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="text-xs font-bold text-slate-900 max-w-[120px] truncate">{p.user.name || p.user.email.split('@')[0]}</p>
                        <p className="text-[10px] text-slate-400 max-w-[120px] truncate">{p.user.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TYPE_COLORS[p.type] ?? 'bg-slate-100 text-slate-500'}`}>
                          {TYPE_LABELS[p.type] ?? p.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700 max-w-[130px] truncate">
                        {p.category ? `${p.category.icon} ${p.category.name}` : p.commerce?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {p.minDiscount !== null ? `${p.minDiscount}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {p.maxPerWeek}/sem
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {p.validUntil ? (
                          <span className={expired ? 'text-red-500 font-bold' : 'text-slate-500'}>
                            {new Date(p.validUntil).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {expired && ' ✗'}
                          </span>
                        ) : <span className="text-slate-300">Sin venc.</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">{p.sentThisWeek}/{p.maxPerWeek}</span>
                          <button
                            onClick={() => resetWeek(p)}
                            title="Resetear contador"
                            className="text-slate-300 hover:text-amber-500 transition-colors"
                          >
                            <RefreshCw size={11} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[10px] text-slate-400">
                        {p.lastSentAt
                          ? new Date(p.lastSentAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                            p.active && !expired ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {p.active && !expired ? 'ACTIVA' : expired ? 'VENCIDA' : 'PAUSADA'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-100">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deletePref(p.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                            <Trash2 size={13} />
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

      {/* Side form panel */}
      {panelOpen && (
        <div className="w-80 bg-white border border-slate-200 rounded-3xl shadow-sm p-5 space-y-4 shrink-0 self-start">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Editar alerta' : 'Nueva alerta'}</h3>
            <button onClick={() => setPanelOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>

          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Usuario</span>
            <select
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              disabled={!!editingId}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            >
              <option value="">Seleccioná un usuario...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</span>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value, categoryId: '', commerceId: '' }))}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
            >
              {NOTIF_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </label>

          {form.type === 'CATEGORY' && (
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoría</span>
              <select
                value={form.categoryId}
                onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Sin especificar</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </label>
          )}

          {form.type === 'COMMERCE' && (
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comercio</span>
              <select
                value={form.commerceId}
                onChange={e => setForm(f => ({ ...f, commerceId: e.target.value }))}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Sin especificar</option>
                {commerces.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Desc. mínimo (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.minDiscount}
                onChange={e => setForm(f => ({ ...f, minDiscount: e.target.value }))}
                placeholder="Sin mínimo"
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máx./semana</span>
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxPerWeek}
                onChange={e => setForm(f => ({ ...f, maxPerWeek: e.target.value }))}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vigencia hasta</span>
            <input
              type="date"
              value={form.validUntil}
              onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className={`relative w-10 h-5 rounded-full transition-all ${form.active ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.active ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-xs font-medium text-slate-700">Activa</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !form.userId || !form.type}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              <Check size={13} />
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear alerta'}
            </button>
            <button
              onClick={() => setPanelOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
