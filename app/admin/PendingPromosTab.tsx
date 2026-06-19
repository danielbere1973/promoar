'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, X, RefreshCw, CheckSquare, Square, ExternalLink, Pencil, ChevronDown, ChevronsDown, ChevronsUp, ShieldCheck, AlertTriangle } from 'lucide-react'

type Requirement = {
  id: string
  discountType: string
  discountValue: number
  cap: number | null
  capUnlimited: boolean
  capPeriod: string | null
  minPurchase: number | null
  paymentChannel: string
  bank: { id: string; name: string } | null
  wallet: { id: string; name: string } | null
  cardNetwork: { id: string; name: string } | null
  cardSegmentRef: { id: string; name: string } | null
}

type Promo = {
  id: string
  title: string
  description: string
  sourceUrl: string | null
  validFrom: string
  validUntil: string | null
  validDays: number
  createdAt: string
  commerce: { id: string; name: string; logoUrl: string | null }
  category: { id: string; name: string; icon: string } | null
  requirements: Requirement[]
}

type Category = { id: string; name: string; icon: string }
type Commerce = { id: string; name: string }
type Bank = { id: string; name: string }
type Wallet = { id: string; name: string }
type CardNetwork = { id: string; name: string }

// ── Constants ───────────────────────────────────────────────────
const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
const DAY_FULL   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const DISCOUNT_LABELS: Record<string, string> = {
  PERCENTAGE_REINTEGRO: '% Reintegro',
  PERCENTAGE_DESCUENTO: '% Descuento',
  BONIFICACION: 'Bonificación',
  FIXED_AMOUNT: 'Monto fijo',
  NXM: 'NxM',
  CUOTAS_SIN_INTERES: 'CSI',
}

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  ANY:      { label: 'Online y presencial', color: 'bg-slate-100 text-slate-500' },
  QR:       { label: 'QR',        color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  NFC:      { label: 'NFC',       color: 'bg-violet-50 text-violet-700 border border-violet-200' },
  ONLINE:   { label: 'Online',    color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  IN_STORE: { label: 'Presencial',color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  APP:      { label: 'App',       color: 'bg-pink-50 text-pink-700 border border-pink-200' },
}

const CAP_LABELS: Record<string, string> = {
  PER_TRANSACTION: 'x transac.',
  DAILY: 'diario',
  WEEKLY: 'semanal',
  MONTHLY: 'mensual',
  TOTAL: 'total',
}

const PAYMENT_CHANNELS = ['ANY', 'ONLINE', 'IN_STORE', 'QR', 'NFC', 'APP']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtMoney(n: number) {
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}
function maskToBooleans(mask: number) { return DAY_LABELS.map((_, i) => !!(mask & (1 << i))) }
function buildDayMask(days: boolean[]) { return days.reduce((a, v, i) => a | (v ? 1 << i : 0), 0) }
function buildForm(p: Promo) {
  return {
    title: p.title, description: p.description,
    commerceId: p.commerce.id, commerceSearch: p.commerce.name,
    categoryId: p.category?.id ?? '',
    days: maskToBooleans(p.validDays),
    requirements: p.requirements.map(r => ({
      reqId: r.id,
      bankId: r.bank?.id ?? '', walletId: r.wallet?.id ?? '',
      cardNetworkId: r.cardNetwork?.id ?? '', cardSegmentId: r.cardSegmentRef?.id ?? '',
      paymentChannel: r.paymentChannel,
      cap: r.cap != null ? String(r.cap) : '',
      capPeriod: r.capPeriod ?? 'MONTHLY',
      capUnlimited: r.capUnlimited,
      minPurchase: r.minPurchase != null ? String(r.minPurchase) : '',
    })),
  }
}

// ── Requirement row ─────────────────────────────────────────────
function ReqRow({ r, idx, total }: { r: Requirement; idx: number; total: number }) {
  const ch = CHANNEL_META[r.paymentChannel] ?? CHANNEL_META.ANY
  const isCSI = r.discountType === 'CUOTAS_SIN_INTERES'
  const benefitLabel = DISCOUNT_LABELS[r.discountType] ?? r.discountType
  const benefitVal = r.discountValue > 0 ? (isCSI ? `${r.discountValue}c` : `${r.discountValue}%`) : null

  const entities = [r.bank?.name, r.wallet?.name, r.cardNetwork?.name, r.cardSegmentRef?.name].filter(Boolean)

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-xs ${idx < total - 1 ? 'border-b border-slate-200' : ''}`}>
      {total > 1 && (
        <span className="w-4 h-4 rounded-full bg-slate-300 text-slate-600 text-[9px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
      )}
      {/* Entidades */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
        {entities.length > 0 ? entities.map((e, j) => (
          <span key={j} className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-semibold whitespace-nowrap">{e}</span>
        )) : (
          <span className="text-slate-400 italic">Sin entidad asignada</span>
        )}
      </div>
      {/* Canal */}
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 ${ch.color}`}>{ch.label}</span>
      {/* Beneficio */}
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 ${isCSI ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
        {benefitLabel}{benefitVal ? ` · ${benefitVal}` : ''}
      </span>
      {/* Tope */}
      {r.cap != null && r.cap > 0 ? (
        <span className="text-[11px] text-slate-600 whitespace-nowrap shrink-0 font-medium">
          tope <span className="font-bold text-slate-700">{fmtMoney(r.cap)}</span>{r.capPeriod ? ' ' + CAP_LABELS[r.capPeriod] : ''}
        </span>
      ) : r.capUnlimited ? (
        <span className="text-[11px] text-emerald-700 whitespace-nowrap shrink-0 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
          Sin tope
        </span>
      ) : null}
      {/* Mínimo */}
      {r.minPurchase != null && r.minPurchase > 0 && (
        <span className="text-[11px] text-slate-600 whitespace-nowrap shrink-0 font-medium">
          mín <span className="font-bold text-slate-700">{fmtMoney(r.minPurchase)}</span>
        </span>
      )}
    </div>
  )
}

// ── Edit Modal ──────────────────────────────────────────────────
function EditModal({ promo, categories, commerces, banks, wallets, cardNetworks, onSave, onClose }: {
  promo: Promo; categories: Category[]; commerces: Commerce[]
  banks: Bank[]; wallets: Wallet[]; cardNetworks: CardNetwork[]
  onSave: (updated: Promo) => void; onClose: () => void
}) {
  const [form, setForm] = useState(() => buildForm(promo))
  const [saving, setSaving] = useState(false)
  function setF(patch: Partial<typeof form>) { setForm(f => ({ ...f, ...patch })) }

  const filteredCommerces = useMemo(() => {
    if (!form.commerceSearch) return commerces.slice(0, 80)
    const q = form.commerceSearch.toLowerCase()
    return commerces.filter(c => c.name.toLowerCase().includes(q)).slice(0, 80)
  }, [commerces, form.commerceSearch])

  function setReq(i: number, patch: Partial<typeof form.requirements[0]>) {
    setForm(f => { const r = [...f.requirements]; r[i] = { ...r[i], ...patch }; return { ...f, requirements: r } })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/pending-promos/${promo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, description: form.description,
          commerceId: form.commerceId, categoryId: form.categoryId,
          validDays: buildDayMask(form.days),
          requirements: form.requirements.map(r => ({
            ...r,
            cap: r.cap !== '' ? Number(r.cap) : null,
            minPurchase: r.minPurchase !== '' ? Number(r.minPurchase) : null,
          })),
        }),
      })
      if (res.ok) { const d = await res.json(); onSave(d.promo) }
    } finally { setSaving(false) }
  }

  const inp = "bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-500 text-xs w-full"
  const sel = inp + " cursor-pointer"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-xs overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {promo.commerce.logoUrl && (
              <img src={promo.commerce.logoUrl} alt="" className="w-7 h-7 object-contain rounded border border-slate-100" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Editar promo</p>
              <p className="font-bold text-slate-800 text-sm truncate">{promo.commerce.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Promo fields — 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Field label="Título">
                <textarea value={form.title} onChange={e => setF({ title: e.target.value })} rows={2}
                  className={inp + " resize-none"} />
              </Field>
              <Field label="Descripción">
                <textarea value={form.description} onChange={e => setF({ description: e.target.value })} rows={2}
                  className={inp + " resize-none"} />
              </Field>
            </div>
            <div className="space-y-3">
              <Field label="Comercio">
                <input value={form.commerceSearch} onChange={e => setF({ commerceSearch: e.target.value, commerceId: '' })}
                  placeholder="Buscar..." className={inp + " rounded-b-none border-b-0"} />
                <select size={3} value={form.commerceId}
                  onChange={e => setF({ commerceId: e.target.value, commerceSearch: e.target.options[e.target.selectedIndex].text })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-t-none rounded-b-lg px-2 py-1 outline-none text-xs">
                  {filteredCommerces.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Categoría">
                <select value={form.categoryId} onChange={e => setF({ categoryId: e.target.value })} className={sel}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </Field>
              <Field label="Días">
                <div className="flex gap-1 flex-wrap">
                  {DAY_FULL.map((d, i) => (
                    <button key={d} type="button"
                      onClick={() => setForm(f => { const days = [...f.days]; days[i] = !days[i]; return { ...f, days } })}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${form.days[i] ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* Requirements table */}
          {form.requirements.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Requisitos de pago · {form.requirements.length} fila{form.requirements.length !== 1 ? 's' : ''}
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-400"
                  style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr' }}>
                  <span>Banco</span>
                  <span>Billetera</span>
                  <span>Red</span>
                  <span>Canal</span>
                  <span>Tope ($)</span>
                  <span>Período</span>
                  <span>Mínimo ($)</span>
                </div>
                {/* Rows */}
                {form.requirements.map((r, i) => (
                  <div key={r.reqId}
                    className={`grid gap-2 px-3 py-2.5 items-center ${i < form.requirements.length - 1 ? 'border-b border-slate-100' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                    style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr' }}>
                    <select value={r.bankId} onChange={e => setReq(i, { bankId: e.target.value })} className={sel}>
                      <option value="">—</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select value={r.walletId} onChange={e => setReq(i, { walletId: e.target.value })} className={sel}>
                      <option value="">—</option>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <select value={r.cardNetworkId} onChange={e => setReq(i, { cardNetworkId: e.target.value })} className={sel}>
                      <option value="">—</option>
                      {cardNetworks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <select value={r.paymentChannel} onChange={e => setReq(i, { paymentChannel: e.target.value })} className={sel}>
                      {PAYMENT_CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_META[ch]?.label ?? ch}</option>)}
                    </select>
                    <input type="number" placeholder="Sin tope"
                      value={r.cap} onChange={e => setReq(i, { cap: e.target.value, capUnlimited: false })}
                      className={inp} />
                    <select value={r.capPeriod} onChange={e => setReq(i, { capPeriod: e.target.value })} className={sel}>
                      {Object.entries(CAP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="number" placeholder="Sin mínimo"
                      value={r.minPurchase} onChange={e => setReq(i, { minPurchase: e.target.value })}
                      className={inp} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/40">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-40 hover:bg-slate-700 transition-colors">
            <Check size={13} /> {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  )
}

// ── Promo row ────────────────────────────────────────────────────
function PromoRow({
  promo, isSelected, isExpanded, isEditing, issues,
  onToggleSelect, onToggleExpand, onEdit,
  onApprove, onReject, saving,
}: {
  promo: Promo; isSelected: boolean; isExpanded: boolean; isEditing: boolean
  issues?: string[]
  onToggleSelect: () => void; onToggleExpand: () => void; onEdit: () => void
  onApprove: () => void; onReject: () => void; saving: boolean
}) {
  const activeDays = DAY_LABELS.filter((_, i) => promo.validDays & (1 << i))
  const totalReqs = promo.requirements.length
  const hasIssues = issues && issues.length > 0

  return (
    <div className={`border-b border-slate-100 last:border-0 transition-colors ${hasIssues ? 'bg-amber-50/40' : isSelected ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50'} ${isEditing ? 'ring-1 ring-inset ring-indigo-200 bg-indigo-50/20' : ''}`}>
      {/* Issues banner */}
      {hasIssues && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-0 flex-wrap">
          {issues.map(issue => (
            <span key={issue} className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-md px-2 py-0.5">
              <AlertTriangle size={9} /> {issue}
            </span>
          ))}
        </div>
      )}
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button onClick={onToggleSelect} className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors">
          {isSelected ? <CheckSquare size={15} className="text-slate-700" /> : <Square size={15} />}
        </button>

        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
          {promo.commerce.logoUrl
            ? <img src={promo.commerce.logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
            : <span className="text-[10px] font-black text-slate-400">{promo.commerce.name[0]}</span>}
        </div>

        {/* Comercio + categoría */}
        <div className="w-40 shrink-0">
          <p className="text-xs font-bold text-slate-900 truncate">{promo.commerce.name}</p>
          {promo.category && (
            <p className="text-xs text-slate-500 truncate">{promo.category.icon} {promo.category.name}</p>
          )}
        </div>

        {/* Título + resumen de reqs */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-700 font-medium truncate">{promo.title}</p>
          {/* Resumen siempre visible: entidad + beneficio + tope + mínimo */}
          {!isExpanded && promo.requirements.length > 0 && (() => {
            const r = promo.requirements[0]
            const isCSI = r.discountType === 'CUOTAS_SIN_INTERES'
            const val = r.discountValue > 0 ? (isCSI ? `${r.discountValue}c` : `${r.discountValue}%`) : null
            const entity = r.bank?.name ?? r.wallet?.name ?? r.cardNetwork?.name
            return (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {entity && <span className="text-xs text-slate-500 font-medium">{entity}</span>}
                {val && <span className={`text-xs font-bold ${isCSI ? 'text-purple-700' : 'text-blue-700'}`}>{val}</span>}
                {r.cap != null && r.cap > 0 ? (
                  <span className="text-xs text-slate-500">tope <span className="font-semibold text-slate-700">{fmtMoney(r.cap)}</span></span>
                ) : r.capUnlimited ? (
                  <span className="text-xs font-bold text-emerald-700">Sin tope</span>
                ) : null}
                {r.minPurchase != null && r.minPurchase > 0 && (
                  <span className="text-xs text-slate-500">mín <span className="font-semibold text-slate-700">{fmtMoney(r.minPurchase)}</span></span>
                )}
                {promo.requirements.length > 1 && (
                  <span className="text-xs text-slate-400">+{promo.requirements.length - 1} más</span>
                )}
              </div>
            )
          })()}
        </div>

        {/* Vigencia */}
        <div className="w-28 shrink-0 text-right">
          <p className="text-xs font-mono text-slate-600">
            {fmtDate(promo.validFrom)}
            <span className="text-slate-400 mx-0.5">→</span>
            {promo.validUntil ? fmtDate(promo.validUntil) : '∞'}
          </p>
        </div>

        {/* Días */}
        <div className="flex gap-0.5 shrink-0">
          {DAY_LABELS.map((d, i) => {
            const active = !!(promo.validDays & (1 << i))
            return (
              <span key={d} className={`text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded ${active ? 'bg-slate-800 text-white' : 'text-slate-300'}`}>{d}</span>
            )
          })}
        </div>

        {/* Expand trigger */}
        <button onClick={onToggleExpand}
          className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${isExpanded ? 'bg-slate-200 border-slate-400 text-slate-800' : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}>
          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          {totalReqs} req{totalReqs !== 1 ? 's' : ''}
        </button>

        {/* Acciones */}
        <div className="flex items-center gap-0.5 shrink-0">
          {promo.sourceUrl && (
            <a href={promo.sourceUrl} target="_blank" rel="noopener"
              className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"><ExternalLink size={14} /></a>
          )}
          <button onClick={onEdit}
            className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <Pencil size={14} />
          </button>
          <button onClick={onApprove} disabled={saving}
            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors rounded-lg disabled:opacity-40"><Check size={16} /></button>
          <button onClick={onReject} disabled={saving}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg disabled:opacity-40"><X size={16} /></button>
        </div>
      </div>

      {/* Requirements expandibles */}
      {isExpanded && (
        <div className="mx-4 mb-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {promo.requirements.map((r, i) => (
            <ReqRow key={r.id} r={r} idx={i} total={promo.requirements.length} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function PendingPromosTab() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationIssues, setValidationIssues] = useState<Map<string, string[]>>(new Map())
  const [validationSummary, setValidationSummary] = useState<{ approved: number; flagged: number } | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [commerces, setCommerces] = useState<Commerce[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [cardNetworks, setCardNetworks] = useState<CardNetwork[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [pending, cats, com, ent] = await Promise.all([
      fetch('/api/admin/pending-promos').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/admin/commerces-list').then(r => r.json()),
      fetch('/api/public/entities').then(r => r.json()),
    ])
    setPromos(pending.promos ?? [])
    const catArr: Category[] = cats.categories ?? cats ?? []
    setCategories(catArr.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setCommerces(com.commerces ?? [])
    setBanks(ent.banks ?? [])
    setWallets(ent.wallets ?? [])
    setCardNetworks(ent.cardNetworks ?? [])
    setLoading(false)
    setSelected(new Set())
    setExpanded(new Set())
    setValidationIssues(new Map())
    setValidationSummary(null)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function autoValidate() {
    setValidating(true)
    setValidationSummary(null)
    try {
      const res = await fetch('/api/admin/auto-validate', { method: 'POST' })
      if (!res.ok) return
      const { approved, flagged } = await res.json()
      // Remover las aprobadas de la lista
      const flaggedIds = new Set(flagged.map((f: any) => f.promoId))
      setPromos(p => p.filter(x => flaggedIds.has(x.id)))
      // Guardar issues por promo
      const map = new Map<string, string[]>()
      for (const f of flagged) map.set(f.promoId, f.issues)
      setValidationIssues(map)
      setValidationSummary({ approved, flagged: flagged.length })
    } finally {
      setValidating(false)
    }
  }

  const allExpanded = expanded.size === promos.length && promos.length > 0

  function toggleAll() {
    setSelected(s => s.size === promos.length ? new Set() : new Set(promos.map(p => p.id)))
  }
  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function expandAll()   { setExpanded(new Set(promos.map(p => p.id))) }
  function collapseAll() { setExpanded(new Set()) }

  async function act(ids: string[], action: 'approve' | 'reject') {
    if (!ids.length) return
    const verb = action === 'approve' ? 'aprobar' : 'rechazar'
    if (!confirm(`¿${verb[0].toUpperCase() + verb.slice(1)} ${ids.length} promo(s)?`)) return
    setSaving(true)
    const res = await fetch('/api/admin/pending-promos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    })
    if (res.ok) {
      setPromos(p => p.filter(x => !ids.includes(x.id)))
      setSelected(new Set())
      if (editingPromo && ids.includes(editingPromo.id)) setEditingPromo(null)
    }
    setSaving(false)
  }

  const selectedIds = Array.from(selected)

  return (
    <div>
      {/* ── Modal edición ── */}
      {editingPromo && (
        <EditModal
          promo={editingPromo}
          categories={categories} commerces={commerces}
          banks={banks} wallets={wallets} cardNetworks={cardNetworks}
          onSave={updated => { setPromos(p => p.map(x => x.id === updated.id ? updated : x)); setEditingPromo(updated) }}
          onClose={() => setEditingPromo(null)}
        />
      )}
      {/* ── Tabla principal ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <button onClick={toggleAll} className="shrink-0 text-slate-400 hover:text-slate-700">
            {selected.size === promos.length && promos.length > 0 ? <CheckSquare size={15} className="text-slate-700" /> : <Square size={15} />}
          </button>
          <span className="text-xs font-semibold text-slate-600">
            {loading ? 'Cargando…' : `${promos.length} pendientes`}
            {selected.size > 0 && <span className="text-slate-400 font-normal"> · {selected.size} sel.</span>}
          </span>

          <div className="flex-1" />

          {/* Expand / collapse */}
          {promos.length > 0 && (
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={expandAll} title="Desplegar todo"
                className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold transition-colors ${allExpanded ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                <ChevronsDown size={12} /> Desplegar
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <button onClick={collapseAll} title="Comprimir todo"
                className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold transition-colors ${expanded.size === 0 ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                <ChevronsUp size={12} /> Comprimir
              </button>
            </div>
          )}

          {/* Bulk actions */}
          {selectedIds.length > 0 ? (
            <>
              <button onClick={() => act(selectedIds, 'approve')} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Check size={11} /> Aprobar ({selectedIds.length})
              </button>
              <button onClick={() => act(selectedIds, 'reject')} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                <X size={11} /> Rechazar ({selectedIds.length})
              </button>
            </>
          ) : promos.length > 0 ? (
            <>
              <button onClick={() => act(promos.map(p => p.id), 'approve')} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Check size={11} /> Aprobar todas
              </button>
              <button onClick={() => act(promos.map(p => p.id), 'reject')} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-lg hover:bg-red-100 disabled:opacity-50 border border-red-200 transition-colors">
                <X size={11} /> Rechazar todas
              </button>
            </>
          ) : null}

          {promos.length > 0 && (
            <button onClick={autoValidate} disabled={validating || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <ShieldCheck size={11} /> {validating ? 'Validando…' : 'Auto-validar'}
            </button>
          )}

          <button onClick={fetchAll} className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Banner resumen validación */}
        {validationSummary && (
          <div className={`flex items-center gap-3 px-4 py-2.5 text-xs border-b ${validationSummary.flagged === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <ShieldCheck size={14} className={validationSummary.flagged === 0 ? 'text-emerald-600' : 'text-amber-600'} />
            <span className={validationSummary.flagged === 0 ? 'text-emerald-700' : 'text-amber-700'}>
              <span className="font-bold">{validationSummary.approved} aprobadas</span> automáticamente.
              {validationSummary.flagged > 0 && (
                <> <span className="font-bold">{validationSummary.flagged} requieren revisión</span> — revisalas abajo.</>
              )}
              {validationSummary.flagged === 0 && ' Todo limpio.'}
            </span>
            <button onClick={() => setValidationSummary(null)} className="ml-auto text-slate-400 hover:text-slate-600"><X size={12} /></button>
          </div>
        )}

        {/* Column headers */}
        {!loading && promos.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/30">
            <div className="w-3.5 shrink-0" />
            <div className="w-8 shrink-0" />
            <p className="w-40 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-300">Comercio</p>
            <p className="flex-1 text-[9px] font-black uppercase tracking-widest text-slate-300">Título</p>
            <p className="w-28 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-300 text-right">Vigencia</p>
            <p className="w-36 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-300 text-center">Días</p>
            <div className="w-16 shrink-0" />
            <div className="w-24 shrink-0" />
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Cargando…</div>
        ) : promos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm font-medium">Sin promos pendientes</p>
            <p className="text-slate-300 text-xs mt-1">Las nuevas promos de los scrapers aparecen aquí antes de publicarse.</p>
          </div>
        ) : promos.map(p => (
          <PromoRow
            key={p.id}
            promo={p}
            isSelected={selected.has(p.id)}
            isExpanded={expanded.has(p.id)}
            isEditing={editingPromo?.id === p.id}
            issues={validationIssues.get(p.id)}
            onToggleSelect={() => setSelected(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
            onToggleExpand={() => toggleExpand(p.id)}
            onEdit={() => setEditingPromo(editingPromo?.id === p.id ? null : p)}
            onApprove={() => act([p.id], 'approve')}
            onReject={() => act([p.id], 'reject')}
            saving={saving}
          />
        ))}
      </div>
    </div>
  )
}
