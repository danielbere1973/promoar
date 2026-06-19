'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Check, RefreshCw, Search } from 'lucide-react'

type User = { id: string; name: string | null; email: string }
type Category = { id: string; name: string; icon: string }
type Commerce = { id: string; name: string }
type Bank = { id: string; name: string; logoUrl: string | null; segments?: { id: string; name: string }[] }
type Wallet = { id: string; name: string; logoUrl: string | null }
type CardNetwork = { id: string; name: string }
type BankSegment = { id: string; name: string; bankId: string }

type Pref = {
  id: string
  type: string
  active: boolean
  minDiscount: number | null
  discountFilter: string
  maxPerWeek: number
  sentThisWeek: number
  lastSentAt: string | null
  validUntil: string | null
  createdAt: string
  user: User
  category: Category | null
  commerce: Commerce | null
  bank: { id: string; name: string } | null
  wallet: { id: string; name: string } | null
  cardNetwork: { id: string; name: string } | null
  cardSegment: { id: string; name: string } | null
}

const NOTIF_TYPES = ['CATEGORY', 'COMMERCE', 'DIGEST', 'PROXIMITY']
const TYPE_LABELS: Record<string, string> = {
  CATEGORY: 'Categoría', COMMERCE: 'Comercio', DIGEST: 'Digest diario', PROXIMITY: 'Proximidad',
}
const TYPE_COLORS: Record<string, string> = {
  CATEGORY: 'bg-blue-50 text-blue-600',
  COMMERCE: 'bg-emerald-50 text-emerald-600',
  DIGEST: 'bg-amber-50 text-amber-600',
  PROXIMITY: 'bg-purple-50 text-purple-600',
}
const DISCOUNT_FILTERS = [
  { value: 'ALL', label: '% y CSI' },
  { value: 'DISCOUNT_ONLY', label: 'Solo % descuento' },
  { value: 'CSI_ONLY', label: 'Solo CSI' },
]

type FormState = {
  userId: string; type: string
  categoryId: string; commerceId: string; commerceSearch: string
  bankId: string; walletId: string; cardNetworkId: string; cardSegmentId: string
  minDiscount: string; discountFilter: string; maxPerWeek: string
  active: boolean; validUntil: string
}

const emptyForm = (): FormState => ({
  userId: '', type: 'CATEGORY',
  categoryId: '', commerceId: '', commerceSearch: '',
  bankId: '', walletId: '', cardNetworkId: '', cardSegmentId: '',
  minDiscount: '', discountFilter: 'ALL', maxPerWeek: '3',
  active: true, validUntil: '',
})

