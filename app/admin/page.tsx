'use client'
import { useState, useEffect, useCallback } from 'react'
import StatsView from './StatsView'
import ClassifyButton from './ClassifyButton'
import NotifPrefsTab from './NotifPrefsTab'
import PendingPromosTab from './PendingPromosTab'
import {
  Pencil, Trash2, Plus, X, Check, RefreshCw, Bot,
  Users, Building2, CreditCard, Layers, DollarSign, Wallet as WalletIcon,
  Tag, ChevronRight, Search, ShieldAlert, ShieldCheck, TrendingUp, CalendarClock, Play, Pause, CheckCircle, AlertCircle, Clock,
  GitMerge, Link2, Bell, ClipboardList, Mail, Send, Eye, Users2
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
type Entity = { id: string; name: string; active?: boolean; logoUrl?: string }
type Bank = Entity & { segments: Entity[]; cardNetworks: Entity[]; cardSegments?: Entity[] }
type Wallet = Entity & { cardNetworks?: Entity[]; cardSegments?: Entity[] }
type CardNetwork = Entity & { banks: { id: string; name: string }[] }
type CardSegment = { id: string; name: string; cardNetworkId: string; cardType: string; cardNetwork: { name: string } }
type User = { id: string; name: string | null; email: string; role: string; active: boolean; createdAt: string; image?: string; financialProfile?: { _count: { banks: number; cards: number; wallets: number } } | null }

type Entities = {
  categories: Entity[]
  commerces: Entity[]
  banks: Bank[]
  wallets: Wallet[]
  cardNetworks: CardNetwork[]
  segments: (Entity & { bankId: string })[]
  cardSegments: CardSegment[]
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
  cardSegmentId?: string
  cardSegmentIds?: string[]
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
  isFeatured: boolean
  sourceUrl: string | null
  sourceNote: string | null
  sourceText: string | null
  specificDates: string | null
  requirements: Requirement[]
  category: { name: string; color: string; slug: string }
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
type ScraperGroup = 'supermercado' | 'billetera' | 'tarjeta' | 'banco'

interface ScraperConfig {
  id: string        // debe coincidir con scraper.name.toLowerCase()
  name: string
  group: ScraperGroup
  categoria?: string
  description: string
}

const SCRAPERS_CONFIG: ScraperConfig[] = [
  // Supermercados
  { id: 'coto',            name: 'Coto',            group: 'supermercado', categoria: 'Supermercados', description: 'Supermercado — legales' },
  { id: 'diarco',          name: 'Diarco',          group: 'supermercado', categoria: 'Supermercados', description: 'Mayorista — HTML plano' },
  { id: 'jumbo',           name: 'Jumbo',           group: 'supermercado', categoria: 'Supermercados', description: 'Cencosud — Playwright' },
  { id: 'disco',           name: 'Disco',           group: 'supermercado', categoria: 'Supermercados', description: 'Cencosud — Playwright' },
  { id: 'vea',             name: 'Vea',             group: 'supermercado', categoria: 'Supermercados', description: 'Cencosud — Playwright' },
  { id: 'changomas',       name: 'ChangoMas',       group: 'supermercado', categoria: 'Supermercados', description: 'Walmart Arg. — Playwright' },
  { id: 'carrefour',       name: 'Carrefour',       group: 'supermercado', categoria: 'Supermercados', description: 'INC S.A. — Playwright' },
  { id: 'dia',             name: 'DIA',             group: 'supermercado', categoria: 'Supermercados', description: 'Supermercados DIA — HTTP GET' },
  // Billeteras
  { id: 'modo',            name: 'MODO',            group: 'billetera',    description: 'Billetera digital — API pública' },
  { id: 'mercadopago',     name: 'Mercado Pago',    group: 'billetera',    description: 'Promos online — CSI y % OFF' },
  { id: 'cuenta dni',      name: 'Cuenta DNI',      group: 'billetera',    description: 'BNA — HTML plano' },
  { id: 'openpay',         name: 'Openpay',         group: 'billetera',    description: 'Posnet BBVA — fetch directo' },
  { id: 'club la nacion',  name: 'Club La Nacion',  group: 'billetera',    description: '575 beneficios — cheerio' },
  { id: 'clarín 365',     name: 'Clarín 365',      group: 'billetera',    description: '835 beneficios — API directa' },
  { id: 'personal pay',   name: 'Personal Pay',    group: 'billetera',    description: '~213 beneficios — API directa' },
  // Tarjetas
  { id: 'visa',            name: 'VISA',            group: 'tarjeta',      description: 'Playwright — tiers Signature/Platinum/Gold/Classic' },
  { id: 'amex',            name: 'AmEx',            group: 'tarjeta',      description: 'Playwright — 7 categorías' },
  { id: 'naranjax',        name: 'Naranja X',       group: 'tarjeta',      description: 'Playwright — anti-Cloudflare' },
  { id: 'cabal',           name: 'Cabal / Credicoop', group: 'tarjeta',    description: 'Playwright — días por clases CSS' },
  { id: 'favacard',        name: 'Favacard',          group: 'tarjeta',    description: 'Tarjeta regional Bs As — ~2800 comercios locales' },
  // Bancos
  { id: 'brubank',         name: 'Brubank',         group: 'banco',        description: 'Webflow — cheerio · 3 planes' },
  { id: 'banco galicia',   name: 'Galicia',         group: 'banco',        description: 'React SPA — intercepción API' },
  { id: 'bbva',            name: 'BBVA',            group: 'banco',        description: 'Next.js — intercepción API' },
  { id: 'banco santander', name: 'Santander',       group: 'banco',        description: 'Playwright — intercepción API' },
  { id: 'banco macro',     name: 'Macro',           group: 'banco',        description: 'Playwright — intercepción API' },
  { id: 'banco nación',    name: 'Nación',          group: 'banco',        description: 'Semana Nación — Playwright' },
  { id: 'banco provincia', name: 'Provincia',       group: 'banco',        description: 'API SearchBeneficio' },
  { id: 'banco ciudad',    name: 'Ciudad',          group: 'banco',        description: 'Playwright — intercepción API' },
  { id: 'banco supervielle', name: 'Supervielle',   group: 'banco',        description: 'Next.js — tiers de cliente' },
  { id: 'banco patagonia', name: 'Patagonia',       group: 'banco',        description: 'Server-rendered — Mastercard' },
  { id: 'icbc',            name: 'ICBC',            group: 'banco',        description: 'Playwright — ignoreHTTPSErrors' },
]

const GRUPO_LABEL: Record<ScraperGroup, string> = {
  supermercado: '🛒 Supermercados',
  billetera:    '📱 Billeteras',
  tarjeta:      '💳 Tarjetas',
  banco:        '🏦 Bancos',
}

const MODO_CATEGORIAS = ['Supermercados', 'Combustible', 'Tecnologia', 'Petshops', 'Gastronomia', 'Transporte', 'Farmacias', 'Indumentaria']

// ─── Main Component ───────────────────────────────────────────
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '1234'

function PinGuard({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('admin_unlocked') === 'true'
  })
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('admin_unlocked', 'true')
      setUnlocked(true)
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 w-full max-w-xs text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} className="text-amber-500" />
        </div>
        <h1 className="text-lg font-black text-slate-800 mb-1">Área restringida</h1>
        <p className="text-xs text-slate-400 mb-6">Ingresá el PIN de administrador</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(false) }}
            placeholder="PIN"
            autoFocus
            className={`w-full text-center text-2xl tracking-[0.5em] font-bold border-2 rounded-2xl px-4 py-3 outline-none transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-amber-400'}`}
          />
          {error && <p className="text-xs text-red-500 font-medium">PIN incorrecto</p>}
          <button type="submit"
            className="w-full bg-slate-900 text-white py-3 rounded-2xl text-sm font-bold">
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}

