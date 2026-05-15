'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Pencil, Trash2, Plus, X, Check, RefreshCw, Bot,
  Users, Building2, CreditCard, Layers, DollarSign, Wallet as WalletIcon,
  Tag, ChevronRight, Search, ShieldAlert, ShieldCheck
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type Entity = { id: string; name: string; active?: boolean; logoUrl?: string }
type Bank = Entity & { segments: Entity[]; cardNetworks: Entity[] }
type CardNetwork = Entity & { banks: { id: string; name: string }[] }
type User = { id: string; name: string | null; email: string; role: string; active: boolean; createdAt: string; image?: string }

type Entities = {
  categories: Entity[]
  commerces: Entity[]
  banks: Bank[]
  wallets: Entity[]
  cardNetworks: CardNetwork[]
  segments: (Entity & { bankId: string })[]
  currencies: { id: string; name: string; code: string; symbol: string }[]
  accountTypes: { id: string; name: string; description: string }[]
}

type Requirement = {
  id?: string
  bankId?: string
  bankIds?: string[] // Para multi-selección en el form
  walletId?: string
  walletIds?: string[] // Para multi-selección en el form
  cardNetworkId?: string
  cardNetworkIds?: string[] // Para multi-selección en el form
  cardType?: string
  cardTypeIds?: string[] // Para multi-selección en el form
  paymentChannel?: string
  paymentChannelIds?: string[] // Para multi-selección en el form
  accountType?: string
  accountTypeIds?: string[] // Para multi-selección en el form
  segmentId?: string
  segmentIds?: string[] // Para multi-selección en el form
  segment?: string
  discountType?: string
  discountValue?: number | string
  nxmN?: number | string
  nxmM?: number | string
  cap?: number | string
  capPeriod?: string
  capTarget?: string
  minPurchase?: number | string
  note?: string
}

type PromoFull = {
  id: string
  title: string
  description: string
  uniqueUsePerPeriod: boolean
  maxUsesPerPeriod: number | null
  stackable: boolean
  stackableNote: string | null
  validFrom: string
  validUntil: string | null
  validDays: number
  validDaysNote: string | null
  validFromHour: number | null
  validToHour: number | null
  categoryId: string
  commerceId: string
  status: string
  sourceUrl: string | null
  sourceNote: string | null
  sourceText: string | null
  specificDates: string | null
  requirements: Requirement[]
  category: { name: string; color: string }
  commerce: { name: string }
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DISCOUNT_TYPES = [
  { value: 'PERCENTAGE_REINTEGRO', label: '% Reintegro' },
  { value: 'PERCENTAGE_DESCUENTO', label: '% Descuento directo' },
  { value: 'BONIFICACION', label: 'Bonificación' },
  { value: 'FIXED_AMOUNT', label: 'Monto fijo ($)' },
  { value: 'NXM', label: 'N×M (llevá N pagá M)' },
]
const CAP_PERIODS = [
  { value: 'PER_TRANSACTION', label: 'Por transacción' },
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'TOTAL', label: 'Total (único)' },
]
const CAP_TARGETS = [
  { value: 'USER', label: 'Por usuario' },
  { value: 'CARD', label: 'Por tarjeta' },
  { value: 'ACCOUNT', label: 'Por cuenta' },
  { value: 'TRANSACCION', label: 'Por transacción' },
]
const CARD_TYPES = [
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'PREPAID', label: 'Prepaga' },
]
const PAYMENT_CHANNELS = [
  { value: 'ANY', label: 'Cualquiera' },
  { value: 'QR', label: '📱 QR' },
  { value: 'NFC', label: '📶 Sin contacto (NFC)' },
  { value: 'TARJETA_FISICA', label: '💳 Tarjeta física' },
  { value: 'TRANSFERENCIA', label: '💸 Transferencia' },
  { value: 'DINERO_EN_CUENTA', label: '💰 Dinero en cuenta' },
]
const ACCOUNT_TYPES = [
  { value: 'ANY', label: 'Todos' },
  { value: 'HABERES', label: 'Cuenta haberes / Plan sueldo' },
  { value: 'JUBILADO', label: 'Jubilados y pensionados' },
  { value: 'ANSES', label: 'Beneficiarios ANSES' },
]
const PROVINCES = [
  'Todas', 'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
]

function bitmaskToDays(bitmask: number): boolean[] {
  return Array.from({ length: 7 }, (_, i) => (bitmask & (1 << i)) !== 0)
}
function daysBitmask(days: boolean[]) {
  return days.reduce((acc, on, i) => acc | (on ? 1 << i : 0), 0)
}
function daysLabel(bitmask: number) {
  const active = DAYS.filter((_, i) => (bitmask & (1 << i)) !== 0)
  if (active.length === 7) return 'Todos los días'
  return active.join(', ')
}

const emptyForm = (promo?: PromoFull) => ({
  title: promo?.title ?? '',
  description: promo?.description ?? '',
  uniqueUsePerPeriod: promo?.uniqueUsePerPeriod ?? false,
  maxUsesPerPeriod: promo?.maxUsesPerPeriod?.toString() ?? '',
  stackable: promo?.stackable ?? false,
  stackableNote: promo?.stackableNote ?? '',
  validFrom: promo?.validFrom ? new Date(promo.validFrom).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  validUntil: promo?.validUntil ? new Date(promo.validUntil).toISOString().slice(0, 10) : '',
  validDaysArr: promo ? bitmaskToDays(promo.validDays) : [true, true, true, true, true, true, true],
  validDaysNote: promo?.validDaysNote ?? '',
  validFromHour: promo?.validFromHour?.toString() ?? '',
  validToHour: promo?.validToHour?.toString() ?? '',
  categoryId: promo?.categoryId ?? '',
  commerceId: promo?.commerceId ?? '',
  status: promo?.status ?? 'ACTIVE',
  sourceUrl: promo?.sourceUrl ?? '',
  sourceNote: promo?.sourceNote ?? '',
  sourceText: promo?.sourceText ?? '',
  provinces: (promo as any)?.provinces ?? ['Todas'],
  specificDatesStr: promo?.specificDates ? (JSON.parse(promo.specificDates) as string[]).join(', ') : '',
  requirements: (promo?.requirements ?? []) as Requirement[],
})