export default function NotifPrefsTab() {
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [commerces, setCommerces] = useState<Commerce[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [cardNetworks, setCardNetworks] = useState<CardNetwork[]>([])
  const [bankSegments, setBankSegments] = useState<BankSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Table filters
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
    const [prefsRes, usersRes, catsRes, entRes, comRes] = await Promise.all([
      fetch('/api/admin/notification-preferences').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/public/entities').then(r => r.json()),
      fetch('/api/admin/commerces-list').then(r => r.json()),
    ])
    setPrefs(prefsRes.preferences ?? [])
    setUsers(usersRes.users ?? [])
    const cats: Category[] = catsRes.categories ?? catsRes ?? []
    setCategories(cats.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setBanks(entRes.banks ?? [])
    setWallets(entRes.wallets ?? [])
    setCardNetworks(entRes.cardNetworks ?? [])
    setBankSegments(entRes.segments ?? [])
    setCommerces(comRes.commerces ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Filtered commerces for the search box
  const filteredCommerces = useMemo(() => {
    if (!form.commerceSearch) return commerces.slice(0, 50)
    const q = form.commerceSearch.toLowerCase()
    return commerces.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50)
  }, [commerces, form.commerceSearch])

  // Segments for selected bank
  const availableSegments = useMemo(() =>
    form.bankId ? bankSegments.filter(s => s.bankId === form.bankId) : []
  , [bankSegments, form.bankId])

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
      commerceSearch: p.commerce?.name ?? '',
      bankId: p.bank?.id ?? '',
      walletId: p.wallet?.id ?? '',
      cardNetworkId: p.cardNetwork?.id ?? '',
      cardSegmentId: p.cardSegment?.id ?? '',
      minDiscount: p.minDiscount !== null ? String(p.minDiscount) : '',
      discountFilter: p.discountFilter ?? 'ALL',
      maxPerWeek: String(p.maxPerWeek),
      active: p.active,
      validUntil: p.validUntil ? p.validUntil.slice(0, 10) : '',
    })
    setPanelOpen(true)
  }

  function setF(patch: Partial<FormState>) { setForm(f => ({ ...f, ...patch })) }

  async function save() {
    if (!form.userId || !form.type) return
    setSaving(true)
    try {
      const payload = {
        userId: form.userId, type: form.type,
        categoryId: form.categoryId || null,
        commerceId: form.commerceId || null,
        bankId: form.bankId || null,
        walletId: form.walletId || null,
        cardNetworkId: form.cardNetworkId || null,
        cardSegmentId: form.cardSegmentId || null,
        minDiscount: form.minDiscount || null,
        discountFilter: form.discountFilter,
        maxPerWeek: form.maxPerWeek,
        active: form.active,
        validUntil: form.validUntil || null,
      }
      if (editingId) {
        const res = await fetch('/api/admin/notification-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
        if (res.ok) {
          const data = await res.json()
          setPrefs(p => p.map(x => x.id === editingId ? data.preference : x))
        }
      } else {
        const res = await fetch('/api/admin/notification-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setPrefs(p => [...p, data.preference])
        }
      }
      setPanelOpen(false)
    } finally { setSaving(false) }
  }

  async function deletePref(id: string) {
    if (!confirm('¿Eliminar esta preferencia?')) return
    const res = await fetch('/api/admin/notification-preferences', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setPrefs(p => p.filter(x => x.id !== id))
  }

  async function toggleActive(pref: Pref) {
    const res = await fetch('/api/admin/notification-preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pref.id, active: !pref.active }),
    })
    if (res.ok) { const d = await res.json(); setPrefs(p => p.map(x => x.id === pref.id ? d.preference : x)) }
  }

  async function resetWeek(pref: Pref) {
    const res = await fetch('/api/admin/notification-preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pref.id, resetWeek: true }),
    })
    if (res.ok) { const d = await res.json(); setPrefs(p => p.map(x => x.id === pref.id ? d.preference : x)) }
  }

  function isExpired(p: Pref) { return !!(p.validUntil && new Date(p.validUntil) < new Date()) }

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

  const descFilterLabel = (v: string) => DISCOUNT_FILTERS.find(d => d.value === v)?.label ?? v

  return (
    <div className="flex gap-4 items-start">
      {/* ── Main table ── */}
      <div className="flex-1 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm min-w-0">
        {/* Header / filters */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchUser} onChange={e => setSearchUser(e.target.value)}
                placeholder="Usuario..." className="pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-100 w-36" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none">
              <option value="">Todos los tipos</option>
              {NOTIF_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none">
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none">
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="paused">Pausadas</option>
              <option value="expired">Vencidas</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{filtered.length} resultados</span>
            <button onClick={openCreate}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors">
              <Plus size={13} /> Nueva
            </button>
            <button onClick={fetchAll} className="p-1.5 text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Sin resultados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Objetivo</th>
                  <th className="px-4 py-3">Entidad</th>
                  <th className="px-4 py-3">Beneficio</th>
                  <th className="px-4 py-3">Periodicidad</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => {
                  const expired = isExpired(p)
                  const entityParts = [p.bank?.name, p.wallet?.name, p.cardNetwork?.name, p.cardSegment?.name].filter(Boolean)
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/40 transition-colors ${expired ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-900 max-w-[110px] truncate">{p.user.name ?? p.user.email.split('@')[0]}</p>
                        <p className="text-[10px] text-slate-400 max-w-[110px] truncate">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TYPE_COLORS[p.type] ?? 'bg-slate-100 text-slate-500'}`}>
                          {TYPE_LABELS[p.type] ?? p.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-[130px] truncate">
                        {p.category ? `${p.category.icon} ${p.category.name}` : p.commerce?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-500 max-w-[130px] truncate">
                        {entityParts.length ? entityParts.join(' · ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-500">
                        <div>{descFilterLabel(p.discountFilter)}</div>
                        {p.minDiscount !== null && <div className="text-slate-400">≥ {p.minDiscount}%</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.maxPerWeek}/sem</td>
                      <td className="px-4 py-3 text-xs">
                        {p.validUntil ? (
                          <span className={expired ? 'text-red-500 font-bold' : 'text-slate-500'}>
                            {new Date(p.validUntil).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {expired && ' ✗'}
                          </span>
                        ) : <span className="text-slate-300 text-[10px]">Sin venc.</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">{p.sentThisWeek}/{p.maxPerWeek}</span>
                          <button onClick={() => resetWeek(p)} title="Resetear" className="text-slate-300 hover:text-amber-500">
                            <RefreshCw size={10} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(p)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                            p.active && !expired ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}>
                          {p.active && !expired ? 'ACTIVA' : expired ? 'VENCIDA' : 'PAUSADA'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deletePref(p.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50">
                            <Trash2 size={12} />
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

      {/* ── Side form panel ── */}
      {panelOpen && (
        <div className="w-80 bg-white border border-slate-200 rounded-3xl shadow-sm p-5 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Editar alerta' : 'Nueva alerta'}</h3>
            <button onClick={() => setPanelOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button>
          </div>

          {/* ── Usuario ── */}
          <Field label="Usuario">
            <select value={form.userId} onChange={e => setF({ userId: e.target.value })}
              disabled={!!editingId}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50">
              <option value="">Seleccioná un usuario...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
          </Field>

          {/* ── Tipo ── */}
          <Field label="Tipo">
            <select value={form.type} onChange={e => setF({ type: e.target.value, categoryId: '', commerceId: '', commerceSearch: '' })}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200">
              {NOTIF_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </Field>

          {/* ── Objetivo ── */}
          {form.type === 'CATEGORY' && (
            <Field label="Categoría">
              <select value={form.categoryId} onChange={e => setF({ categoryId: e.target.value })}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200">
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </Field>
          )}

          {form.type === 'COMMERCE' && (
            <Field label="Comercio">
              <div className="relative mt-1">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.commerceSearch}
                  onChange={e => setF({ commerceSearch: e.target.value, commerceId: '' })}
                  placeholder="Buscar comercio..."
                  className="w-full pl-8 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-t-xl outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <select
                size={6}
                value={form.commerceId}
                onChange={e => {
                  const opt = e.target.options[e.target.selectedIndex]
                  setF({ commerceId: e.target.value, commerceSearch: opt.text })
                }}
                className="w-full text-xs bg-slate-50 border border-x-slate-200 border-b-slate-200 rounded-b-xl px-3 py-1 outline-none focus:ring-2 focus:ring-slate-200">
                {filteredCommerces.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}

          <hr className="border-slate-100" />

          {/* ── Entidad financiera ── */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entidad financiera (opcional)</p>

          <Field label="Banco">
            <select value={form.bankId} onChange={e => setF({ bankId: e.target.value, cardSegmentId: '' })}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200">
              <option value="">Cualquier banco</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>

          {form.bankId && availableSegments.length > 0 && (
            <Field label="Segmento de tarjeta">
              <select value={form.cardSegmentId} onChange={e => setF({ cardSegmentId: e.target.value })}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200">
                <option value="">Cualquier segmento</option>
                {availableSegments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}

          <Field label="Billetera">
            <select value={form.walletId} onChange={e => setF({ walletId: e.target.value })}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200">
              <option value="">Cualquier billetera</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>

          <Field label="Red de tarjeta">
            <select value={form.cardNetworkId} onChange={e => setF({ cardNetworkId: e.target.value })}
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200">
              <option value="">Cualquier red</option>
              {cardNetworks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </Field>

          <hr className="border-slate-100" />

          {/* ── Beneficio ── */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de beneficio</p>

          <Field label="Aplica para">
            <div className="mt-1 flex gap-2 flex-wrap">
              {DISCOUNT_FILTERS.map(d => (
                <button key={d.value} type="button"
                  onClick={() => setF({ discountFilter: d.value })}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-colors ${
                    form.discountFilter === d.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Descuento mínimo (%)">
            <input type="number" min={0} max={100} value={form.minDiscount}
              onChange={e => setF({ minDiscount: e.target.value })}
              placeholder="Sin mínimo"
              className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200" />
          </Field>

          <hr className="border-slate-100" />

          {/* ── Periodicidad y vigencia ── */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periodicidad y vigencia</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Máx. notif./semana">
              <input type="number" min={1} max={20} value={form.maxPerWeek}
                onChange={e => setF({ maxPerWeek: e.target.value })}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200" />
            </Field>
            <Field label="Vigencia hasta">
              <input type="date" value={form.validUntil}
                onChange={e => setF({ validUntil: e.target.value })}
                className="mt-1 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-200" />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setF({ active: !form.active })}
              className={`relative w-10 h-5 rounded-full transition-all ${form.active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.active ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-xs font-medium text-slate-700">Activa</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.userId || !form.type}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:bg-slate-700 transition-colors">
              <Check size={13} />
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear alerta'}
            </button>
            <button onClick={() => setPanelOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  )
}