// Normaliza para busqueda: minusculas + sin acentos (ej. "Pacifico" con tilde -> "pacifico")
function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function AdminPage() {
  const [tab, setTab] = useState<'stats' | 'promos' | 'expired' | 'users' | 'entities' | 'form' | 'cleanup' | 'reports' | 'scheduler' | 'alertas' | 'pending' | 'newsletter'>('stats')
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
  const [scrapingCurrent, setScrapingCurrent] = useState<string>('')
  const [scraperModal, setScraperModal] = useState(false)
  const [triggeringVtex, setTriggeringVtex] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [filterCommerce, setFilterCommerce] = useState('')
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [filterSource, setFilterSource] = useState('')
  const [showLogoSuggestions, setShowLogoSuggestions] = useState(false)
  const [flaggedScrapedPromos, setFlaggedScrapedPromos] = useState<Array<{ title: string; storeName: string; sourceUrl: string; description: string }>>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastUpdatedText, setLastUpdatedText] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [mlOAuthStatus, setMlOAuthStatus] = useState<{ ok: boolean; scope?: string; reason?: string } | null>(null)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const toggleBulkSelect = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const applyBulkCategory = async () => {
    if (!bulkCategory || selectedIds.size === 0) return
    setBulkSaving(true)
    await fetch('/api/admin/promos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), categoryId: bulkCategory })
    })
    setSelectedIds(new Set())
    setBulkMode(false)
    setBulkCategory('')
    setBulkSaving(false)
    // Recargar promos
    const res = await fetch('/api/admin/promos')
    const data = await res.json()
    if (data.promos) setPromos(data.promos)
  }

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
    cardSegmentIds?: string[];
    cardNetworkId?: string;
    cardType?: string;
    bcraCode?: string;
    codigoModo?: string;
    icon?: string;
    color?: string;
    commerceId?: string;
  } | null>(null)

  const [commerceAliases, setCommerceAliases] = useState<any[] | null>(null)
  const [mergingCommerce, setMergingCommerce] = useState<{ id: string; name: string } | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [merging, setMerging] = useState(false)

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/entities')
      if (res.ok) {
        const data = await res.json()
        setEntities(data)
        // Default subtab for entities if none
        if (tab === 'entities' && !subTab) setSubTab('banks')
        // Default subtab for promos categories
        if (tab === 'promos' && !subTab) {
          setSubTab('all')
        }
      }
    } catch (e) {
      console.error('Error fetching entities', e)
    }
  }, [tab]) // Quitamos subTab de aquí para evitar refetches infinitos

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promos', { cache: 'no-store' })
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
    fetch('/api/admin/site-config').then(r => r.json()).then(d => {
      if (d.last_updated) setLastUpdatedText(d.last_updated)
    }).catch(() => {})
    // Leer resultado del callback OAuth de MercadoLibre
    const params = new URLSearchParams(window.location.search)
    const mlOauth = params.get('ml_oauth')
    if (mlOauth === 'ok') {
      setMlOAuthStatus({ ok: true, scope: params.get('scope') || '' })
      window.history.replaceState({}, '', window.location.pathname + (params.get('tab') ? `?tab=${params.get('tab')}` : ''))
    } else if (mlOauth === 'error') {
      setMlOAuthStatus({ ok: false, reason: params.get('reason') || params.get('status') || 'desconocido' })
      window.history.replaceState({}, '', window.location.pathname + (params.get('tab') ? `?tab=${params.get('tab')}` : ''))
    }
  }, [fetchEntities, fetchPromos, fetchUsers])

  const fetchCommerceAliases = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/commerce-aliases')
      if (res.ok) {
        const data = await res.json()
        setCommerceAliases(data.aliases)
      }
    } catch (e) {
      console.error('Error fetching commerce aliases', e)
    }
  }, [])

  useEffect(() => {
    if (tab === 'entities' && subTab === 'aliases') fetchCommerceAliases()
  }, [tab, subTab, fetchCommerceAliases])

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
    const cardSegmentIds = newReq.cardSegmentIds?.length ? newReq.cardSegmentIds : ['']
    const cardTypeIds = newReq.cardTypeIds?.length ? newReq.cardTypeIds : [newReq.cardType || 'ANY']
    const paymentChannelIds = newReq.paymentChannelIds?.length ? newReq.paymentChannelIds : [newReq.paymentChannel || 'ANY']
    const accountTypeIds = newReq.accountTypeIds?.length ? newReq.accountTypeIds : [newReq.accountType || 'ANY']

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
                cardSegmentIds.forEach(csid => {
                  if (bankIds.length > 1 || !segmentIds.length) {
                    newGeneratedReqs.push({
                      ...finalNewReq,
                      bankId: bid || undefined,
                      walletId: wid || undefined,
                      cardNetworkId: nid || undefined,
                      cardType: ctid !== 'ANY' ? ctid : undefined,
                      paymentChannel: pcid,
                      accountType: atid !== 'ANY' ? atid : undefined,
                      segmentId: undefined,
                      cardSegmentId: csid || undefined,
                    })
                  } else {
                    segmentIds.forEach(sid => {
                      newGeneratedReqs.push({
                        ...finalNewReq,
                        bankId: bid || undefined,
                        walletId: wid || undefined,
                        cardNetworkId: nid || undefined,
                        cardType: ctid !== 'ANY' ? ctid : undefined,
                        paymentChannel: pcid,
                        accountType: atid !== 'ANY' ? atid : undefined,
                        segmentId: sid || undefined,
                        cardSegmentId: csid || undefined,
                      })
                    })
                  }
                })
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
      cardSegmentIds: [],
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
    await handleScrapeQueue([{ id: scraper ?? '', categoria }])
  }

  async function handleScrapeQueue(queue: Array<{ id: string; categoria?: string }>) {
    setScraping(true)
    setScraperModal(false)
    setError('')
    setSuccess('')
    setFlaggedScrapedPromos([])
    let totalFound = 0, totalProcessed = 0, errors = 0, triggered = 0
    for (const item of queue) {
      const name = SCRAPERS_CONFIG.find(s => s.id === item.id)?.name ?? item.id
      setScrapingCurrent(name)
      const isPlaywright = PLAYWRIGHT_SCRAPER_IDS.has(item.id.toLowerCase())
      try {
        if (isPlaywright) {
          // Scrapers Playwright no pueden correr en Vercel → disparar GitHub Actions
          const res = await fetch('/api/admin/trigger-scraper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scraperId: item.id }),
          })
          if (res.ok) triggered++
          else { errors++; console.error(`[${name}] Error al disparar GitHub Actions`) }
        } else {
          const res = await fetch('/api/admin/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scraper: item.id, categoria: item.categoria })
          })
          const data = await res.json()
          if (res.ok) {
            totalFound += data.totalFound ?? 0
            totalProcessed += data.processed ?? 0
            if (data.flagged?.length) {
              setFlaggedScrapedPromos(prev => [...prev, ...data.flagged])
            }
          } else {
            errors++
            console.error(`[${name}] ${data.error}`)
          }
        }
      } catch {
        errors++
        console.error(`[${name}] Error de conexión`)
      }
    }
    setScraping(false)
    setScrapingCurrent('')
    fetchPromos()
    const parts = []
    if (totalFound > 0 || totalProcessed > 0) parts.push(`Leídas: ${totalFound} | Procesadas: ${totalProcessed}`)
    if (triggered > 0) parts.push(`${triggered} workflow${triggered !== 1 ? 's' : ''} disparado${triggered !== 1 ? 's' : ''} en GitHub`)
    if (errors === 0) {
      setSuccess(`🤖 Scraping finalizado (${queue.length} fuente${queue.length !== 1 ? 's' : ''}). ${parts.join(' · ')}`)
    } else {
      setSuccess(`🤖 Finalizado con ${errors} error${errors !== 1 ? 'es' : ''}. ${parts.join(' · ')}`)
    }
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
      if (editingEntity.type === 'cardSegment') url = '/api/admin/card-segments'
      if (editingEntity.type === 'commerceAlias') url = '/api/admin/commerce-aliases'

      // Para categorías, mapear el campo code → order
      let payload: any = editingEntity.type === 'category'
        ? { ...editingEntity, order: Number(editingEntity.code ?? 99) }
        : editingEntity
      if (editingEntity.type === 'commerceAlias') {
        payload = { alias: editingEntity.name, commerceId: editingEntity.commerceId }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setSuccess('✅ Entidad guardada')
        setEditingEntity(null)
        if (editingEntity.type === 'commerceAlias') fetchCommerceAliases()
        else fetchEntities()
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
      if (type === 'cardSegment') url = `/api/admin/card-segments?id=${id}`
      if (type === 'commerceAlias') url = `/api/admin/commerce-aliases?id=${id}`

      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        setSuccess('✅ Eliminado correctamente')
        if (type === 'commerceAlias') fetchCommerceAliases()
        else fetchEntities()
      } else {
        setError('No se pudo eliminar')
      }
    } catch {
      setError('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  async function handleMergeCommerce() {
    if (!mergingCommerce || !mergeTargetId) return
    setMerging(true)
    try {
      const res = await fetch('/api/admin/commerce-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: mergingCommerce.id, targetId: mergeTargetId })
      })
      const d = await res.json()
      if (res.ok) {
        setSuccess(`✅ Fusionado: ${d.promosMoved} promos, ${d.branchesMoved} sucursales movidas`)
        setMergingCommerce(null)
        setMergeTargetId('')
        fetchEntities()
      } else {
        setError(d.error || 'Error al fusionar')
      }
    } catch {
      setError('Error al fusionar comercios')
    } finally {
      setMerging(false)
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
    if (r.cardNetworkId && entities) {
      const networkName = entities.cardNetworks.find(c => c.id === r.cardNetworkId)?.name ?? r.cardNetworkId
      const typeSuffix = r.cardType === 'CREDIT' ? ' Crédito' : r.cardType === 'DEBIT' ? ' Débito' : r.cardType === 'PREPAID' ? ' Prepaga' : ''
      parts.push(`${networkName}${typeSuffix}`)
    } else if (r.cardType) {
      parts.push(CARD_TYPES.find(c => c.value === r.cardType)?.label ?? r.cardType)
    }
    if (r.paymentChannel && r.paymentChannel !== 'ANY') parts.push(PAYMENT_CHANNELS.find(c => c.value === r.paymentChannel)?.label ?? r.paymentChannel)
    if (r.accountType && r.accountType !== 'ANY') parts.push(ACCOUNT_TYPES.find(c => c.value === r.accountType)?.label ?? r.accountType)
    if (r.segmentId && entities) {
      const s = entities.segments.find(x => x.id === r.segmentId)
      if (s) parts.push(`Seg: ${s.name}`)
    }
    if (r.cardSegmentId && entities) {
      const cs = entities.cardSegments?.find(x => x.id === r.cardSegmentId)
      if (cs) parts.push(`${cs.cardNetwork.name} ${cs.cardType === 'CREDIT' ? 'Créd' : cs.cardType === 'DEBIT' ? 'Déb' : 'Prep'} · ${cs.name}`)
    }
    if (r.minPurchase) parts.push(`Mín: $${r.minPurchase}`)
    if (r.note) parts.push(`(${r.note})`)
    return parts.join(' · ') || 'Cualquier medio'
  }

  return (
    <PinGuard>
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
          <a
            href="/api/admin/export"
            download
            className="flex items-center gap-2 text-xs px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all"
          >
            ↓ Exportar CSV
          </a>
          <button
            onClick={() => setScraperModal(true)}
            disabled={scraping}
            className="flex items-center gap-2 text-xs px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <Bot size={15} />
            {scraping ? `Ejecutando${scrapingCurrent ? `: ${scrapingCurrent}` : '...'}` : 'Auto-Sync Scraper'}
          </button>
          <button
            onClick={async () => {
              setTriggeringVtex(true)
              try {
                const res = await fetch('/api/admin/trigger-vtex-refresh', { method: 'POST' })
                const data = await res.json()
                if (res.ok) setSuccess('🤖 Workflow Cencosud disparado en GitHub Actions')
                else setError('Error: ' + (data.error ?? res.status))
              } catch { setError('Error al disparar el workflow') }
              finally { setTriggeringVtex(false) }
            }}
            disabled={triggeringVtex}
            className="flex items-center gap-2 text-xs px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={triggeringVtex ? 'animate-spin' : ''} />
            {triggeringVtex ? 'Disparando...' : 'Refresh Cencosud'}
          </button>
          <div className="h-8 w-[1px] bg-slate-100 mx-2" />
          <button onClick={startNew} className="p-2.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors">
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* ── Main Nav ── */}
      <nav className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 shadow-sm">
        <TabButton active={tab === 'stats' || tab === 'promos'} icon={TrendingUp} onClick={() => setTab('stats')}>
          Estadísticas y Promos
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
        <TabButton active={tab === 'cleanup'} icon={Trash2} onClick={() => setTab('cleanup')}>
          Limpieza
        </TabButton>
        <TabButton active={tab === 'reports'} icon={Tag} onClick={() => setTab('reports')}>
          Reportes
        </TabButton>
        <TabButton active={tab === 'scheduler'} icon={CalendarClock} onClick={() => setTab('scheduler')}>
          Scrapers
        </TabButton>
        <TabButton active={tab === 'alertas'} icon={Bell} onClick={() => setTab('alertas')}>
          Alertas
        </TabButton>
        <TabButton active={tab === 'pending'} icon={ClipboardList} onClick={() => setTab('pending')}>
          Pendientes
        </TabButton>
        <TabButton active={tab === 'newsletter'} icon={Mail} onClick={() => setTab('newsletter')}>
          Newsletter
        </TabButton>
        {tab === 'form' && (
          <TabButton active={true} icon={Pencil} onClick={() => { }}>
            {editingId ? 'Editando Promo' : 'Nueva Promo'}
          </TabButton>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* ── STATS / PROMOS TAB ── */}
        {(tab === 'stats' || tab === 'promos') && (
          <div className="flex gap-2 bg-slate-100 rounded-2xl p-1 w-fit">
            <button
              onClick={() => setTab('stats')}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${tab === 'stats' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Estadísticas
            </button>
            <button
              onClick={() => { setTab('promos'); setSubTab('all') }}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${tab === 'promos' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Promociones
            </button>
          </div>
        )}
        {tab === 'stats' && (
          <>
            <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Última actualización de promos</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lastUpdatedText}
                  onChange={e => setLastUpdatedText(e.target.value)}
                  placeholder="ej: Actualizado hoy 10:00hs"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <button
                  onClick={async () => {
                    setSavingConfig(true)
                    await fetch('/api/admin/site-config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ last_updated: lastUpdatedText }),
                    })
                    setSavingConfig(false)
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  {savingConfig ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Se muestra en el cartel azul de la pantalla principal.</p>
            </div>

            {/* MercadoLibre OAuth */}
            <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MercadoLibre — Autorización API</p>
              {mlOAuthStatus && (
                <div className={`mb-3 text-sm rounded-xl px-3 py-2 font-medium ${mlOAuthStatus.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {mlOAuthStatus.ok
                    ? `✅ Autorizado correctamente. Scope: ${mlOAuthStatus.scope || '(no informado)'}`
                    : `❌ Error en la autorización: ${mlOAuthStatus.reason}`}
                </div>
              )}
              <p className="text-xs text-gray-500 mb-3">
                Genera un refresh_token con scope <code className="bg-gray-100 px-1 rounded">read offline_access</code> y lo guarda en la DB.
                Configurá <code className="bg-gray-100 px-1 rounded">https://promoar.com.ar/api/ml-oauth/callback</code> como redirect URI en el DevCenter de ML.
              </p>
              <a
                href="/api/ml-oauth/start"
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold rounded-xl transition-colors"
              >
                🔑 Autorizar con MercadoLibre
              </a>
              <p className="text-[11px] text-gray-400 mt-1.5">Al autorizar, ML redirige al callback que guarda el token automáticamente.</p>
            </div>

            <StatsView />
          </>
        )}
        {tab === 'scheduler' && <ScraperSchedulerTab />}

        {/* ══════════ TAB ALERTAS ══════════ */}
        {tab === 'alertas' && <NotifPrefsTab />}
        {tab === 'pending' && <PendingPromosTab />}

        {tab === 'newsletter' && <NewsletterTab />}

        {/* Alerts */}
        {(success || error) && (
          <div className="animate-in slide-in-from-top-4 duration-300">
            {success && <Alert type="success" onClear={() => setSuccess('')}>{success}</Alert>}
            {error && <Alert type="error" onClear={() => setError('')}>{error}</Alert>}
          </div>
        )}

        {/* Promos flaggeadas para revisión manual */}
        {flaggedScrapedPromos.length > 0 && (
          <div className="mx-4 mb-4 rounded-xl border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-600 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-300 text-sm">
                ⚠️ {flaggedScrapedPromos.length} promo{flaggedScrapedPromos.length !== 1 ? 's' : ''} con título de descuento pero sin % detectado — revisar manualmente
              </h3>
              <button onClick={() => setFlaggedScrapedPromos([])} className="text-yellow-600 dark:text-yellow-400 text-xs hover:underline">Cerrar</button>
            </div>
            <div className="space-y-2">
              {flaggedScrapedPromos.map((p, i) => (
                <div key={i} className="rounded-lg bg-white dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3">
                  <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{p.storeName} — {p.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</div>
                  {p.sourceUrl && (
                    <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
                      Ver legales →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROMOS TAB (CATEGORIZED) ── */}
        {tab === 'promos' && (() => {
          const isSearching = filterText.length >= 3
          const toggleCat = (id: string) => {
            setFilterCategories(prev =>
              prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 3 ? [...prev, id] : prev
            )
          }
          const filteredPromos = promos.filter(p => {
            if (p.status === 'EXPIRED') return false
            if (isSearching) {
              if (filterCategories.length > 0 && !filterCategories.includes(p.categoryId)) return false
            } else {
              if (p.categoryId !== subTab) return false
            }
            if (filterCommerce && p.commerce?.name !== filterCommerce) return false
            if (filterSource && !(p.sourceUrl || '').includes(filterSource)) return false
            if (isSearching) {
              const q = normalizeSearch(filterText)
              return normalizeSearch(p.title).includes(q) || (p.commerce?.name ? normalizeSearch(p.commerce.name).includes(q) : false)
            }
            return true
          })
          return (
          <div className="space-y-4">
            {/* Tabs de categoría (modo browse) */}
            <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
              {entities?.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setSubTab(cat.id); setFilterText(''); setFilterCommerce(''); setFilterCategories([]) }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === cat.id && !isSearching ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Buscador global */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar en todas las promos (mín. 3 letras)..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
              <select
                value={filterCommerce}
                onChange={e => setFilterCommerce(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              >
                <option value="">Todos los comercios</option>
                {Array.from(new Set(filteredPromos.map(p => p.commerce?.name).filter(Boolean))).sort().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              >
                <option value="">Todas las fuentes</option>
                {[...SOURCE_LABELS].sort((a, b) => a.label.localeCompare(b.label, 'es')).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {(filterText || filterCommerce || filterCategories.length > 0 || filterSource) && (
                <button onClick={() => { setFilterText(''); setFilterCommerce(''); setFilterCategories([]); setFilterSource('') }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                  <X size={12} /> Limpiar
                </button>
              )}
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full ml-auto">
                {isSearching ? `${filteredPromos.length} resultados` : `${filteredPromos.length} PROMOS`}
              </span>
              <button
                onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${bulkMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {bulkMode ? `✓ ${selectedIds.size} sel.` : 'Categorizar'}
              </button>
              {bulkMode && (
                <button
                  onClick={() => {
                    if (selectedIds.size === filteredPromos.length) {
                      setSelectedIds(new Set())
                    } else {
                      setSelectedIds(new Set(filteredPromos.map(p => p.id)))
                    }
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  {selectedIds.size === filteredPromos.length ? 'Ninguno' : 'Todos'}
                </button>
              )}
            </div>

            {/* Chips de categoría (solo en modo búsqueda) */}
            {isSearching && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Filtrar por cat (máx 3):</span>
                {entities?.categories.map(cat => {
                  const selected = filterCategories.includes(cat.id)
                  const disabled = !selected && filterCategories.length >= 3
                  return (
                    <button
                      key={cat.id}
                      onClick={() => !disabled && toggleCat(cat.id)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all border ${
                        selected ? 'bg-indigo-600 text-white border-indigo-600' :
                        disabled ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' :
                        'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            )}


            {/* Mensaje cuando no hay texto de búsqueda */}
            {isSearching && filteredPromos.length === 0 && !loading && (
              <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
                <Search className="mx-auto text-slate-200 mb-3" size={40} />
                <p className="text-slate-400 font-medium">Sin resultados para "{filterText}"</p>
              </div>
            )}
            {!isSearching && filteredPromos.length === 0 && !loading && (
              <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
                <Tag className="mx-auto text-slate-200 mb-3" size={40} />
                <p className="text-slate-400 font-medium">No hay promos en esta categoría</p>
              </div>
            )}

            {/* Grilla — en modo browse siempre, en modo search solo con 3+ chars */}
            {(!isSearching || filterText.length >= 3) && (
              bulkMode ? (
                /* Vista compacta de líneas para categorización bulk */
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  {filteredPromos.map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => toggleBulkSelect(p.id)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${selectedIds.has(p.id) ? 'bg-indigo-50' : 'hover:bg-slate-100'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedIds.has(p.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                        {selectedIds.has(p.id) && <Check size={11} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{p.commerce?.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.title}</p>
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 shrink-0">{discountLabel(p.requirements.reduce((max, r) => (r.discountValue ?? 0) > (max.discountValue ?? 0) ? r : max, p.requirements[0] ?? {}))}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: p.category?.color + '20', color: p.category?.color }}>{p.category?.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading && <Loader message="Cargando promociones..." />}
                {filteredPromos.map(p => (
                  <div key={p.id} className="relative">
                  <PromoCard
                    key={p.id}
                    promo={p}
                    onEdit={() => startEdit(p)}
                    onDelete={() => setDeleteConfirm(p.id)}
                    isDeleting={deleteConfirm === p.id}
                    onCancelDelete={() => setDeleteConfirm(null)}
                    confirmDelete={() => handleDelete(p.id)}
                    onToggleFeatured={async () => {
                      const res = await fetch('/api/admin/promos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, isFeatured: !p.isFeatured }) })
                      if (res.ok) fetchPromos()
                    }}
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
                  </div>
                ))}
              </div>
              )
            )}

            {/* Barra flotante de categorización bulk */}
            {bulkMode && selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
                <span className="text-sm font-bold">{selectedIds.size} promos</span>
                <select
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value)}
                  className="text-sm bg-slate-800 border border-slate-600 rounded-xl px-3 py-1.5 text-white focus:outline-none"
                >
                  <option value="">Elegir categoría...</option>
                  {entities?.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button
                  onClick={applyBulkCategory}
                  disabled={!bulkCategory || bulkSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-1.5 rounded-xl transition-all"
                >
                  {bulkSaving ? 'Guardando...' : 'Aplicar'}
                </button>
                <button onClick={() => { setBulkMode(false); setSelectedIds(new Set()) }} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          )
        })()}

        {tab === 'cleanup' && (
          <div className="max-w-xl space-y-6">
            <ClassifyButton />
            <CleanupTab commerces={entities?.commerces ?? []} />
          </div>
        )}

        {tab === 'reports' && (
          <div className="max-w-2xl mx-auto py-10 px-4 space-y-4">
            <h2 className="text-xl font-black text-slate-900 mb-6">Reportes CSV</h2>
            {[
              { type: 'sin-categoria', label: 'Promos sin categoría', desc: 'Todas las promos activas sin categoría asignada' },
              { type: 'por-scraper',   label: 'Promos por scraper',   desc: 'Total de promos y comercios por banco/billetera' },
              { type: 'sin-logo',      label: 'Comercios sin logo',   desc: 'Comercios activos sin imagen cargada' },
              { type: 'vencidas',      label: 'Promos vencidas',      desc: 'Últimas 500 promos expiradas' },
              { type: 'por-categoria', label: 'Promos por categoría', desc: 'Distribución de promos activas por categoría' },
              { type: 'duplicadas',    label: 'Posibles duplicados',  desc: 'Promos con mismo título en el mismo comercio' },
            ].map(r => (
              <div key={r.type} className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{r.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                </div>
                <a
                  href={`/api/admin/reports?type=${r.type}`}
                  download
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors shrink-0 ml-4"
                >
                  ↓ CSV
                </a>
              </div>
            ))}
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm">
              <p className="font-bold text-slate-900 text-sm mb-1">Promos por scraper</p>
              <p className="text-xs text-slate-400 mb-3">Detalle completo de promos activas de una entidad</p>
              <div className="flex gap-2">
                <select
                  id="report-banco-select"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {[
                    'Banco Nación', 'Banco Galicia', 'BBVA', 'Banco Santander',
                    'Banco Macro', 'Banco Ciudad', 'Banco Supervielle', 'Banco Patagonia',
                    'Banco Credicoop', 'ICBC', 'Banco Provincia',
                    'Carrefour Banco', 'MODO', 'Mercado Pago', 'Cuenta DNI',
                    'Visa', 'Mastercard', 'American Express', 'Naranja X', 'Cabal', 'Favacard',
                  ].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <button
                  onClick={() => {
                    const val = (document.getElementById('report-banco-select') as HTMLSelectElement)?.value
                    if (val) window.location.href = `/api/admin/reports?type=por-banco&banco=${encodeURIComponent(val)}`
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors shrink-0"
                >
                  ↓ CSV
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Fechas y vencimientos</p>
            </div>

            {/* Vencen en 24hs / 48hs */}
            {[
              { horas: 24, label: 'Vencen en 24 hs', desc: 'Promos activas que expiran en las próximas 24 horas' },
              { horas: 48, label: 'Vencen en 48 hs', desc: 'Promos activas que expiran en las próximas 48 horas' },
            ].map(r => (
              <div key={r.horas} className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{r.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                </div>
                <a
                  href={`/api/admin/reports?type=por-vencer&horas=${r.horas}`}
                  download
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-black hover:bg-orange-600 transition-colors shrink-0 ml-4"
                >
                  ↓ CSV
                </a>
              </div>
            ))}

            {/* Próximas promos */}
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="font-bold text-slate-900 text-sm">Próximas promos</p>
                <p className="text-xs text-slate-400 mt-0.5">Promos scrapeadas con fecha de inicio futura</p>
              </div>
              <a
                href="/api/admin/reports?type=proximas"
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors shrink-0 ml-4"
              >
                ↓ CSV
              </a>
            </div>

            {/* Por rango de fechas */}
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm">
              <p className="font-bold text-slate-900 text-sm mb-1">Promos entre fechas</p>
              <p className="text-xs text-slate-400 mb-3">Promos activas con validFrom ≥ desde y validUntil ≤ hasta</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  id="report-desde"
                  type="date"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  id="report-hasta"
                  type="date"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={() => {
                    const desde = (document.getElementById('report-desde') as HTMLInputElement)?.value
                    const hasta = (document.getElementById('report-hasta') as HTMLInputElement)?.value
                    if (desde && hasta) window.location.href = `/api/admin/reports?type=por-fechas&desde=${desde}&hasta=${hasta}`
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors shrink-0"
                >
                  ↓ CSV
                </button>
              </div>
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
                <input type="text" placeholder="Buscar por email..." className="pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-100 placeholder:font-normal placeholder:text-slate-400" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Rol</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Perfil</th>
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
                      <td className="px-6 py-4">
                        {u.financialProfile ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                            <Check size={10} /> Completo
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-semibold">Sin perfil</span>
                        )}
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
              <EntitySubTab active={subTab === 'categories'} icon={Tag} onClick={() => setSubTab('categories')}>Categorías</EntitySubTab>
              <EntitySubTab active={subTab === 'banks'} icon={Building2} onClick={() => setSubTab('banks')}>Bancos / Entidades</EntitySubTab>
              <EntitySubTab active={subTab === 'wallets'} icon={WalletIcon} onClick={() => setSubTab('wallets')}>Billeteras</EntitySubTab>
              <EntitySubTab active={subTab === 'segments'} icon={Layers} onClick={() => setSubTab('segments')}>Segmentos</EntitySubTab>
              <EntitySubTab active={subTab === 'networks'} icon={CreditCard} onClick={() => setSubTab('networks')}>Marcas de Tarjeta</EntitySubTab>
              <EntitySubTab active={subTab === 'cardSegments'} icon={CreditCard} onClick={() => setSubTab('cardSegments')}>Segmentos de Tarjeta</EntitySubTab>
              <EntitySubTab active={subTab === 'currencies'} icon={DollarSign} onClick={() => setSubTab('currencies')}>Monedas</EntitySubTab>
              <EntitySubTab active={subTab === 'accountTypes'} icon={WalletIcon} onClick={() => setSubTab('accountTypes')}>Tipos de Cuenta</EntitySubTab>
              <EntitySubTab active={subTab === 'commerces'} icon={Tag} onClick={() => setSubTab('commerces')}>Comercios</EntitySubTab>
              <EntitySubTab active={subTab === 'aliases'} icon={Link2} onClick={() => setSubTab('aliases')}>Alias</EntitySubTab>
            </div>

            {/* Content Area */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {subTab === 'categories' && 'Categorías de Promos'}
                  {subTab === 'banks' && 'Gestión de Bancos'}
                  {subTab === 'wallets' && 'Billeteras Digitales'}
                  {subTab === 'segments' && 'Segmentos Bancarios'}
                  {subTab === 'networks' && 'Marcas de Tarjeta'}
                  {subTab === 'cardSegments' && 'Segmentos de Tarjeta (Visa Crédito Gold, etc.)'}
                  {subTab === 'currencies' && 'Monedas del Sistema'}
                  {subTab === 'accountTypes' && 'Tipos de Cuenta Admitidos'}
                  {subTab === 'commerces' && 'Base de Comercios'}
                  {subTab === 'aliases' && 'Alias de Comercios (normalización)'}
                </h2>
                <button
                  onClick={() => {
                    const typeMap: Record<string, string> = {
                      categories: 'category',
                      banks: 'bank',
                      wallets: 'wallet',
                      segments: 'segment',
                      networks: 'cardNetwork',
                      cardSegments: 'cardSegment',
                      currencies: 'currency',
                      accountTypes: 'accountType',
                      commerces: 'commerce',
                      aliases: 'commerceAlias',
                    }
                    setEditingEntity({ type: typeMap[subTab] || subTab, name: '', logoUrl: '', cardNetworkIds: [], cardNetworkId: '', cardType: '', commerceId: '' })
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
                >
                  <Plus size={12} /> AGREGAR
                </button>
                {subTab === 'commerces' && (
                  <button
                    onClick={() => setShowLogoSuggestions(true)}
                    className="flex items-center gap-1.5 text-[10px] font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-all"
                  >
                    <Bot size={12} /> Completar logos
                  </button>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm min-h-[200px]">
                <div className="divide-y divide-slate-100">
                  {!entities && <Loader message="Cargando entidades..." />}

                  {entities && subTab === 'categories' && (entities.categories?.length === 0 ? <EmptyState msg="No hay categorías cargadas" /> : entities.categories.map(c => (
                    <EntityRow
                      key={c.id}
                      name={c.name}
                      onEdit={() => setEditingEntity({ type: 'category', ...c, code: String((c as any).order ?? 0) })}
                      onDelete={() => handleDeleteEntity('category', c.id)}
                      badge={`${(c as any).icon ?? ''} orden ${(c as any).order ?? 0}`}
                    />
                  )))}

                  {entities && subTab === 'wallets' && (entities.wallets?.length === 0 ? <EmptyState msg="No hay billeteras cargadas" /> : entities.wallets.map(w => (
                    <EntityRow
                      key={w.id}
                      name={w.name}
                      img={w.logoUrl}
                      onEdit={() => setEditingEntity({ type: 'wallet', ...w, cardNetworkIds: w.cardNetworks?.map((n: any) => n.id) || [], cardSegmentIds: w.cardSegments?.map((s: any) => s.id) || [] })}
                      onDelete={() => handleDeleteEntity('wallet', w.id)}
                      badge={`${w.cardNetworks?.length || 0} redes · ${w.cardSegments?.length || 0} tarjetas`}
                    />
                  )))}

                  {entities && subTab === 'banks' && (entities.banks?.length === 0 ? <EmptyState msg="No hay bancos cargados" /> : entities.banks.map(b => (
                    <EntityRow
                      key={b.id}
                      name={b.name}
                      img={b.logoUrl}
                      onEdit={() => setEditingEntity({ 
                        type: 'bank', 
                        ...b, 
                        cardNetworkIds: b.cardNetworks.map(n => n.id),
                        cardSegmentIds: b.cardSegments?.map(cs => cs.id) || [],
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

                  {entities && subTab === 'cardSegments' && (entities.cardSegments?.length === 0 ? <EmptyState msg="No hay segmentos de tarjeta configurados" /> : (entities.cardSegments || []).map(cs => (
                    <EntityRow
                      key={cs.id}
                      name={`${cs.cardNetwork.name} ${cs.cardType === 'CREDIT' ? 'Crédito' : cs.cardType === 'DEBIT' ? 'Débito' : 'Prepaga'} ${cs.name}`}
                      onEdit={() => setEditingEntity({ type: 'cardSegment', ...cs, cardNetworkId: cs.cardNetworkId, cardType: cs.cardType })}
                      onDelete={() => handleDeleteEntity('cardSegment', cs.id)}
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

                  {entities && subTab === 'commerces' && (entities.commerces?.length === 0 ? <EmptyState msg="No hay comercios cargados" /> : entities.commerces.map((c: any) => (
                    <EntityRow key={c.id} name={c.name} img={c.logoUrl}
                      badge={c.activePromos > 0 ? `${c.activePromos} promos` : undefined}
                      onEdit={() => setEditingEntity({ type: 'commerce', id: c.id, name: c.name, logoUrl: c.logoUrl })}
                      onDelete={() => handleDeleteEntity('commerce', c.id)}
                      onMerge={() => { setMergingCommerce({ id: c.id, name: c.name }); setMergeTargetId('') }} />
                  )))}

                  {subTab === 'aliases' && (!commerceAliases ? <Loader message="Cargando alias..." /> : commerceAliases.length === 0 ? <EmptyState msg="No hay alias configurados" /> : commerceAliases.map((a: any) => (
                    <EntityRow key={a.id} name={`${a.alias} → ${a.commerce?.name ?? '???'}`} img={a.commerce?.logoUrl}
                      onDelete={() => handleDeleteEntity('commerceAlias', a.id)}
                      hideEdit />
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
                        <Field label="Segmento de Tarjeta">
                          <MultiSelect
                            placeholder="Todos"
                            options={(entities?.cardSegments || [])
                              .filter(cs => !newReq.cardNetworkIds?.length || newReq.cardNetworkIds.includes(cs.cardNetworkId))
                              .filter(cs => !newReq.cardTypeIds?.length || newReq.cardTypeIds.includes(cs.cardType))
                              .map(cs => ({ id: cs.id, name: `${cs.cardNetwork.name} ${cs.cardType === 'CREDIT' ? 'Créd' : cs.cardType === 'DEBIT' ? 'Déb' : 'Prep'} · ${cs.name}` }))}
                            selected={newReq.cardSegmentIds || []}
                            onChange={ids => setNewReq(r => ({ ...r, cardSegmentIds: ids }))}
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
          onRunQueue={handleScrapeQueue}
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

      {/* Modal de sugerencias de logos */}
      {showLogoSuggestions && (
        <LogoSuggestionsModal
          onClose={() => setShowLogoSuggestions(false)}
          onSaved={() => { setShowLogoSuggestions(false); fetchEntities() }}
        />
      )}

      {/* Modal de fusión de comercios */}
      {mergingCommerce && (
        <MergeCommerceModal
          source={mergingCommerce}
          commerces={entities?.commerces ?? []}
          targetId={mergeTargetId}
          setTargetId={setMergeTargetId}
          onConfirm={handleMergeCommerce}
          onCancel={() => { setMergingCommerce(null); setMergeTargetId('') }}
          merging={merging}
        />
      )}
    </div>
    </PinGuard>
  )
}

// ─── LogoSuggestionsModal ───────────────────────────────────────────────

type CommerceNoLogo = { id: string; name: string; slug: string; website?: string | null }

function LogoSuggestionsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [commerces, setCommerces] = useState<CommerceNoLogo[]>([])
  const [loading, setLoading] = useState(true)
  const [inputs, setInputs] = useState<Record<string, string>>({}) // id → url/dominio ingresado
  const [previews, setPreviews] = useState<Record<string, string>>({}) // id → url del logo a mostrar
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/admin/logo-suggestions')
      .then(r => r.json())
      .then(data => setCommerces(data.commerces || []))
      .finally(() => setLoading(false))
  }, [])

  function buildLogoUrl(value: string): string {
    const v = value.trim()
    if (!v) return ''
    if (v.startsWith('http')) return v
    const domain = v.replace(/^www\./, '')
    return `https://logo.clearbit.com/${domain}`
  }

  function handleInput(id: string, value: string) {
    setInputs(prev => ({ ...prev, [id]: value }))
    const url = buildLogoUrl(value)
    if (url) setPreviews(prev => ({ ...prev, [id]: url }))
    else setPreviews(prev => { const n = {...prev}; delete n[id]; return n })
  }

  async function handleSave() {
    setSaving(true)
    // Guardar usando el input como fuente de verdad (no el preview)
    const updates = Object.entries(inputs)
      .filter(([, v]) => v.trim())
      .map(([id, v]) => ({ id, logoUrl: buildLogoUrl(v) }))

    const res = await fetch('/api/admin/logo-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    if (res.ok) onSaved()
    else setSaving(false)
  }

  const filtered = commerces.filter(c => !filter || normalizeSearch(c.name).includes(normalizeSearch(filter)))
  const readyCount = Object.values(inputs).filter(v => v.trim()).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">Completar logos faltantes</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{commerces.length} comercios sin logo — pegá el dominio o URL del logo y guardá</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar comercio..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-10">No hay comercios sin logo con promos activas</p>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                {/* Preview logo */}
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                  {previews[c.id] ? (
                    <img src={previews[c.id]} alt={c.name} className="max-w-full max-h-full object-contain p-1" />
                  ) : (
                    <span className="text-xl">🏷️</span>
                  )}
                </div>
                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                  {c.website && <p className="text-[10px] text-slate-400 truncate">{c.website}</p>}
                </div>
                {/* Input */}
                <input
                  type="text"
                  placeholder="dominio.com.ar o URL del logo"
                  value={inputs[c.id] || ''}
                  onChange={e => handleInput(c.id, e.target.value)}
                  className="text-[11px] border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 w-56"
                />
              </div>
            ))
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">{readyCount} logos listos para guardar</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || readyCount === 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Guardando...' : `Guardar ${readyCount} logos`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ScraperSchedulerTab ───────────────────────────────────────────────

type ScheduleRow = {
  scraperId: string
  frequency: string
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  hour: number
  active: boolean
  nextRunAt?: string | null
  runs?: { status: string; startedAt: string; found?: number | null; processed?: number | null; message?: string | null }[]
}

const FREQ_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
]

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const PLAYWRIGHT_SCRAPER_IDS = new Set([
  'amex', 'cabal', 'changomas', 'banco galicia', 'icbc',
  'banco macro', 'naranjax', 'banco santander',
  'banco supervielle', 'banco ciudad', 'visa',
  'jumbo', 'disco', 'vea', 'banco patagonia',
])

function ScraperSchedulerTab() {
  const [scraperSubTab, setScraperSubTab] = useState<'gh' | 'local'>('gh')
  const [schedules, setSchedules] = useState<Record<string, ScheduleRow>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [flagged, setFlagged] = useState<Array<{ title: string; storeName: string; sourceUrl: string; description: string }>>([])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/scraper-schedules')
    if (res.ok) {
      const data = await res.json()
      const map: Record<string, ScheduleRow> = {}
      for (const s of data.schedules) map[s.scraperId] = s
      // Rellenar scrapers sin schedule configurado
      for (const s of SCRAPERS_CONFIG) {
        if (!map[s.id]) map[s.id] = { scraperId: s.id, frequency: 'manual', hour: 6, active: true, runs: [] }
      }
      setSchedules(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save(scraperId: string) {
    const s = schedules[scraperId]
    if (!s) return
    setSaving(scraperId)
    const res = await fetch('/api/admin/scraper-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    if (res.ok) setMsg({ type: 'success', text: `${scraperId} guardado` })
    else setMsg({ type: 'error', text: 'Error al guardar' })
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  async function runNow(scraperId: string, local = false) {
    setRunning(scraperId)
    const isPlaywright = PLAYWRIGHT_SCRAPER_IDS.has(scraperId.toLowerCase())
    const useGh = isPlaywright && !local
    const endpoint = useGh ? '/api/admin/trigger-scraper' : '/api/admin/run-scraper'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scraperId, ...(local && { forceLocal: true }) }),
    })
    if (res.ok) {
      if (useGh) {
        setMsg({ type: 'success', text: `${scraperId}: workflow disparado en GitHub Actions` })
      } else {
        const data = await res.json()
        const found = data.totalFound ?? data.found ?? 0
        const processed = data.processed ?? 0
        const skipped = data.skippedUnchanged ?? 0
        if (data.flagged?.length) setFlagged(data.flagged)
        const label = SCRAPERS_CONFIG.find(s => s.id === scraperId)?.name ?? scraperId
        const detail = `${found} leídas · ${processed} guardadas · ${skipped} sin cambios`
        setMsg({ type: 'success', text: `✅ ${label}: ${detail}` })
      }
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg({ type: 'error', text: `❌ ${scraperId}: ${data.error ?? 'Error desconocido'}` })
    }
    setRunning(null)
    setTimeout(() => setMsg(null), 10000)
    load()
  }

  function update(scraperId: string, field: string, value: any) {
    setSchedules(prev => ({ ...prev, [scraperId]: { ...prev[scraperId], [field]: value } }))
  }

  const lastRun = (s: ScheduleRow) => s.runs?.[0]
  const statusIcon = (status?: string) => {
    if (!status) return <Clock size={13} className="text-slate-300" />
    if (status === 'success') return <CheckCircle size={13} className="text-emerald-500" />
    if (status === 'error') return <AlertCircle size={13} className="text-red-500" />
    return <RefreshCw size={13} className="text-blue-400 animate-spin" />
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" /></div>

  const httpScrapers = SCRAPERS_CONFIG.filter(s => !PLAYWRIGHT_SCRAPER_IDS.has(s.id.toLowerCase()))
  const playwrightScrapers = SCRAPERS_CONFIG.filter(s => PLAYWRIGHT_SCRAPER_IDS.has(s.id.toLowerCase()))

  async function runAllHttp() {
    setMsg(null)
    setFlagged([])
    let ok = 0, err = 0, totalFound = 0, totalProcessed = 0
    for (const s of httpScrapers) {
      setRunning(s.id)
      const res = await fetch('/api/admin/run-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scraperId: s.id }),
      })
      if (res.ok) {
        ok++
        const data = await res.json().catch(() => ({}))
        totalFound += data.found ?? 0
        totalProcessed += data.processed ?? 0
        if (data.flagged?.length) setFlagged(prev => [...prev, ...data.flagged])
      } else err++
    }
    setRunning(null)
    const summary = `${ok} scrapers OK${err > 0 ? `, ${err} con error` : ''} · ${totalFound} leídas · ${totalProcessed} guardadas`
    setMsg({ type: err > 0 ? 'error' : 'success', text: summary })
    setTimeout(() => setMsg(null), 15000)
    load()
  }

  async function runAllGh() {
    setMsg(null)
    let ok = 0
    for (const s of playwrightScrapers) {
      const res = await fetch('/api/admin/trigger-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scraperId: s.id }),
      })
      if (res.ok) ok++
    }
    setMsg({ type: 'success', text: `🤖 ${ok} workflows GitHub Actions disparados` })
    setTimeout(() => setMsg(null), 5000)
  }

  async function runAllLocal() {
    setMsg(null)
    setFlagged([])
    let ok = 0, err = 0, totalFound = 0, totalProcessed = 0, totalSkipped = 0
    for (const s of httpScrapers) {
      setRunning(s.id)
      try {
        const res = await fetch('/api/admin/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scraper: s.id, categoria: s.categoria, forceLocal: true }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          ok++
          totalFound += data.totalFound ?? data.found ?? 0
          totalProcessed += data.processed ?? 0
          totalSkipped += data.skippedUnchanged ?? 0
          if (data.flagged?.length) setFlagged(prev => [...prev, ...data.flagged])
        } else {
          err++
          console.error(`[${s.id}] ${data.error ?? res.status}`)
        }
      } catch (e) {
        err++
        console.error(`[${s.id}] Error de conexión`, e)
      }
    }
    setRunning(null)
    setMsg({ type: err > 0 ? 'error' : 'success', text: `Local: ${ok} OK${err > 0 ? `, ${err} errores` : ''} · ${totalFound} leídas · ${totalProcessed} guardadas · ${totalSkipped} sin cambios` })
    setTimeout(() => setMsg(null), 15000)
    load()
  }

  return (
    <div className="space-y-4">
      {/* Solapas GH Actions / Local */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setScraperSubTab('gh')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${scraperSubTab === 'gh' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            GitHub Actions
          </button>
          <button
            onClick={() => setScraperSubTab('local')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${scraperSubTab === 'local' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Local (contingencia)
          </button>
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-800">
            {scraperSubTab === 'gh' ? 'Scrapers — GitHub Actions' : 'Scrapers — Ejecución Local'}
          </h2>
          <p className="text-xs text-slate-400">
            {scraperSubTab === 'gh' ? 'Schedules y ejecución via GitHub Actions / HTTP' : 'Correr scrapers localmente cuando GH Actions falla — requiere npm run dev'}
          </p>
        </div>
      </div>

      {scraperSubTab === 'gh' && (
      <div className="flex justify-end gap-2">
        <button
          onClick={runAllHttp}
          disabled={!!running}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all disabled:opacity-50"
        >
          {running ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
          Ejecutar todos HTTP
        </button>
        <button
          onClick={runAllGh}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all"
        >
          <Bot size={13} /> Ejecutar todos GH
        </button>
      </div>
      )}

      {scraperSubTab === 'local' && (
      <div className="flex justify-end gap-2">
        <button
          onClick={runAllLocal}
          disabled={!!running}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-all disabled:opacity-50"
        >
          {running ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
          Ejecutar todos (local)
        </button>
      </div>
      )}

      {msg && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {flagged.length > 0 && (
        <div className="rounded-xl border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-300 text-sm">
              ⚠️ {flagged.length} promo{flagged.length !== 1 ? 's' : ''} con título de descuento pero sin % detectado — revisar manualmente
            </h3>
            <button onClick={() => setFlagged([])} className="text-yellow-600 dark:text-yellow-400 text-xs hover:underline">Cerrar</button>
          </div>
          <div className="space-y-2">
            {flagged.map((p, i) => (
              <div key={i} className="rounded-lg bg-white dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3">
                <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{p.storeName} — {p.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</div>
                {p.sourceUrl && (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
                    Ver legales →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla GH Actions (original) ── */}
      {scraperSubTab === 'gh' && <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Scraper</th>
              <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Frecuencia</th>
              <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Hora UTC</th>
              <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Próximo run</th>
              <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Último run</th>
              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Activo</th>
              <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {([
              ...httpScrapers,
              null,
              ...playwrightScrapers,
            ] as (ScraperConfig | null)[]).map((cfg) => {
              if (cfg === null) return (
                <tr key="separator">
                  <td colSpan={7} className="px-5 py-2 bg-purple-50 border-y border-purple-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                      <Bot size={10} /> GitHub Actions — requieren Playwright
                    </span>
                  </td>
                </tr>
              )
              const s = schedules[cfg.id] ?? { scraperId: cfg.id, frequency: 'manual', hour: 6, active: true }
              const last = lastRun(s)
              return (
                <tr key={cfg.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 text-xs">{cfg.name}</p>
                        {PLAYWRIGHT_SCRAPER_IDS.has(cfg.id.toLowerCase()) ? (
                          <span className="text-[9px] font-black bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md">GH</span>
                        ) : (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md">HTTP</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">{cfg.group}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <select
                        value={s.frequency}
                        onChange={e => update(cfg.id, 'frequency', e.target.value)}
                        style={{ colorScheme: 'light' }}
                        className="text-xs bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none"
                      >
                        {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      {s.frequency === 'weekly' && (
                        <select value={s.dayOfWeek ?? 1} onChange={e => update(cfg.id, 'dayOfWeek', parseInt(e.target.value))}
                          style={{ colorScheme: 'light' }}
                          className="text-xs bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none">
                          {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      )}
                      {s.frequency === 'monthly' && (
                        <input type="number" min={1} max={31} value={s.dayOfMonth ?? 1}
                          onChange={e => update(cfg.id, 'dayOfMonth', parseInt(e.target.value))}
                          className="text-xs bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none w-16" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min={0} max={23} value={s.hour}
                      onChange={e => update(cfg.id, 'hour', parseInt(e.target.value))}
                      className="text-xs bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none w-14" />
                  </td>
                  <td className="px-3 py-3 text-[11px] text-slate-500">
                    {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(last?.status)}
                      <div>
                        {last ? (
                          <>
                            <p className="text-[10px] text-slate-500">{new Date(last.startedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            {last.found != null && <p className="text-[10px] text-slate-400">{last.found} enc. / {last.processed} proc.</p>}
                            {last.message && <p className="text-[10px] text-red-400 truncate max-w-[120px]" title={last.message}>{last.message}</p>}
                          </>
                        ) : <p className="text-[10px] text-slate-300">Sin runs</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => update(cfg.id, 'active', !s.active)}
                      className={`p-1.5 rounded-lg transition-colors ${s.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {s.active ? <Play size={12} /> : <Pause size={12} />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => save(cfg.id)} disabled={saving === cfg.id}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50">
                        {saving === cfg.id ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => runNow(cfg.id)} disabled={running === cfg.id}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                        {running === cfg.id ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
                        {running === cfg.id ? 'Corriendo...' : 'Ahora'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>}

      {/* ── Tabla Local (contingencia) ── */}
      {scraperSubTab === 'local' && <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-orange-50 border-b border-orange-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
            Todos los scrapers corren localmente — requiere <code className="font-mono bg-orange-100 px-1 rounded">npm run dev</code>
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Scraper</th>
              <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
              <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ejecutar</th>
            </tr>
          </thead>
          <tbody>
            {SCRAPERS_CONFIG.map(cfg => (
              <tr key={cfg.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-bold text-slate-800 text-xs">{cfg.name}</p>
                  <p className="text-[10px] text-slate-400">{cfg.description}</p>
                </td>
                <td className="px-5 py-3">
                  {PLAYWRIGHT_SCRAPER_IDS.has(cfg.id.toLowerCase())
                    ? <span className="text-[9px] font-black bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md">Playwright</span>
                    : <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md">HTTP</span>
                  }
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => runNow(cfg.id, true)}
                    disabled={!!running}
                    className="text-[10px] font-bold px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                  >
                    {running === cfg.id ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
                    {running === cfg.id ? 'Corriendo...' : 'Run local'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  )
}

// ─── CleanupTab ───────────────────────────────────────────────

const SOURCE_LABELS: { label: string; value: string }[] = [
  { label: 'AmEx',          value: 'americanexpress.com' },
  { label: 'BBVA',          value: 'bbva.com.ar' },
  { label: 'BNA',           value: 'semananacion.com.ar' },
  { label: 'Brubank',       value: 'brubank.com' },
  { label: 'Cabal',         value: 'beneficios.bancocredicoop.coop' },
  { label: 'Carrefour',     value: 'carrefour.com.ar' },
  { label: 'ChangoMás',     value: 'masonline.com.ar' },
  { label: 'Ciudad',        value: 'bancociudad.com.ar' },
  { label: 'Clarín 365',    value: '365.clarin.com' },
  { label: 'Club La Nación',value: 'club.lanacion.com.ar' },
  { label: 'Coto',          value: 'coto.com.ar' },
  { label: 'Cuenta DNI',    value: 'bancoprovincia.com.ar' },
  { label: 'DIA',           value: 'diaonline.supermercadosdia.com.ar' },
  { label: 'Diarco',        value: 'diarco.com.ar' },
  { label: 'Disco',         value: 'disco.com.ar' },
  { label: 'Galicia',       value: 'galicia.ar' },
  { label: 'ICBC',          value: 'beneficios.icbc.com.ar' },
  { label: 'Jumbo',         value: 'jumbo.com.ar' },
  { label: 'Macro',         value: 'macro.com.ar' },
  { label: 'MercadoPago',   value: 'promociones.mercadopago.com.ar' },
  { label: 'MODO',          value: 'modo.com.ar' },
  { label: 'Naranja X',     value: 'naranjax.com' },
  { label: 'Openpay',       value: 'openpayargentina.com.ar' },
  { label: 'Patagonia',     value: 'ahorrosybeneficios.bancopatagonia.com.ar' },
  { label: 'Personal Pay',  value: 'personal.com.ar' },
  { label: 'Provincia',     value: 'bancoprovincia.com.ar' },
  { label: 'Santander',     value: 'santander.com.ar' },
  { label: 'Supervielle',   value: 'supervielle.com.ar' },
  { label: 'Favacard',      value: 'promosfavacard.com.ar' },
  { label: 'Vea',           value: 'vea.com.ar' },
  { label: 'VISA',          value: 'visa.com.ar' },
]

function CleanupTab({ commerces }: { commerces: { id: string; name: string }[] }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [selectedCommerce, setSelectedCommerce] = useState('')
  const [selectedSource, setSelectedSource] = useState('')

  async function run(tipo: string, extra: Record<string, string> = {}) {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, ...extra }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setResult(`✅ ${d.deleted} promos eliminadas`)
    } catch (e: any) {
      setResult(`❌ Error: ${e.message}`)
    } finally {
      setLoading(false)
      setConfirmAll(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Limpieza de Promos</h2>
        <p className="text-xs text-slate-400 mt-1">Eliminación masiva — las acciones no se pueden deshacer</p>
      </div>

      {result && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-medium ${result.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {result}
        </div>
      )}

      {/* Expiradas */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700">Borrar promos expiradas</h3>
        </div>
        <p className="text-xs text-slate-400">Elimina todas las promos cuya fecha de vencimiento ya pasó.</p>
        <button onClick={() => run('expired')} disabled={loading}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors">
          {loading ? 'Borrando...' : 'Borrar expiradas'}
        </button>
      </div>

      {/* Por comercio */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700">Borrar por comercio</h3>
        </div>
        <select value={selectedCommerce} onChange={e => setSelectedCommerce(e.target.value)}
          style={{ colorScheme: 'light' }}
          className="w-full bg-white border border-slate-200 text-sm font-medium text-slate-800 px-4 py-2.5 rounded-xl outline-none">
          <option value="">Seleccioná un comercio...</option>
          {commerces.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button onClick={() => run('by_commerce', { commerceId: selectedCommerce })}
          disabled={loading || !selectedCommerce}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors">
          {loading ? 'Borrando...' : 'Borrar promos de este comercio'}
        </button>
      </div>

      {/* Por fuente/scraper */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700">Borrar por scraper</h3>
        </div>
        <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}
          style={{ colorScheme: 'light' }}
          className="w-full bg-white border border-slate-200 text-sm font-medium text-slate-800 px-4 py-2.5 rounded-xl outline-none">
          <option value="">Seleccioná un scraper...</option>
          {SOURCE_LABELS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button onClick={() => run('by_source', { sourceUrl: selectedSource })}
          disabled={loading || !selectedSource}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors">
          {loading ? 'Borrando...' : 'Borrar promos de este scraper'}
        </button>
      </div>

      {/* Borrar todo */}
      <div className="bg-red-50 border border-red-100 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 size={16} className="text-red-400" />
          <h3 className="text-sm font-bold text-red-700">Borrar TODAS las promos</h3>
        </div>
        <p className="text-xs text-red-500">Elimina absolutamente todas las promos de la base de datos. Usá con cuidado.</p>
        {!confirmAll ? (
          <button onClick={() => setConfirmAll(true)} disabled={loading}
            className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors">
            Borrar todo
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => run('all')} disabled={loading}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors">
              {loading ? 'Borrando...' : '⚠️ Confirmar — borrar TODO'}
            </button>
            <button onClick={() => setConfirmAll(false)}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl transition-colors">
              Cancelar
            </button>
          </div>
        )}
      </div>
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

function EntityRow({ name, img, onEdit, onDelete, onMerge, badge, hideEdit }: any) {
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
        {onMerge && <button onClick={onMerge} className="p-2 text-slate-300 hover:text-amber-500 transition-colors" title="Fusionar con otro comercio"><GitMerge size={15} /></button>}
        {!hideEdit && <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Pencil size={15} /></button>}
        <button onClick={onDelete} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
      </div>
    </div>
  )
}

function PromoCard({ promo, onEdit, onDelete, isDeleting, onCancelDelete, confirmDelete, discount, conditions, isExpiredView, onToggleFeatured }: any) {
  return (
    <div className={`bg-white border rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all flex flex-col group ${promo.isFeatured ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200'}`}>
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: promo.category.color + '15', color: promo.category.color }}>
              {promo.category.name}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${promo.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
              {promo.status}
            </span>
            {promo.isFeatured && <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-yellow-100 text-yellow-700">⭐ DESTACADA</span>}
          </div>
          <h4 className="font-bold text-slate-900 text-sm leading-tight">{promo.title}</h4>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{promo.commerce.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xl font-black text-green-600 tracking-tighter">{discount}</span>
          <button onClick={onToggleFeatured}
            title={promo.isFeatured ? 'Quitar de destacadas' : 'Marcar como destacada'}
            className={`text-lg transition-colors ${promo.isFeatured ? 'text-yellow-400 hover:text-gray-300' : 'text-gray-200 hover:text-yellow-400'}`}>
            ★
          </button>
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
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            Configurar {
              entity.type === 'category' ? 'Categoría' :
              entity.type === 'bank' ? 'Banco' :
                entity.type === 'commerce' ? 'Comercio' :
                  entity.type === 'cardNetwork' ? 'Marca de Tarjeta' :
                    entity.type === 'cardSegment' ? 'Segmento de Tarjeta' :
                      entity.type === 'currency' ? 'Moneda' :
                        entity.type === 'segment' ? 'Segmento Bancario' :
                          entity.type === 'accountType' ? 'Tipo de Cuenta' :
                            entity.type === 'wallet' ? 'Billetera' :
                              entity.type === 'commerceAlias' ? 'Alias de Comercio' :
                                entity.type
            }
          </h3>
          <button onClick={onCancel} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4 overflow-y-auto flex-1">
          {/* Para cardSegment y commerceAlias el nombre se maneja con campos propios */}
          {entity.type !== 'cardSegment' && entity.type !== 'commerceAlias' && (
            <Field label="Nombre / Etiqueta">
              <Input value={entity.name} onChange={e => setEntity({ ...entity, name: e.target.value })} autoFocus />
            </Field>
          )}

          {entity.type === 'category' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ícono (emoji)">
                <Input value={(entity as any).icon || ''} onChange={e => setEntity({ ...entity, icon: e.target.value } as any)} placeholder="🏷️" />
              </Field>
              <Field label="Color (hex)">
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={(entity as any).color || '#6366f1'}
                    onChange={e => setEntity({ ...entity, color: e.target.value } as any)}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer"
                  />
                  <Input value={(entity as any).color || '#6366f1'} onChange={e => setEntity({ ...entity, color: e.target.value } as any)} placeholder="#6366f1" />
                </div>
              </Field>
              <Field label="Orden (número)">
                <Input type="number" value={entity.code || '99'} onChange={e => setEntity({ ...entity, code: e.target.value })} placeholder="99" />
              </Field>
            </div>
          )}

          {(entity.type === 'bank' || entity.type === 'commerce' || entity.type === 'wallet') && (
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

          {(entity.type === 'bank' || entity.type === 'wallet') && (
            <Field label="Marcas de Tarjeta Admitidas">
              <div className="max-h-40 overflow-y-auto custom-scrollbar border border-slate-200 rounded-2xl bg-slate-50 p-2 grid grid-cols-2 gap-2 mt-2">
                {allEntities?.cardNetworks.map((n: any) => (
                  <label key={n.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition-colors">
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

          {(entity.type === 'bank' || entity.type === 'wallet') && !!entity.cardNetworkIds?.length && (
            <Field label="Segmentos de Tarjeta Ofrecidos">
              <div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 rounded-2xl bg-slate-50 p-2 flex flex-col gap-1 mt-2">
                {allEntities?.cardSegments?.filter((cs: any) => entity.cardNetworkIds?.includes(cs.cardNetworkId)).map((cs: any) => (
                  <label key={cs.id} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={entity.cardSegmentIds?.includes(cs.id)}
                      onChange={e => {
                        const ids = entity.cardSegmentIds || []
                        setEntity({ ...entity, cardSegmentIds: e.target.checked ? [...ids, cs.id] : ids.filter((i: string) => i !== cs.id) })
                      }}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {cs.cardNetwork.name} {cs.cardType === 'CREDIT' ? 'Crédito' : cs.cardType === 'DEBIT' ? 'Débito' : 'Prepaga'}
                      <span className="ml-1 opacity-60">· {cs.name}</span>
                    </span>
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

          {entity.type === 'cardSegment' && (() => {
            const netName = allEntities?.cardNetworks.find((n: any) => n.id === entity.cardNetworkId)?.name || ''
            const typeLabel = entity.cardType === 'CREDIT' ? 'Crédito' : entity.cardType === 'DEBIT' ? 'Débito' : entity.cardType === 'PREPAID' ? 'Prepaga' : ''
            const generatedName = [netName, typeLabel, entity.name].filter(Boolean).join(' ')
            return (
              <>
                <Field label="Red de Tarjeta">
                  <Select value={entity.cardNetworkId || ''} onChange={e => setEntity({ ...entity, cardNetworkId: e.target.value })}>
                    <option value="">Selección...</option>
                    {allEntities?.cardNetworks.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo">
                  <Select value={entity.cardType || ''} onChange={e => setEntity({ ...entity, cardType: e.target.value })}>
                    <option value="">Selección...</option>
                    <option value="CREDIT">Crédito</option>
                    <option value="DEBIT">Débito</option>
                    <option value="PREPAID">Prepaga</option>
                  </Select>
                </Field>
                <Field label="Nivel / Segmento">
                  <Input
                    value={entity.name || ''}
                    onChange={e => setEntity({ ...entity, name: e.target.value })}
                    placeholder="Gold, Platinum, Black, Infinite..."
                    autoFocus
                  />
                </Field>
                {generatedName && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Nombre generado</p>
                    <p className="text-sm font-bold text-indigo-700">{generatedName}</p>
                  </div>
                )}
              </>
            )
          })()}

          {entity.type === 'commerceAlias' && (
            <>
              <Field label="Alias (nombre tal cual lo trae el scraper)">
                <Input value={entity.name} onChange={e => setEntity({ ...entity, name: e.target.value })} placeholder="Ej: HAVANNA GOOGLE PAY APPLE PAY" autoFocus />
              </Field>
              <Field label="Comercio canónico">
                <Select value={entity.commerceId || ''} onChange={e => setEntity({ ...entity, commerceId: e.target.value })}>
                  <option value="">Selección...</option>
                  {allEntities?.commerces.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </>
          )}
        </div>
        <div className="px-8 py-6 bg-slate-50 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl">Cancelar</button>
          <button
            onClick={onSave}
            disabled={saving || !entity.name || (entity.type === 'commerceAlias' && !entity.commerceId)}
            className="flex-1 py-3 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl shadow-slate-200 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MergeCommerceModal({ source, commerces, targetId, setTargetId, onConfirm, onCancel, merging }: any) {
  const options = commerces.filter((c: any) => c.id !== source.id)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Fusionar comercio</h3>
          <button onClick={onCancel} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-500">
            Se moverán todas las promos, sucursales y catálogo de productos de <span className="font-bold text-slate-800">{source.name}</span> al comercio elegido,
            se creará un alias <span className="font-bold text-slate-800">"{source.name}"</span> apuntando al destino, y se eliminará <span className="font-bold text-slate-800">{source.name}</span>.
          </p>
          <Field label="Fusionar con (comercio canónico destino)">
            <Select value={targetId} onChange={e => setTargetId(e.target.value)}>
              <option value="">Selección...</option>
              {options.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="px-8 py-6 bg-slate-50 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl">Cancelar</button>
          <button onClick={onConfirm} disabled={merging || !targetId} className="flex-1 py-3 bg-amber-500 text-white text-xs font-bold rounded-2xl shadow-xl shadow-amber-100 disabled:opacity-50">
            {merging ? 'Fusionando...' : 'Fusionar'}
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
const inputClass = 'w-full text-xs font-semibold text-slate-800 px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:font-normal placeholder:text-slate-400'

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

function NewsletterTab() {
  const [subscribers, setSubscribers] = useState<Array<{ id: string; name: string | null; email: string; newsletterOptInAt: string | null }>>([])
  const [nonSubscribers, setNonSubscribers] = useState<Array<{ id: string; name: string | null; email: string; createdAt: string }>>([])
  const [total, setTotal] = useState(0)
  const [optOut, setOptOut] = useState(0)
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendingPersonalized, setSendingPersonalized] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewingPersonalized, setPreviewingPersonalized] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ id: string; subject: string; html: string; sentTo: number; errors: number; sentAt: string }>>([])

  function loadData() {
    fetch('/api/admin/newsletter')
      .then(r => r.json())
      .then(d => {
        setSubscribers(d.subscribers ?? [])
        setNonSubscribers(d.nonSubscribers ?? [])
        setTotal(d.total ?? 0)
        setOptOut(d.optOut ?? 0)
      })
    fetch('/api/admin/newsletter/history')
      .then(r => r.json())
      .then(d => setHistory(d.logs ?? []))
      .catch(() => {})
  }

  useEffect(() => { loadData() }, [])

  async function toggleUser(userId: string, optIn: boolean) {
    setTogglingId(userId)
    await fetch('/api/admin/newsletter', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newsletterOptIn: optIn }),
    })
    setTogglingId(null)
    loadData()
  }

  async function sendPreview() {
    setPreviewing(true)
    const res = await fetch('/api/admin/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, htmlContent, preview: true }),
    })
    const d = await res.json()
    setPreviewing(false)
    setMsg(res.ok ? { type: 'success', text: '✅ Preview enviado a tu email' } : { type: 'error', text: d.error })
  }

  async function sendPersonalizedPreview() {
    if (!subject) return
    setPreviewingPersonalized(true)
    const res = await fetch('/api/admin/newsletter/send-personalized', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, preview: true }),
    })
    const d = await res.json()
    setPreviewingPersonalized(false)
    setMsg(res.ok ? { type: 'success', text: '✅ Preview personalizado enviado a tu email' } : { type: 'error', text: d.error })
  }

  async function sendPersonalizedAll() {
    if (!subject || !confirm(`¿Enviar newsletter personalizada a ${subscribers.length} suscriptores? Cada uno recibe sus top 3 promos según su perfil.`)) return
    setSendingPersonalized(true)
    const res = await fetch('/api/admin/newsletter/send-personalized', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject }),
    })
    const d = await res.json()
    setSendingPersonalized(false)
    if (res.ok) {
      setMsg({ type: 'success', text: `✅ Enviada a ${d.sent} suscriptores${d.errors > 0 ? ` (${d.errors} errores)` : ''}` })
      loadData()
    } else {
      setMsg({ type: 'error', text: d.error })
    }
  }

  async function sendAll() {
    if (!confirm(`¿Enviar a ${subscribers.length} suscriptores?`)) return
    setSending(true)
    const res = await fetch('/api/admin/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, htmlContent }),
    })
    const d = await res.json()
    setSending(false)
    if (res.ok) {
      setMsg({ type: 'success', text: `✅ Enviado a ${d.sent} suscriptores${d.errors > 0 ? ` (${d.errors} errores)` : ''}` })
      loadData()
    } else {
      setMsg({ type: 'error', text: d.error })
    }
  }

  const previewHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#f0f0f0;padding:8px 12px;border-radius:8px 8px 0 0;font-size:11px;color:#666">
        <strong>Asunto:</strong> ${subject || '<span style="color:#aaa">sin asunto</span>'}
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <div style="background:#1E3A5F;padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:900">PromoAR</p>
          <p style="margin:4px 0 0;color:#93b4d4;font-size:12px">Ahorrá en cada compra con tus tarjetas y bancos</p>
        </div>
        <div style="padding:28px">${htmlContent}</div>
        <div style="border-top:1px solid #eee;padding:16px 28px;font-size:11px;color:#bbb;text-align:center">
          🌐 promoar.com.ar<br>
          <a href="#" style="color:#bbb">Instagram</a> · <a href="#" style="color:#bbb">Facebook</a> · <a href="#" style="color:#bbb">TikTok</a><br>
          <a href="#" style="color:#bbb;text-decoration:underline">Cancelar suscripción</a>
        </div>
      </div>
    </div>
  `

  return (
    <div className="space-y-6">
      {/* Stats de suscriptores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-3xl font-black text-[#1E3A5F]">{subscribers.length}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Suscriptores activos</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-3xl font-black text-slate-400">{optOut}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Sin suscripción</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
          <p className="text-3xl font-black text-slate-600">{total}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Usuarios totales</p>
        </div>
      </div>

      {/* Lista suscriptores */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users2 size={15} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-700">Suscriptores</span>
        </div>
        <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
          {subscribers.map(u => (
            <div key={u.id} className="px-5 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">{u.name || '—'}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-slate-300">{u.newsletterOptInAt ? new Date(u.newsletterOptInAt).toLocaleDateString('es-AR') : ''}</p>
                <button
                  onClick={() => toggleUser(u.id, false)}
                  disabled={togglingId === u.id}
                  className="text-[10px] text-red-400 hover:text-red-600 font-bold disabled:opacity-40"
                >
                  Dar de baja
                </button>
              </div>
            </div>
          ))}
          {subscribers.length === 0 && <p className="px-5 py-4 text-xs text-slate-400">Sin suscriptores aún</p>}
        </div>
      </div>

      {/* No suscriptos */}
      {nonSubscribers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users2 size={15} className="text-slate-300" />
              <span className="text-sm font-bold text-slate-500">Sin suscripción</span>
              <span className="text-xs text-slate-300 font-medium">({nonSubscribers.length})</span>
            </div>
            <p className="text-[10px] text-slate-400">Activá manualmente si tenés consentimiento</p>
          </div>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {nonSubscribers.map(u => (
              <div key={u.id} className="px-5 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">{u.name || '—'}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <button
                  onClick={() => toggleUser(u.id, true)}
                  disabled={togglingId === u.id}
                  className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-400 px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                >
                  {togglingId === u.id ? '...' : 'Suscribir'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Newsletter personalizada automática */}
      <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2d5494] rounded-2xl p-6 text-white space-y-3">
        <div>
          <p className="text-sm font-black">✨ Newsletter personalizada</p>
          <p className="text-xs text-blue-200 mt-1">Cada suscriptor recibe sus top 3 promos según su perfil financiero. Los que no tienen perfil reciben las mejores promos generales.</p>
        </div>
        <div>
          <label className="text-xs font-bold text-blue-200 block mb-1.5">Asunto del email</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Las mejores promos de esta semana 🎉"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-blue-300 outline-none focus:border-white/50"
          />
        </div>
        {msg && (
          <div className={`px-4 py-3 rounded-xl text-xs font-bold ${msg.type === 'success' ? 'bg-green-500/20 text-green-200 border border-green-400/30' : 'bg-red-500/20 text-red-200 border border-red-400/30'}`}>
            {msg.text}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={sendPersonalizedPreview}
            disabled={previewingPersonalized || !subject}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-2 border-white/40 text-white rounded-xl hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            <Eye size={13} /> {previewingPersonalized ? 'Enviando...' : 'Preview a mí'}
          </button>
          <button
            onClick={sendPersonalizedAll}
            disabled={sendingPersonalized || !subject || subscribers.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-white text-[#1E3A5F] rounded-xl hover:bg-blue-50 disabled:opacity-40 transition-all"
          >
            <Send size={13} /> {sendingPersonalized ? 'Enviando...' : `Enviar a ${subscribers.length} suscriptores`}
          </button>
        </div>
      </div>

      {/* Compositor manual */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-black text-slate-800">Envío manual (HTML libre)</h3>

        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1.5">Asunto</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Las mejores promos de esta semana 🎉"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1E3A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1.5">Contenido (HTML)</label>
          <textarea
            value={htmlContent}
            onChange={e => setHtmlContent(e.target.value)}
            placeholder={'<h2>¡Hola!</h2>\n<p>Esta semana las mejores promos son...</p>'}
            rows={10}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-[#1E3A5F] resize-y"
          />
        </div>

        {/* Preview toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Eye size={13} /> {showPreview ? 'Ocultar preview' : 'Ver preview'}
          </button>
        </div>

        {showPreview && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-gray-50 p-4">
            <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">Preview — así lo ve el usuario</p>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-xs font-bold ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={sendPreview}
            disabled={previewing || !subject || !htmlContent}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-2 border-[#1E3A5F] text-[#1E3A5F] rounded-xl hover:bg-[#1E3A5F]/5 disabled:opacity-40 transition-all"
          >
            <Eye size={13} /> {previewing ? 'Enviando...' : 'Enviarme preview'}
          </button>
          <button
            onClick={sendAll}
            disabled={sending || !subject || !htmlContent || subscribers.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#1E3A5F] text-white rounded-xl hover:bg-[#142840] disabled:opacity-40 transition-all"
          >
            <Send size={13} /> {sending ? 'Enviando...' : `Enviar a ${subscribers.length} suscriptores`}
          </button>
        </div>
      </div>

      {/* Historial de envíos */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock size={15} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-700">Historial de envíos</span>
          </div>
          <div className="divide-y divide-slate-50">
            {history.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{log.subject}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(log.sentAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}<span className="text-emerald-600 font-bold">{log.sentTo} enviados</span>
                    {log.errors > 0 && <span className="text-red-400 font-bold"> · {log.errors} errores</span>}
                  </p>
                </div>
                <button
                  onClick={() => { setSubject(log.subject); setHtmlContent(log.html); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="shrink-0 text-[11px] font-bold text-[#1E3A5F] border border-[#1E3A5F]/30 hover:bg-[#1E3A5F]/5 px-3 py-1.5 rounded-lg transition-all"
                >
                  Reusar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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
const GROUPS_ORDER: ScraperGroup[] = ['supermercado', 'billetera', 'tarjeta', 'banco']

type QueueItem = { id: string; categoria?: string }

function ScraperModal({ onClose, onRunQueue, scraping }: {
  onClose: () => void
  onRunQueue: (queue: QueueItem[]) => void
  scraping: boolean
}) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [activeGroup, setActiveGroup] = useState<ScraperGroup>('supermercado')
  // Para scrapers que necesitan categoría: almacenamos la selección pendiente
  const [pendingCat, setPendingCat] = useState<{ id: string; tipo: 'modo' | 'club la nacion' } | null>(null)
  const [categoria, setCategoria] = useState<string>('')

  const groupScrapers = SCRAPERS_CONFIG.filter(s => s.group === activeGroup)

  function queueIndex(id: string) {
    return queue.findIndex(q => q.id === id)
  }

  function toggleScraper(s: ScraperConfig) {
    const idx = queueIndex(s.id)
    if (idx >= 0) {
      // Ya está en la cola → remover
      setQueue(q => q.filter(item => item.id !== s.id))
      if (pendingCat?.id === s.id) setPendingCat(null)
    } else if (s.id === 'modo' || s.id === 'club la nacion') {
      // Agregar directo con todas las categorías
      setQueue(q => [...q, { id: s.id, categoria: undefined }])
    } else {
      setQueue(q => [...q, { id: s.id, categoria: s.categoria }])
    }
  }

  function confirmCat() {
    if (!pendingCat) return
    setQueue(q => [...q, { id: pendingCat.id, categoria: categoria === 'TODOS' ? undefined : categoria || undefined }])
    setPendingCat(null)
    setCategoria('')
  }

  function selectAll() {
    const all: QueueItem[] = SCRAPERS_CONFIG
      .filter(s => s.id !== 'modo' && s.id !== 'club la nacion')
      .map(s => ({ id: s.id, categoria: s.categoria }))
    // MODO y Club La Nacion se agregan sin categoría (= todos)
    all.push({ id: 'modo', categoria: undefined })
    all.push({ id: 'club la nacion', categoria: undefined })
    setQueue(all)
    setPendingCat(null)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl"><Bot size={18} className="text-indigo-600" /></div>
            <div>
              <h3 className="font-bold text-slate-900">Auto-Sync Scraper</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Armá la cola de scrapers a ejecutar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        {/* Cola actual */}
        {queue.length > 0 && (
          <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mr-1">Cola:</span>
              {queue.map((item, i) => {
                const name = SCRAPERS_CONFIG.find(s => s.id === item.id)?.name ?? item.id
                return (
                  <span key={item.id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <span className="bg-indigo-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{i + 1}</span>
                    {name}
                    <button onClick={() => setQueue(q => q.filter(x => x.id !== item.id))} className="ml-0.5 text-indigo-400 hover:text-indigo-700">×</button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Ejecutar todos / ninguno */}
          <div className="flex gap-2">
            <button type="button" onClick={selectAll}
              className="flex-1 py-2 text-[11px] font-bold rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all">
              Ejecutar todos
            </button>
            <button type="button" onClick={() => { setQueue([]); setPendingCat(null) }}
              className="flex-1 py-2 text-[11px] font-bold rounded-xl border-2 border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all">
              Ejecutar ninguno
            </button>
          </div>

          {/* Tabs de grupo */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
            {GROUPS_ORDER.map(g => {
              const groupCount = SCRAPERS_CONFIG.filter(s => s.group === g && queueIndex(s.id) >= 0).length
              return (
                <button key={g} type="button" onClick={() => { setActiveGroup(g); setPendingCat(null) }}
                  className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all relative ${activeGroup === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {GRUPO_LABEL[g]}
                  {groupCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{groupCount}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Lista de scrapers del grupo */}
          <div className="grid grid-cols-2 gap-2">
            {groupScrapers.map(s => {
              const idx = queueIndex(s.id)
              const inQueue = idx >= 0
              const isPending = pendingCat?.id === s.id
              return (
                <button key={s.id} type="button" onClick={() => toggleScraper(s)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all relative ${inQueue ? 'border-indigo-500 bg-indigo-50' : isPending ? 'border-amber-400 bg-amber-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                  {inQueue && (
                    <span className="absolute top-2 right-2 bg-indigo-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">{idx + 1}</span>
                  )}
                  <p className="text-xs font-black text-slate-900 pr-5">{s.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.description}</p>
                </button>
              )
            })}
          </div>

          {/* Picker de categoría inline (MODO) */}
          {pendingCat?.tipo === 'modo' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Rubro MODO a importar</p>
              <div className="grid grid-cols-2 gap-2">
                {MODO_CATEGORIAS.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategoria(cat)}
                    className={`py-2 px-3 rounded-xl text-[11px] font-bold border-2 transition-all ${categoria === cat ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                    {cat}
                  </button>
                ))}
                <button type="button" onClick={() => setCategoria('TODOS')}
                  className={`py-2 px-3 rounded-xl text-[11px] font-bold border-2 transition-all col-span-2 ${categoria === 'TODOS' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                  ⚠️ Todos los rubros
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={confirmCat} disabled={!categoria}
                  className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl disabled:opacity-40">
                  Agregar a la cola
                </button>
                <button onClick={() => setPendingCat(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Picker de categoría inline (Club La Nacion) */}
          {pendingCat?.tipo === 'club la nacion' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Categoría Club La Nación</p>
              <div className="grid grid-cols-2 gap-2">
                {['gastronomia','salidas','viajes','moda','hogar','mercados','bienestar','automovil','educacion','otros'].map(cat => (
                  <button key={cat} type="button" onClick={() => setCategoria(cat)}
                    className={`py-2 px-3 rounded-xl text-[11px] font-bold border-2 transition-all capitalize ${categoria === cat ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                    {cat}
                  </button>
                ))}
                <button type="button" onClick={() => setCategoria('TEST')}
                  className={`py-2 px-3 rounded-xl text-[11px] font-bold border-2 transition-all col-span-2 ${categoria === 'TEST' ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                  🧪 TEST — solo 5 beneficios
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={confirmCat} disabled={!categoria}
                  className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl disabled:opacity-40">
                  Agregar a la cola
                </button>
                <button onClick={() => setPendingCat(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onRunQueue(queue)}
            disabled={queue.length === 0 || scraping}
            className="flex-1 py-3 bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-100 disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            {scraping ? 'Ejecutando...' : `🚀 Ejecutar${queue.length > 0 ? ` (${queue.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}


function ClasificarTab({ promos, categories, onAssigned }: {
  promos: PromoFull[]
  categories: Entity[]
  onAssigned: () => void
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const filtered = promos.filter(p => {
    if (!search) return true
    const q = normalizeSearch(search)
    return (p.commerce?.name ? normalizeSearch(p.commerce.name).includes(q) : false) || (p.title ? normalizeSearch(p.title).includes(q) : false)
  })

  async function assign(promoId: string, categoryId: string) {
    if (!categoryId) return
    setSaving(s => ({ ...s, [promoId]: true }))
    try {
      const res = await fetch(`/api/promos/${promoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      })
      if (res.ok) await onAssigned()
    } finally {
      setSaving(s => ({ ...s, [promoId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Por Clasificar</h2>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{promos.length} PROMOS</span>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por comercio o título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400"
        />
      </div>

      {promos.length === 0 ? (
        <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
          <Check className="mx-auto text-green-300 mb-3" size={40} />
          <p className="text-slate-400 font-medium">Todo clasificado 🎉</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-5 py-3">Comercio</th>
                <th className="px-5 py-3">Título</th>
                <th className="px-5 py-3">Fuente</th>
                <th className="px-5 py-3 w-52">Categoría</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-xs font-bold text-slate-800">{p.commerce?.name}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 max-w-xs truncate">{p.title}</td>
                  <td className="px-5 py-3">
                    {p.sourceUrl
                      ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline truncate block max-w-[140px]">Ver fuente</a>
                      : <span className="text-[10px] text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={assignments[p.id] ?? ''}
                      onChange={e => setAssignments(a => ({ ...a, [p.id]: e.target.value }))}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="">Elegir categoría...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => assign(p.id, assignments[p.id])}
                      disabled={!assignments[p.id] || saving[p.id]}
                      className="text-[10px] font-bold px-3 py-2 bg-indigo-600 text-white rounded-xl disabled:opacity-30 hover:bg-indigo-700 transition-colors"
                    >
                      {saving[p.id] ? '...' : 'Asignar'}
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