type FormState = ReturnType<typeof emptyForm>

function formatValidDays(mask: number) {
  if (!mask || mask === 127) return 'Todos los días'
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const active = []
  for (let i = 0; i < 7; i++) {
    if ((mask & (1 << i)) !== 0) active.push(days[i])
  }
  if (active.length === 2 && (mask & (1 << 6)) && (mask & (1 << 0))) return 'Fin de semana'
  if (active.length === 5 && !(mask & (1 << 0)) && !(mask & (1 << 6))) return 'Lunes a Viernes'
  return active.join(', ')
}

function diasVigencia(p: any) {
  const parts = []
  if (p.specificDates && p.specificDates.length > 0) {
    parts.push('Fechas esp.')
  } else {
    parts.push(formatValidDays(p.validDays))
  }

  if (p.validUntil) {
    const end = new Date(p.validUntil)
    const day = end.getDate().toString().padStart(2, '0')
    const month = (end.getMonth() + 1).toString().padStart(2, '0')
    parts.push(`Vence ${day}/${month}/${end.getFullYear()}`)
  }
  return parts.join(' · ')
}


// ─── Scraper Config ───────────────────────────────────────────
const SCRAPERS_CONFIG = [
  { id: 'coto',      name: 'Coto',      type: 'rubro', categoria: 'Supermercados', description: 'Supermercado — scraping de legales' },
  { id: 'modo',      name: 'MODO',      type: 'billetera', description: 'Billetera digital — API pública' },
  { id: 'diarco',    name: 'Diarco',    type: 'rubro', categoria: 'Supermercados', description: 'Mayorista — scraping de legales' },
  { id: 'jumbo',     name: 'Jumbo',     type: 'rubro', categoria: 'Supermercados', description: 'Cencosud — Playwright' },
  { id: 'disco',     name: 'Disco',     type: 'rubro', categoria: 'Supermercados', description: 'Cencosud — Playwright' },
  { id: 'vea',       name: 'Vea',       type: 'rubro', categoria: 'Supermercados', description: 'Cencosud — Playwright' },
  { id: 'changomas', name: 'ChangoMas', type: 'rubro', categoria: 'Supermercados', description: 'Walmart Arg. — Playwright' },
]
const MODO_CATEGORIAS = ['Supermercados', 'Combustible', 'Tecnologia', 'Petshops', 'Gastronomia', 'Transporte', 'Farmacias', 'Indumentaria']

// ─── Main Component ───────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<'promos' | 'expired' | 'users' | 'entities' | 'form'>('promos')
  const [subTab, setSubTab] = useState<string>('') // Para rubros en promos o sub-entidades
  const [entities, setEntities] = useState<Entities | null>(null)
  const [promos, setPromos] = useState<PromoFull[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newReq, setNewReq] = useState<Requirement>({})
  const [scraping, setScraping] = useState(false)
  const [scraperModal, setScraperModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Estados ABM Entidades
  const [editingEntity, setEditingEntity] = useState<{ 
    type: string; 
    id?: string; 
    name: string; 
    logoUrl?: string; 
    code?: string; 
    symbol?: string; 
    bankId?: string; 
    cardNetworkIds?: string[];
    bcraCode?: string;
    codigoModo?: string;
  } | null>(null)

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/entities')
      if (res.ok) {
        const data = await res.json()
        setEntities(data)
        // Default subtab for entities if none
        if (tab === 'entities' && !subTab) setSubTab('banks')
        // Default subtab for promos categories
        if (tab === 'promos' && !subTab && data.categories?.length > 0) {
          setSubTab(data.categories[0].id)
        }
      }
    } catch (e) {
      console.error('Error fetching entities', e)
    }
  }, [tab]) // Quitamos subTab de aquí para evitar refetches infinitos

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promos')
      const data = await res.json()
      if (data.promos) setPromos(data.promos)
    } catch (e) {
      console.error('Error fetching promos', e)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
    }
  }, [])

  useEffect(() => {
    fetchEntities()
    fetchPromos()
    fetchUsers()
  }, [fetchEntities, fetchPromos, fetchUsers])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }
  function toggleDay(i: number) {
    const arr = [...form.validDaysArr]
    arr[i] = !arr[i]
    set('validDaysArr', arr)
  }
  function addRequirement() {
    const bankIds = newReq.bankIds?.length ? newReq.bankIds : [newReq.bankId || '']
    const walletIds = newReq.walletIds?.length ? newReq.walletIds : [newReq.walletId || '']
    const networkIds = newReq.cardNetworkIds?.length ? newReq.cardNetworkIds : [newReq.cardNetworkId || '']
    const segmentIds = newReq.segmentIds?.length ? newReq.segmentIds : [newReq.segmentId || '']
    const cardTypeIds = newReq.cardTypeIds?.length ? newReq.cardTypeIds : [newReq.cardType || 'ANY']
    const paymentChannelIds = newReq.paymentChannelIds?.length ? newReq.paymentChannelIds : [newReq.paymentChannel || 'ANY']
    const accountTypeIds = newReq.accountTypeIds?.length ? newReq.accountTypeIds : [newReq.accountType || 'ANY']

    // Asegurar valores por defecto para condiciones
    const finalNewReq: Requirement = {
      ...newReq,
      discountType: newReq.discountType || 'PERCENTAGE_REINTEGRO',
      discountValue: newReq.discountValue || 0,
      capPeriod: newReq.capPeriod || 'MONTHLY',
      capTarget: newReq.capTarget || 'USER',
    }

    const newGeneratedReqs: Requirement[] = []

    bankIds.forEach(bid => {
      walletIds.forEach(wid => {
        networkIds.forEach(nid => {
          cardTypeIds.forEach(ctid => {
            paymentChannelIds.forEach(pcid => {
              accountTypeIds.forEach(atid => {
                // Si hay más de un banco, o no seleccionamos segmentos, va a todos (null)
                if (bankIds.length > 1 || !segmentIds.length) {
                  newGeneratedReqs.push({
                    ...finalNewReq,
                    bankId: bid || undefined,
                    walletId: wid || undefined,
                    cardNetworkId: nid || undefined,
                    cardType: ctid !== 'ANY' ? ctid : undefined,
                    paymentChannel: pcid,
                    accountType: atid !== 'ANY' ? atid : undefined,
                    segmentId: undefined
                  })
                } else {
                  // Un solo banco: aplicamos segmentos seleccionados
                  segmentIds.forEach(sid => {
                    newGeneratedReqs.push({
                      ...finalNewReq,
                      bankId: bid || undefined,
                      walletId: wid || undefined,
                      cardNetworkId: nid || undefined,
                      cardType: ctid !== 'ANY' ? ctid : undefined,
                      paymentChannel: pcid,
                      accountType: atid !== 'ANY' ? atid : undefined,
                      segmentId: sid || undefined
                    })
                  })
                }
              })
            })
          })
        })
      })
    })

    if (newGeneratedReqs.length === 0) return
    set('requirements', [...form.requirements, ...newGeneratedReqs])
    setNewReq({
      discountType: 'PERCENTAGE_REINTEGRO',
      discountValue: undefined,
      capPeriod: 'MONTHLY',
      capTarget: 'USER',
      bankIds: [],
      walletIds: [],
      cardNetworkIds: [],
      segmentIds: [],
      cardTypeIds: [],
      paymentChannelIds: [],
      accountTypeIds: []
    })
  }
  function removeReq(i: number) {
    set('requirements', form.requirements.filter((_, idx) => idx !== i))
  }

  function startNew() {
    setEditingId(null)
    setForm(emptyForm())
    setSuccess('')
    setError('')
    setTab('form')
  }

  function startEdit(promo: PromoFull, reactivate = false) {
    setEditingId(promo.id)
    setForm({
      ...emptyForm(promo),
      status: reactivate ? 'ACTIVE' : (promo.status as any),
    })
    setTab('form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (form.requirements.length === 0) {
      setError('Debes agregar al menos una condición de descuento (botón "+ AGREGAR CONDICIÓN")')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const specificDates = form.specificDatesStr
        ? form.specificDatesStr.split(',').map(s => {
          const raw = s.trim()
          if (!raw) return null
          // Support DD-MM-AAAA
          if (raw.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
            const [d, m, y] = raw.split('-')
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
          }
          return raw
        }).filter(Boolean) as string[]
        : []
      // Ajuste de fecha de expiración para que sea inclusiva (fin del día en Argentina UTC-3)
      let validUntilDate = form.validUntil ? new Date(form.validUntil + 'T23:59:59') : null
      if (validUntilDate) {
        // Si la fecha se creó como local, la pasamos a UTC sumando el offset o simplemente asumiendo local
        // Para simplificar y asegurar que cubra el día en Argentina (UTC-3):
        // Queremos que en UTC sea las 03:00 del día siguiente.
        validUntilDate = new Date(form.validUntil + 'T23:59:59-03:00')
      }

      const payload = {
        ...form,
        validUntil: validUntilDate,
        validDays: daysBitmask(form.validDaysArr),
        provinces: form.provinces,
        specificDates: specificDates.length > 0 ? specificDates : undefined,
      }
      const url = editingId ? `/api/promos/${editingId}` : '/api/promos'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al guardar')
      }
      setSuccess(editingId ? '✅ Promo actualizada' : '✅ Promo creada')
      setEditingId(null)
      setForm(emptyForm())
      setTab('promos')
      fetchPromos()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await fetch(`/api/promos/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      fetchPromos()
    } finally {
      setSaving(false)
    }
  }

  async function handleScrape(scraper?: string, categoria?: string) {
    setScraping(true)
    setError('')
    setSuccess('')
    setScraperModal(false)
    try {
      const res = await fetch('/api/admin/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scraper, categoria })
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(`🤖 Scraping finalizado. Leídas: ${data.totalFound} | Procesadas: ${data.processed}`)
        fetchPromos()
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error conectando al scraper')
    }
    setScraping(false)
  }

  // --- Usuarios ---
  async function toggleUserStatus(u: User) {
    try {
      await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, active: !u.active })
      })
      fetchUsers()
    } catch { }
  }

  // --- Entidades ABM ---
  async function handleSaveEntity() {
    if (!editingEntity) return
    setSaving(true)
    try {
      const method = editingEntity.id ? 'PUT' : 'POST'
      let url = '/api/admin/entities'
      if (editingEntity.type === 'currency') url = '/api/admin/currencies'
      if (editingEntity.type === 'accountType') url = '/api/admin/account-types'
      if (editingEntity.type === 'segment') url = '/api/admin/segments'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEntity)
      })
      if (res.ok) {
        setSuccess('✅ Entidad guardada')
        setEditingEntity(null)
        fetchEntities()
      } else {
        const d = await res.json()
        setError(d.error || 'Error al guardar')
      }
    } catch {
      setError('Error guardando entidad')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEntity(type: string, id: string) {
    if (!confirm('¿Seguro que quieres eliminar este elemento?')) return
    setSaving(true)
    try {
      let url = `/api/admin/entities?id=${id}&type=${type}`
      if (type === 'currency') url = `/api/admin/currencies?id=${id}`
      if (type === 'accountType') url = `/api/admin/account-types?id=${id}`
      if (type === 'segment') url = `/api/admin/segments?id=${id}`

      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        setSuccess('✅ Eliminado correctamente')
        fetchEntities()
      } else {
        setError('No se pudo eliminar')
      }
    } catch {
      setError('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  function discountLabel(r: Requirement) {
    const val = r.discountValue ?? 0
    if (r.discountType === 'PERCENTAGE_REINTEGRO' || r.discountType === 'PERCENTAGE_DESCUENTO') return `${val}%`
    if (r.discountType === 'FIXED_AMOUNT') return `$${val}`
    if (r.discountType === 'NXM') return `${r.nxmN}×${r.nxmM}`
    return `${val}`
  }

  function reqLabel(r: Requirement) {
    const parts: string[] = []
    if (r.bankId && entities) parts.push(entities.banks.find(b => b.id === r.bankId)?.name ?? r.bankId)
    if (r.walletId && entities) parts.push(entities.wallets.find(w => w.id === r.walletId)?.name ?? r.walletId)
    if (r.cardNetworkId && entities) parts.push(entities.cardNetworks.find(c => c.id === r.cardNetworkId)?.name ?? r.cardNetworkId)
    if (r.cardType) parts.push(CARD_TYPES.find(c => c.value === r.cardType)?.label ?? r.cardType)
    if (r.paymentChannel && r.paymentChannel !== 'ANY') parts.push(PAYMENT_CHANNELS.find(c => c.value === r.paymentChannel)?.label ?? r.paymentChannel)
    if (r.accountType && r.accountType !== 'ANY') parts.push(ACCOUNT_TYPES.find(c => c.value === r.accountType)?.label ?? r.accountType)
    if (r.segmentId && entities) {
      const s = entities.segments.find(x => x.id === r.segmentId)
      if (s) parts.push(`Seg: ${s.name}`)
    }
    if (r.minPurchase) parts.push(`Mín: $${r.minPurchase}`)
    if (r.note) parts.push(`(${r.note})`)
    return parts.join(' · ') || 'Cualquier medio'
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white p-2 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Admin Panel</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">PromoAR Platform Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScraperModal(true)}
            disabled={scraping}
            className="flex items-center gap-2 text-xs px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <Bot size={15} />
            {scraping ? 'Actualizando...' : 'Auto-Sync Scraper'}
          </button>
          <div className="h-8 w-[1px] bg-slate-100 mx-2" />
          <button onClick={startNew} className="p-2.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors">
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* ── Main Nav ── */}
      <nav className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 shadow-sm">
        <TabButton active={tab === 'promos'} icon={Layers} onClick={() => { setTab('promos'); setSubTab(entities?.categories[0]?.id || '') }}>
          Promociones
        </TabButton>
        <TabButton active={tab === 'users'} icon={Users} onClick={() => setTab('users')}>
          Usuarios
        </TabButton>
        <TabButton active={tab === 'entities'} icon={Building2} onClick={() => { setTab('entities'); setSubTab('banks') }}>
          Entidades y Config
        </TabButton>
        <TabButton active={tab === 'expired'} icon={RefreshCw} onClick={() => setTab('expired')}>
          Expiradas
        </TabButton>
        {tab === 'form' && (
          <TabButton active={true} icon={Pencil} onClick={() => { }}>
            {editingId ? 'Editando Promo' : 'Nueva Promo'}
          </TabButton>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Alerts */}
        {(success || error) && (
          <div className="animate-in slide-in-from-top-4 duration-300">
            {success && <Alert type="success" onClear={() => setSuccess('')}>{success}</Alert>}
            {error && <Alert type="error" onClear={() => setError('')}>{error}</Alert>}
          </div>
        )}

        {/* ── PROMOS TAB (CATEGORIZED) ── */}
        {tab === 'promos' && (
          <div className="space-y-6">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
              {entities?.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSubTab(cat.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === cat.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading && <Loader message="Cargando promociones..." />}
              {!loading && promos.filter(p => p.categoryId === subTab && p.status !== 'EXPIRED').length === 0 && (
                <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
                  <Tag className="mx-auto text-slate-200 mb-3" size={40} />
                  <p className="text-slate-400 font-medium">No hay promos en esta categoría</p>
                </div>
              )}
              {promos.filter(p => p.categoryId === subTab && p.status !== 'EXPIRED').map(p => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  onEdit={() => startEdit(p)}
                  onDelete={() => setDeleteConfirm(p.id)}
                  isDeleting={deleteConfirm === p.id}
                  onCancelDelete={() => setDeleteConfirm(null)}
                  confirmDelete={() => handleDelete(p.id)}
                  discount={
                    p.requirements.length > 0
                      ? discountLabel(p.requirements.reduce((max, r) => (r.discountValue ?? 0) > (max.discountValue ?? 0) ? r : max, p.requirements[0]))
                      : '0%'
                  }
                  conditions={[
                    diasVigencia(p),
                    ...p.requirements.map(r => reqLabel(r))
                  ]}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'expired' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Promociones Expiradas</h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{promos.filter(p => p.status === 'EXPIRED').length} TOTAL</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promos.filter(p => p.status === 'EXPIRED').length === 0 && (
                <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-[3rem]">
                  <RefreshCw className="mx-auto text-slate-100 mb-4" size={48} />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay promociones expiradas</p>
                </div>
              )}
              {promos.filter(p => p.status === 'EXPIRED').map(p => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  onEdit={() => startEdit(p, true)} // Reactivate mode
                  onDelete={() => setDeleteConfirm(p.id)}
                  isDeleting={deleteConfirm === p.id}
                  onCancelDelete={() => setDeleteConfirm(null)}
                  confirmDelete={() => handleDelete(p.id)}
                  discount={
                    p.requirements.length > 0
                      ? discountLabel(p.requirements.reduce((max, r) => (r.discountValue ?? 0) > (max.discountValue ?? 0) ? r : max, p.requirements[0]))
                      : '0%'
                  }
                  conditions={[
                    diasVigencia(p),
                    ...p.requirements.map(r => reqLabel(r))
                  ]}
                  isExpiredView={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Gestión de Usuarios</h3>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar por email..." className="pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-100" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Rol</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Registro</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                            {u.image ? <img src={u.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">{u.email[0]}</div>}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{u.name || 'Sin nombre'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${u.role === 'ADMIN' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-500'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleUserStatus(u)}
                          className={`flex items-center gap-1.5 text-[10px] font-bold ${u.active ? 'text-green-600' : 'text-red-500'}`}
                        >
                          {u.active ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                          {u.active ? 'ACTIVO' : 'BLOQUEADO'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ENTITIES TAB (ABM) ── */}
        {tab === 'entities' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar Nav */}
            <div className="space-y-1">
              <EntitySubTab active={subTab === 'banks'} icon={Building2} onClick={() => setSubTab('banks')}>Bancos / Entidades</EntitySubTab>
              <EntitySubTab active={subTab === 'segments'} icon={Layers} onClick={() => setSubTab('segments')}>Segmentos</EntitySubTab>
              <EntitySubTab active={subTab === 'networks'} icon={CreditCard} onClick={() => setSubTab('networks')}>Marcas de Tarjeta</EntitySubTab>
              <EntitySubTab active={subTab === 'currencies'} icon={DollarSign} onClick={() => setSubTab('currencies')}>Monedas</EntitySubTab>
              <EntitySubTab active={subTab === 'accountTypes'} icon={WalletIcon} onClick={() => setSubTab('accountTypes')}>Tipos de Cuenta</EntitySubTab>
              <EntitySubTab active={subTab === 'commerces'} icon={Tag} onClick={() => setSubTab('commerces')}>Comercios</EntitySubTab>
            </div>

            {/* Content Area */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {subTab === 'banks' && 'Gestión de Bancos'}
                  {subTab === 'segments' && 'Segmentos Bancarios'}
                  {subTab === 'networks' && 'Marcas de Tarjeta'}
                  {subTab === 'currencies' && 'Monedas del Sistema'}
                  {subTab === 'accountTypes' && 'Tipos de Cuenta Admitidos'}
                  {subTab === 'commerces' && 'Base de Comercios'}
                </h2>
                <button
                  onClick={() => {
                    const typeMap: Record<string, string> = {
                      banks: 'bank',
                      segments: 'segment',
                      networks: 'cardNetwork',
                      currencies: 'currency',
                      accountTypes: 'accountType',
                      commerces: 'commerce',
                      wallets: 'wallet'
                    }
                    setEditingEntity({ type: typeMap[subTab] || subTab, name: '', logoUrl: '', cardNetworkIds: [] })
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
                >
                  <Plus size={12} /> AGREGAR
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm min-h-[200px]">
                <div className="divide-y divide-slate-100">
                  {!entities && <Loader message="Cargando entidades..." />}

                  {entities && subTab === 'banks' && (entities.banks?.length === 0 ? <EmptyState msg="No hay bancos cargados" /> : entities.banks.map(b => (
                    <EntityRow
                      key={b.id}
                      name={b.name}
                      img={b.logoUrl}
                      onEdit={() => setEditingEntity({ 
                        type: 'bank', 
                        ...b, 
                        cardNetworkIds: b.cardNetworks.map(n => n.id),
                        bcraCode: (b as any).bcraCode,
                        codigoModo: (b as any).codigoModo
                      })}
                      onDelete={() => handleDeleteEntity('bank', b.id)}
                      badge={`${b.cardNetworks.length} redes`}
                    />
                  )))}

                  {entities && subTab === 'segments' && (entities.segments?.length === 0 ? <EmptyState msg="No hay segmentos configurados" /> : entities.segments.map(s => (
                    <EntityRow
                      key={s.id}
                      name={s.name}
                      onEdit={() => setEditingEntity({ type: 'segment', ...s })}
                      onDelete={() => handleDeleteEntity('segment', s.id)}
                      badge={entities.banks.find(b => b.id === s.bankId)?.name}
                    />
                  )))}

                  {entities && subTab === 'networks' && (entities.cardNetworks?.length === 0 ? <EmptyState msg="No hay redes (Visa/MC) configuradas" /> : entities.cardNetworks.map(n => (
                    <EntityRow
                      key={n.id}
                      name={n.name}
                      onEdit={() => setEditingEntity({ type: 'cardNetwork', ...n })}
                      onDelete={() => handleDeleteEntity('cardNetwork', n.id)}
                    />
                  )))}

                  {entities && subTab === 'currencies' && (entities.currencies?.length === 0 ? <EmptyState msg="No hay monedas cargadas" /> : entities.currencies.map(c => (
                    <EntityRow
                      key={c.id}
                      name={`${c.name} (${c.code})`}
                      onEdit={() => setEditingEntity({ type: 'currency', ...c })}
                      onDelete={() => handleDeleteEntity('currency', c.id)}
                      badge={c.symbol}
                    />
                  )))}

                  {entities && subTab === 'accountTypes' && (entities.accountTypes?.length === 0 ? <EmptyState msg="No hay tipos de cuenta cargados" /> : entities.accountTypes.map(at => (
                    <EntityRow
                      key={at.id}
                      name={at.name}
                      onEdit={() => setEditingEntity({ type: 'accountType', ...at })}
                      onDelete={() => handleDeleteEntity('accountType', at.id)}
                    />
                  )))}

                  {entities && subTab === 'commerces' && (entities.commerces?.length === 0 ? <EmptyState msg="No hay comercios cargados" /> : entities.commerces.map(c => (
                    <EntityRow key={c.id} name={c.name} img={c.logoUrl} onEdit={() => { }} onDelete={() => { }} />
                  )))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FORM TAB (CREATE/EDIT PROMO) ── */}
        {tab === 'form' && (
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Section title="Información Principal" icon={Tag}>
                  <div className="space-y-4">
                    <Field label="Título de la Promo *">
                      <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: 30% de ahorro con Galicia" required />
                    </Field>
                    <Field label="Descripción de Legales *">
                      <textarea value={form.description} onChange={e => set('description', e.target.value)} className={inputClass + ' min-h-[120px]'} required placeholder="Pegar legales aquí..." />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Categoría *">
                        <Select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                          <option value="">Seleccionar...</option>
                          {entities?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                      </Field>
                      <Field label="Comercio *">
                        <Select value={form.commerceId} onChange={e => set('commerceId', e.target.value)} required>
                          <option value="">Seleccionar...</option>
                          {entities?.commerces.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </div>
                </Section>

                <Section title="Vigencia y Días" icon={ChevronRight}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Desde">
                        <Input type="date" value={form.validFrom} onChange={e => set('validFrom', e.target.value)} required />
                        <DateHint value={form.validFrom} />
                      </Field>
                      <Field label="Hasta (Opcional)">
                        <Input type="date" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
                        <DateHint value={form.validUntil} />
                      </Field>
                    </div>
                    <Field label="Días Semanales">
                      <div className="flex gap-2 flex-wrap">
                        {DAYS.map((d, i) => (
                          <button key={d} type="button" onClick={() => toggleDay(i)} className={`text-[10px] w-8 h-8 rounded-full font-bold transition-all border ${form.validDaysArr[i] ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                            {d[0]}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Fechas específicas (ej: feriados)">
                      <Input value={form.specificDatesStr} onChange={e => set('specificDatesStr', e.target.value)} placeholder="DD-MM-AAAA, DD-MM-AAAA..." />
                    </Field>
                  </div>
                </Section>
              </div>

              <div className="space-y-6">
                <Section title="Condiciones de Descuento" icon={CreditCard}>
                  <div className="space-y-4">
                    {/* Lista de Requisitos actual */}
                    <div className="space-y-2">
                      {form.requirements.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                          <span className="font-bold text-slate-600 truncate mr-2">
                            {reqLabel(r)} → {discountLabel(r)}
                            {r.cap ? ` (Tope $${r.cap} ${CAP_TARGETS.find(t => t.value === r.capTarget)?.label || 'por usuario'} / ${CAP_PERIODS.find(p => p.value === r.capPeriod)?.label || 'mensual'})` : ''}
                          </span>
                          <button type="button" onClick={() => removeReq(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Agregado de Requisito */}
                    <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Bancos">
                          <MultiSelect
                            placeholder="Cualquiera"
                            options={entities?.banks || []}
                            selected={newReq.bankIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, bankIds: ids, segmentIds: [] }))}
                          />
                        </Field>
                        <Field label="Segmentos">
                          <MultiSelect
                            placeholder="Todos"
                            options={entities?.segments.filter(s => newReq.bankIds?.includes(s.bankId)) || []}
                            selected={newReq.segmentIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, segmentIds: ids }))}
                          />
                          {(newReq.bankIds?.length || 0) > 1 && <p className="text-[9px] text-indigo-500 font-bold mt-1 uppercase">Aplica a todos los segmentos</p>}
                        </Field>
                        <Field label="Billeteras">
                          <MultiSelect
                            placeholder="Ninguna / Cualquier"
                            options={entities?.wallets || []}
                            selected={newReq.walletIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, walletIds: ids }))}
                          />
                        </Field>
                        <Field label="Redes de Tarjeta">
                          <MultiSelect
                            placeholder="Cualquiera"
                            options={entities?.cardNetworks || []}
                            selected={newReq.cardNetworkIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, cardNetworkIds: ids }))}
                          />
                        </Field>
                        <Field label="Tipos de Tarjeta">
                          <MultiSelect
                            placeholder="Cualquiera"
                            options={CARD_TYPES.map(t => ({ id: t.value, name: t.label }))}
                            selected={newReq.cardTypeIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, cardTypeIds: ids }))}
                          />
                        </Field>
                        <Field label="Formas de Pago">
                          <MultiSelect
                            placeholder="Cualquiera"
                            options={PAYMENT_CHANNELS.map(pc => ({ id: pc.value, name: pc.label }))}
                            selected={newReq.paymentChannelIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, paymentChannelIds: ids }))}
                          />
                        </Field>
                        <Field label="Tipos de Cuenta Especiales">
                          <MultiSelect
                            placeholder="Todas"
                            options={ACCOUNT_TYPES.filter(a => a.value !== 'ANY').map(at => ({ id: at.value, name: at.label }))}
                            selected={newReq.accountTypeIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, accountTypeIds: ids }))}
                          />
                        </Field>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Select value={newReq.discountType || 'PERCENTAGE_REINTEGRO'} onChange={e => setNewReq(r => ({ ...r, discountType: e.target.value }))}>
                            {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </Select>
                          <Input type="number" value={newReq.discountValue ?? ''} onChange={e => setNewReq(r => ({ ...r, discountValue: e.target.value }))} placeholder="Valor (ej: 15)" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input type="number" value={newReq.cap ?? ''} onChange={e => setNewReq(r => ({ ...r, cap: e.target.value }))} placeholder="Tope ($)" />
                          <Input type="number" value={newReq.minPurchase ?? ''} onChange={e => setNewReq(r => ({ ...r, minPurchase: e.target.value }))} placeholder="Mínimo ($)" />
                        </div>
                        {newReq.cap && (
                          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                            <Select value={newReq.capPeriod || 'MONTHLY'} onChange={e => setNewReq(r => ({ ...r, capPeriod: e.target.value }))}>
                              {CAP_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </Select>
                            <Select value={newReq.capTarget || 'USER'} onChange={e => setNewReq(r => ({ ...r, capTarget: e.target.value }))}>
                              {CAP_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </Select>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={addRequirement} className="w-full py-2.5 bg-indigo-600 text-white text-[10px] font-bold rounded-xl shadow-lg shadow-indigo-100">
                        + AGREGAR CONDICIÓN
                      </button>
                    </div>
                  </div>
                </Section>

                <Section title="Otros Datos" icon={Check}>
                  <div className="space-y-4">
                    <Field label="Provincias que participan">
                      <MultiSelect
                        placeholder="Todas"
                        options={PROVINCES.map(p => ({ id: p, name: p }))}
                        selected={form.provinces}
                        onChange={(ids) => {
                          // Si se selecciona "Todas", limpiar el resto
                          if (ids.includes('Todas') && !form.provinces.includes('Todas')) {
                            set('provinces', ['Todas'])
                          } else if (ids.length > 1 && ids.includes('Todas')) {
                            set('provinces', ids.filter(x => x !== 'Todas'))
                          } else if (ids.length === 0) {
                            set('provinces', ['Todas'])
                          } else {
                            set('provinces', ids)
                          }
                        }}
                      />
                    </Field>
                    <Field label="Link a Legales">
                      <Input value={form.sourceUrl || ''} onChange={e => set('sourceUrl', e.target.value)} placeholder="https://..." />
                    </Field>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={form.stackable} onChange={e => set('stackable', e.target.checked)} className="w-4 h-4 rounded border-slate-200 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-600">Es Acumulable</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={form.uniqueUsePerPeriod} onChange={e => set('uniqueUsePerPeriod', e.target.checked)} className="w-4 h-4 rounded border-slate-200 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-600">Uso Único</span>
                      </label>
                    </div>
                  </div>
                </Section>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-200 z-10 flex gap-3 justify-center">
              <button type="button" onClick={() => setTab('promos')} className="px-8 py-3.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">CANCELAR</button>
              <button type="submit" disabled={saving} className="px-12 py-3.5 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all disabled:opacity-50">
                {saving ? 'GUARDANDO...' : editingId ? 'ACTUALIZAR PROMOCIÓN' : 'PUBLICAR PROMOCIÓN'}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* ── Modal Scraper ── */}
      {scraperModal && (
        <ScraperModal
          onClose={() => setScraperModal(false)}
          onRun={handleScrape}
          scraping={scraping}
        />
      )}

      {/* ── Modal ABM Entidad ── */}
      {editingEntity && (
        <EntityModal
          entity={editingEntity}
          setEntity={setEditingEntity}
          onSave={handleSaveEntity}
          onCancel={() => setEditingEntity(null)}
          saving={saving}
          allEntities={entities}
        />
      )}
    </div>
  )
}

// ─── Sub-Components ───────────────────────────────────────────

function TabButton({ active, icon: Icon, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-4 text-xs font-bold border-b-2 transition-all ${active ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon size={16} />
      {children}
    </button>
  )
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6 text-slate-800">
        <div className="p-1.5 bg-slate-50 rounded-lg"><Icon size={16} /></div>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function EntityRow({ name, img, onEdit, onDelete, badge }: any) {
  return (
    <div className="flex items-center justify-between px-6 py-3.5 group hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        {img ? (
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 p-1">
            <img src={img} alt="" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">{name[0]}</div>
        )}
        <div>
          <p className="text-xs font-bold text-slate-800">{name}</p>
          {badge && <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter">{badge}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Pencil size={15} /></button>
        <button onClick={onDelete} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
      </div>
    </div>
  )
}

function PromoCard({ promo, onEdit, onDelete, isDeleting, onCancelDelete, confirmDelete, discount, conditions, isExpiredView }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all flex flex-col group">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: promo.category.color + '15', color: promo.category.color }}>
              {promo.category.name}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${promo.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
              {promo.status}
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{promo.title}</h4>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{promo.commerce.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xl font-black text-green-600 tracking-tighter">{discount}</span>
        </div>
      </div>

      <div className="space-y-2 mt-auto">
        <div className="flex flex-wrap gap-1">
          {conditions.slice(0, 3).map((c: string, i: number) => (
            <span key={i} className="text-[9px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{c}</span>
          ))}
          {conditions.length > 3 && <span className="text-[9px] font-bold text-slate-400">+{conditions.length - 3}</span>}
        </div>

        <div className="flex gap-2 pt-3 border-t border-slate-50">
          {isDeleting ? (
            <div className="flex gap-1 w-full animate-in zoom-in-95">
              <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white text-[10px] font-bold py-2 rounded-xl">Confirmar</button>
              <button onClick={onCancelDelete} className="px-3 bg-slate-100 text-slate-400 text-[10px] font-bold py-2 rounded-xl">X</button>
            </div>
          ) : (
            <>
              <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                <Pencil size={13} /> {isExpiredView ? 'REUTILIZAR' : 'EDITAR'}
              </button>
              <button onClick={onDelete} className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EntityModal({ entity, setEntity, onSave, onCancel, saving, allEntities }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            Configurar {
              entity.type === 'bank' ? 'Banco' :
                entity.type === 'commerce' ? 'Comercio' :
                  entity.type === 'cardNetwork' ? 'Marca de Tarjeta' :
                    entity.type === 'currency' ? 'Moneda' :
                      entity.type === 'segment' ? 'Segmento' :
                        entity.type === 'accountType' ? 'Tipo de Cuenta' :
                          entity.type === 'wallet' ? 'Billetera' :
                            entity.type
            }
          </h3>
          <button onClick={onCancel} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4">
          <Field label="Nombre / Etiqueta">
            <Input value={entity.name} onChange={e => setEntity({ ...entity, name: e.target.value })} autoFocus />
          </Field>

          {(entity.type === 'bank' || entity.type === 'commerce') && (
            <Field label="Logo URL">
              <Input value={entity.logoUrl || ''} onChange={e => setEntity({ ...entity, logoUrl: e.target.value })} placeholder="https://..." />
            </Field>
          )}

          {entity.type === 'bank' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código BCRA Oficial">
                <Input 
                  value={entity.bcraCode || ''} 
                  onChange={e => setEntity({ ...entity, bcraCode: e.target.value })} 
                  placeholder="00011" 
                  maxLength={5}
                />
              </Field>
              <Field label="Código MODO">
                <Input 
                  value={entity.codigoModo || ''} 
                  onChange={e => setEntity({ ...entity, codigoModo: e.target.value })} 
                  placeholder="0011" 
                  maxLength={5}
                />
              </Field>
            </div>
          )}

          {entity.type === 'bank' && (
            <Field label="Marcas de Tarjeta Admitidas">
              <div className="grid grid-cols-2 gap-2 mt-2">
                {allEntities?.cardNetworks.map((n: any) => (
                  <label key={n.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 border border-slate-50">
                    <input
                      type="checkbox"
                      checked={entity.cardNetworkIds?.includes(n.id)}
                      onChange={e => {
                        const ids = entity.cardNetworkIds || []
                        setEntity({ ...entity, cardNetworkIds: e.target.checked ? [...ids, n.id] : ids.filter((i: string) => i !== n.id) })
                      }}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{n.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {entity.type === 'currency' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código (ej: ARS)">
                <Input value={entity.code || ''} onChange={e => setEntity({ ...entity, code: e.target.value.toUpperCase() })} maxLength={3} />
              </Field>
              <Field label="Símbolo (ej: $)">
                <Input value={entity.symbol || ''} onChange={e => setEntity({ ...entity, symbol: e.target.value })} />
              </Field>
            </div>
          )}

          {entity.type === 'segment' && (
            <Field label="Banco">
              <Select value={entity.bankId || ''} onChange={e => setEntity({ ...entity, bankId: e.target.value })}>
                <option value="">Selección...</option>
                {allEntities?.banks.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="px-8 py-6 bg-slate-50 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl">Cancelar</button>
          <button onClick={onSave} disabled={saving || !entity.name} className="flex-1 py-3 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl shadow-slate-200 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EntitySubTab({ active, icon: Icon, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-2xl transition-all ${active ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
    >
      <Icon size={16} />
      {children}
    </button>
  )
}

// ─── Helpers Components ───
const inputClass = 'w-full text-xs font-medium px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300'

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{label}</label>
      {children}
    </div>
  )
}

function Alert({ type, onClear, children }: { type: 'success' | 'error'; onClear: () => void; children: React.ReactNode }) {
  const isSuccess = type === 'success'
  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${isSuccess ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
      <div className="flex items-center gap-2">
        {isSuccess ? <Check size={16} /> : <ShieldAlert size={16} />}
        {children}
      </div>
      <button onClick={onClear} className="p-1 hover:bg-black/5 rounded-lg transition-colors"><X size={14} /></button>
    </div>
  )
}

function Loader({ message }: { message: string }) {
  return (
    <div className="col-span-full py-20 text-center space-y-4">
      <RefreshCw size={32} className="animate-spin mx-auto text-indigo-500" />
      <p className="text-sm font-bold text-slate-400">{message}</p>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-12 text-center">
      <Tag className="mx-auto text-slate-100 mb-3" size={32} />
      <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{msg}</p>
    </div>
  )
}

function DateHint({ value }: { value: string }) {
  if (!value) return null
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return null
  return <p className="text-[9px] font-black text-indigo-500 mt-2 ml-1 uppercase tracking-tighter">Confirmación: {d}-{m}-{y}</p>
}

// ─── ScraperModal ─────────────────────────────────────────────
function ScraperModal({ onClose, onRun, scraping }: {
  onClose: () => void
  onRun: (scraper: string, categoria?: string) => void
  scraping: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<string>('')

  const scraper = SCRAPERS_CONFIG.find(s => s.id === selected)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl"><Bot size={18} className="text-indigo-600" /></div>
            <div>
              <h3 className="font-bold text-slate-900">Auto-Sync Scraper</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Seleccioná fuente y rubro a importar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block">Fuente</label>
            <div className="grid grid-cols-2 gap-3">
              {SCRAPERS_CONFIG.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelected(s.id); setCategoria('') }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${selected === s.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                >
                  <p className="text-sm font-black text-slate-900">{s.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.description}</p>
                  <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${s.type === 'rubro' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {s.type === 'rubro' ? '⚡ Directo' : '📋 Elegí rubro'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {scraper?.type === 'billetera' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block">Rubro a importar</label>
              <div className="grid grid-cols-2 gap-2">
                {MODO_CATEGORIAS.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoria(cat)}
                    className={`py-2.5 px-3 rounded-xl text-[11px] font-bold border-2 transition-all ${categoria === cat ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700'}`}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCategoria('TODOS')}
                  className={`py-2.5 px-3 rounded-xl text-[11px] font-bold border-2 transition-all col-span-2 ${categoria === 'TODOS' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                >
                  ⚠️ Todos los rubros (proceso lento)
                </button>
              </div>
            </div>
          )}

          {scraper?.type === 'rubro' && (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 animate-in fade-in">
              <p className="text-[11px] text-green-700 font-medium">
                ✅ <strong>{scraper.name}</strong> es un scraper de rubro específico ({(scraper as any).categoria}). Se ejecuta directamente.
              </p>
            </div>
          )}
        </div>

        <div className="px-8 py-6 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!selected) return
              if (scraper?.type === 'rubro') {
                onRun(selected, (scraper as any).categoria)
              } else {
                if (!categoria) return
                onRun(selected, categoria === 'TODOS' ? undefined : categoria)
              }
            }}
            disabled={!selected || (scraper?.type === 'billetera' && !categoria) || scraping}
            className="flex-1 py-3 bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-100 disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            {scraping ? 'Ejecutando...' : '🚀 Ejecutar'}
          </button>
        </div>
      </div>
    </div>
  )
}


function MultiSelect({ options, selected, onChange, placeholder }: { options: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void; placeholder: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={inputClass + ' cursor-pointer flex items-center justify-between truncate min-h-[42px]'}
      >
        <span className={selected.length ? 'text-slate-900' : 'text-slate-300'}>
          {selected.length === 0 ? placeholder : selected.length === options.length ? 'Todos' : `${selected.length} seleccionados`}
        </span>
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-60 overflow-y-auto p-2 space-y-1 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between p-2 pb-1 border-b border-slate-50 mb-1">
              <button
                type="button"
                onClick={() => onChange(options.map(o => o.id))}
                className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[9px] font-black text-slate-400 uppercase hover:underline"
              >
                Limpiar
              </button>
            </div>
            {options.map(opt => (
              <label key={opt.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => {
                    if (selected.includes(opt.id)) {
                      onChange(selected.filter(id => id !== opt.id))
                    } else {
                      onChange([...selected, opt.id])
                    }
                  }}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-200"
                />
                <span className="text-[11px] font-bold text-slate-600 uppercase group-hover:text-slate-900">{opt.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
