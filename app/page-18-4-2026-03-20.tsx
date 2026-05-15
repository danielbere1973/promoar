'use client'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Calendar, Tag, CreditCard, Settings, X, Search, Sparkles, Filter, Heart, ChevronRight, Info, Smartphone, Building2, Clock, Globe, SlidersHorizontal } from 'lucide-react'
import BottomNav from './components/BottomNav'
import FilterDrawer, { FilterState } from './components/FilterDrawer'
import ActiveFilters from './components/ActiveFilters'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaHoy() {
  const hoy = new Date()
  return `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`
}

type Req = {
  id?: string
  bank?: { name: string } | null
  wallet?: { name: string } | null
  cardNetwork?: { name: string } | null
  cardType?: string | null
  paymentChannel?: string | null
  accountType?: string | null
  segment?: string | null
  discountType?: string
  discountValue?: number
  cap?: number | null
  capPeriod?: string | null
  minPurchase?: number | null
}

type Promo = {
  id: string
  title: string
  description: string
  uniqueUsePerPeriod: boolean
  stackable: boolean
  validDaysNote?: string | null
  specificDates?: string | null
  category: { name: string; color: string }
  commerce: { name: string }
  requirements: Req[]
  validFrom: string
  validUntil: string | null
  isSaved?: boolean
  // Campos del motor de match
  globalMaxDiscount?: Req | null  // Mayor descuento posible (cualquier condición)
  userBestDiscount?: Req | null   // Mayor descuento que este usuario puede aprovechar
}

const CAP_LABELS: Record<string, string> = {
  PER_TRANSACTION: 'por trx.',
  DAILY: 'por día',
  WEEKLY: 'por sem.',
  MONTHLY: 'por mes',
  TOTAL: 'total',
}

function maxDiscountReq(p: Promo): Req | null {
  // Si el usuario tiene un tier personalizado, usarlo; si no, usar el global máximo
  if (p.userBestDiscount) return p.userBestDiscount
  if (p.globalMaxDiscount) return p.globalMaxDiscount
  if (!p.requirements.length) return null
  return p.requirements.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), p.requirements[0])
}

function discountLabel(p: Promo) {
  const req = maxDiscountReq(p)
  if (!req) return ''
  // Mostrar "Hasta" si: no hay userBestDiscount, o el user no logró el tier máximo global
  const isPersonalized = !!p.userBestDiscount
  const isMaxTier = isPersonalized && p.globalMaxDiscount &&
    (p.userBestDiscount?.discountValue ?? 0) >= (p.globalMaxDiscount?.discountValue ?? 0)
  const prefix = !isPersonalized || (!isMaxTier && p.requirements.length > 1) ? 'Hasta ' : ''
  const val = req.discountValue ?? 0

  if (req.discountType === 'PERCENTAGE_REINTEGRO' || req.discountType === 'PERCENTAGE_DESCUENTO') return `${prefix}${val}%`
  if (req.discountType === 'BONIFICACION') return `${prefix}${val}% BONIF.`
  if (req.discountType === 'FIXED_AMOUNT') return `${prefix}$${val}`
  if (req.discountType === 'CUOTAS_SIN_INTERES') return `${val} cuotas`
  return `${prefix}${val}`
}

function capLabel(p: Promo) {
  const req = maxDiscountReq(p)
  if (!req || !req.cap) return 'Sin tope'
  const periodo = req.capPeriod ? CAP_LABELS[req.capPeriod] ?? '' : ''
  return `$${req.cap.toLocaleString('es-AR')}${periodo ? ' ' + periodo : ''}`
}

function getMediosDePago(reqs: Req[]) {
  const types = new Set<string>()
  reqs.forEach(r => {
    if (r.cardType === 'CREDIT') types.add('Crédito')
    if (r.cardType === 'DEBIT') types.add('Débito')
    if (r.cardType === 'PREPAID') types.add('Prepaga')
  })
  if (types.size === 0) return 'Cualquier Tarjeta/Cuenta'
  return Array.from(types).join(', ')
}

function getFormasDePago(reqs: Req[]) {
  const c = new Set<string>()
  reqs.forEach(r => {
    if (r.paymentChannel === 'QR') c.add('QR')
    if (r.paymentChannel === 'NFC') c.add('Sin contacto (NFC)')
    if (r.paymentChannel === 'TRANSFERENCIA') c.add('Transferencia')
    if (r.paymentChannel === 'DINERO_EN_CUENTA') c.add('Dinero en Cuenta')
    if (r.paymentChannel === 'TARJETA_FISICA') c.add('Física')
  })
  return c.size > 0 ? Array.from(c).join(', ') : 'Cualquiera'
}

function getEntidades(reqs: Req[]) {
  const e = new Set<string>()
  reqs.forEach(r => {
    let name = ''
    if (r.bank) name = r.bank.name
    else if (r.wallet) name = r.wallet.name
    if (name && r.segment) name += ` (${r.segment})`
    if (name) e.add(name)
  })
  return e.size > 0 ? Array.from(e).join(' · ') : 'Todas'
}


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

function diasVigencia(p: Promo) {
  const parts = []

  // 1. Días de la semana o fechas específicas
  if (p.specificDates && parseDates(p.specificDates)) {
    parts.push(parseDates(p.specificDates))
  } else if (p.validDaysNote) {
    parts.push(p.validDaysNote)
  } else {
    parts.push(formatValidDays(p.validDays))
  }

  // 2. Fecha de vencimiento (si existe y no es hoy)
  if (p.validUntil) {
    const end = new Date(p.validUntil)
    const today = new Date()
    // Solo mostrar si vence en el futuro (no hoy mismo para no saturar)
    if (end.getDate() !== today.getDate() || end.getMonth() !== today.getMonth()) {
      parts.push(`Vence ${end.getDate()}/${end.getMonth() + 1}`)
    }
  }

  return parts.join(' · ')
}

function parseDates(jsonStr?: string | null) {
  if (!jsonStr) return null
  try {
    const arr = JSON.parse(jsonStr) as string[]
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map(d => {
        const dt = new Date(d + 'T12:00:00Z')
        const dia = DIAS[dt.getUTCDay()].slice(0, 3)
        return `${dia} ${dt.getUTCDate()}`
      }).join(', ')
    }
  } catch (e) { }
  return null
}

function getSpecialBadge(p: Promo) {
  if (!p.validFrom) return null
  const from = new Date(p.validFrom)
  const until = p.validUntil ? new Date(p.validUntil) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalizar hoy a inicio del día

  // Normalizar fechas para comparación de días
  const dFrom = new Date(from); dFrom.setHours(0, 0, 0, 0)
  const dUntil = until ? new Date(until) : null
  if (dUntil) dUntil.setHours(0, 0, 0, 0)

  // SOLO POR HOY: mismo día de inicio y fin, o termina hoy
  if (dUntil) {
    const isSameDay = dFrom.getTime() === dUntil.getTime()
    const endsToday = dUntil.getTime() === today.getTime()

    if (isSameDay || (endsToday && dFrom.getTime() <= today.getTime())) {
      return { text: '¡SOLO POR HOY!', color: 'bg-orange-500' }
    }

    // SOLO ESTE FIN DE SEMANA: incluye un sábado o domingo
    // Si dura pocos días y cae en finde
    const diffTime = Math.abs(dUntil.getTime() - dFrom.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (diffDays >= 1 && diffDays <= 4) {
      const dayFrom = from.getUTCDay()
      const dayUntil = until!.getUTCDay()
      // Si el rango cruza Sáb (6) o Dom (0)
      if (dayFrom === 0 || dayFrom === 6 || dayUntil === 0 || dayUntil === 6 || (dayFrom < 6 && dayUntil > dayFrom)) {
        return { text: '¡SOLO ESTE FIN DE SEMANA!', color: 'bg-indigo-600' }
      }
    }
  }
  return null
}

const CATEGORIAS_FILTER = ['Todos', 'Supermercados', 'Gastronomía', 'Transporte', 'Combustible', 'Farmacias', 'Petshops', 'Tecnología']

export default function Home() {
  const { data: session, status } = useSession()
  const nombre = session?.user?.name || 'Invitado'
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'
  const searchParams = useSearchParams()
  const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAccessDenied, setShowAccessDenied] = useState(
    searchParams.get('error') === 'no-autorizado'
  )

  const categoriaParam = searchParams.get('categoria')
  const [catFilter, setCatFilter] = useState('Todos')
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null)

  // ── Filtros Avanzados ──
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [entities, setEntities] = useState({ banks: [], wallets: [], cardNetworks: [] })
  const initialFilters: FilterState = {
    banks: [], wallets: [], networks: [], days: [], channels: [],
    hasCap: null, capMin: null, capMax: null, capPeriods: []
  }
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters)
  const [forMe, setForMe] = useState(status === 'authenticated')
  const [timeFilter, setTimeFilter] = useState<'today' | 'week'>('today')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (status === 'authenticated') setForMe(true)
    else setForMe(false)
  }, [status])

  useEffect(() => {
    async function fetchEntities() {
      try {
        const r = await fetch('/api/public/entities')
        if (r.ok) {
          const data = await r.json()
          if (data.banks) setEntities(data)
        }
      } catch (err) {
        console.error('Error fetching entities:', err)
      }
    }
    fetchEntities()
  }, [])


  useEffect(() => {
    if (categoriaParam) {
      const match = CATEGORIAS_FILTER.find(
        c => c.toLowerCase().replace(/[áàä]/g, 'a').replace(/[íì]/g, 'i')
          .replace(/[óò]/g, 'o').replace(/[úùü]/g, 'u') === categoriaParam.toLowerCase()
          || c.toLowerCase() === categoriaParam.toLowerCase()
      )
      if (match) setCatFilter(match)
    }
  }, [categoriaParam])

  useEffect(() => {
    if (status === 'loading') return;

    async function load() {
      setLoading(true)
      try {
        const headers: HeadersInit = {}

        const qParams = new URLSearchParams()
        qParams.set('for_me', String(forMe))
        qParams.set('view', timeFilter)
        if (catFilter !== 'Todos') qParams.set('category', catFilter.toLowerCase())
        if (activeFilters.banks.length) qParams.set('banks', activeFilters.banks.join(','))
        if (activeFilters.wallets.length) qParams.set('wallets', activeFilters.wallets.join(','))
        if (activeFilters.networks.length) qParams.set('networks', activeFilters.networks.join(','))
        if (activeFilters.days.length) qParams.set('days', activeFilters.days.join(','))
        if (activeFilters.channels.length) qParams.set('channels', activeFilters.channels.join(','))
        if (activeFilters.capPeriods.length) qParams.set('capPeriods', activeFilters.capPeriods.join(','))
        if (activeFilters.hasCap !== null) qParams.set('hasCap', String(activeFilters.hasCap))
        if (activeFilters.capMin !== null) qParams.set('capMin', String(activeFilters.capMin))
        if (activeFilters.capMax !== null) qParams.set('capMax', String(activeFilters.capMax))

        const res = await fetch(`/api/promos?${qParams.toString()}`, {
          headers,
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          setPromos(data.promos)
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session?.user?.email, status, catFilter, activeFilters, forMe])

  // Helper para mostrar los chips de "camino de migas"
  const getFilterChips = () => {
    const chips: { id: string, label: string, type: keyof FilterState }[] = []

    activeFilters.banks.forEach(id => {
      const b: any = entities.banks.find((x: any) => x.id === id)
      if (b) chips.push({ id, label: `Banco: ${b.name}`, type: 'banks' })
    })
    activeFilters.wallets.forEach(id => {
      const w: any = entities.wallets.find((x: any) => x.id === id)
      if (w) chips.push({ id, label: `Billetera: ${w.name}`, type: 'wallets' })
    })
    activeFilters.networks.forEach(id => {
      const cn: any = entities.cardNetworks.find((x: any) => x.id === id)
      if (cn) chips.push({ id, label: cn.name, type: 'networks' })
    })
    activeFilters.days.forEach(d => {
      chips.push({ id: String(d), label: DIAS_SHORT[d], type: 'days' })
    })
    activeFilters.channels.forEach(ch => {
      chips.push({ id: ch, label: ch === 'TARJETA_FISICA' ? 'Físico' : ch, type: 'channels' })
    })
    if (activeFilters.hasCap !== null) {
      chips.push({ id: 'hasCap', label: activeFilters.hasCap ? 'Con Tope' : 'Sin Tope', type: 'hasCap' as any })
    }
    if (activeFilters.capMin || activeFilters.capMax) {
      chips.push({ id: 'range', label: `$${activeFilters.capMin || 0} - $${activeFilters.capMax || '∞'}`, type: 'capMin' as any })
    }

    return chips
  }

  const removeFilter = (id: string, type: string) => {
    setActiveFilters(prev => {
      if (type === 'hasCap') return { ...prev, hasCap: null }
      if (type === 'capMin' || type === 'capMax') return { ...prev, capMin: null, capMax: null }
      const list = (prev as any)[type] as any[]
      return { ...prev, [type]: list.filter(item => String(item) !== id) }
    })
  }

  const promosFiltradas = promos // Ya vienen filtradas del backend por los useEffect dependencies

  const toggleSave = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session?.user?.email) return

    setPromos(prev => prev.map(p => p.id === id ? { ...p, isSaved: !p.isSaved } : p))
    try {
      const res = await fetch(`/api/promos/${id}/save`, {
        method: 'POST',
      })
      if (!res.ok) {
        setPromos(prev => prev.map(p => p.id === id ? { ...p, isSaved: !p.isSaved } : p))
      }
    } catch {
      setPromos(prev => prev.map(p => p.id === id ? { ...p, isSaved: !p.isSaved } : p))
    }
  }


  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top bar sticky */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100/60 sticky top-0 z-20 shadow-sm shadow-black/[0.02]">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium tracking-tight">Hola, {nombre.split(' ')[0]} 👋</p>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 mt-0.5">
                {timeFilter === 'today' ? 'Tus promos hoy' : 'Catálogo Semanal'}
              </h1>
            </div>
            {status === 'unauthenticated' ? (
              <a
                href="/login"
                className="bg-indigo-600 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
              >
                Iniciar sesión
              </a>
            ) : (
              <div className="bg-green-50/80 border border-green-100 px-3 py-1.5 rounded-xl shadow-sm text-center">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                  <Calendar size={13} className="mb-[1px]" />
                  {fechaHoy().split(' de ')[0]}
                </div>
              </div>
            )}
          </div>

          {/* Selector Mis Promos vs Todas */}
          <div className="mt-5 flex p-1 bg-gray-100/80 rounded-2xl w-full max-w-sm mx-auto shadow-inner relative">
            <button
              onClick={() => {
                if (status === 'unauthenticated') {
                  // Pequeño aviso o simplemente no cambiar si es guest, pero mejor mostrar "Todo" por defecto
                  window.location.href = '/login'
                  return
                }
                setForMe(true)
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[14px] text-xs font-bold transition-all ${forMe
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Sparkles size={14} className={forMe ? 'text-indigo-500' : 'text-gray-400'} />
              Mis promos
              {status === 'unauthenticated' && <span className="absolute -top-2 -right-1 bg-amber-400 text-[8px] text-white px-1.5 py-0.5 rounded-full shadow-sm">Login</span>}
            </button>
            <button
              onClick={() => setForMe(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[14px] text-xs font-bold transition-all ${!forMe
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Globe size={14} className={!forMe ? 'text-indigo-500' : 'text-gray-400'} />
              Todas las promos
            </button>
          </div>

          {/* Selector Hoy vs Semana */}
          <div className="mt-4 flex gap-2">
            {(['today', 'week'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${timeFilter === f
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-gray-100 text-gray-400'
                  }`}
              >
                {f === 'today' ? 'Solo Hoy' : 'Toda la semana'}
              </button>
            ))}
          </div>
          {/* Botón de vista Grid / List */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Categorias y Filtro */}
        <div className="flex gap-2.5 px-5 py-3 overflow-x-auto scrollbar-hide items-center">
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-bold text-xs transition-all shrink-0 ${getFilterChips().length > 0
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105'
                : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
              }`}
          >
            <SlidersHorizontal size={14} />
            Filtros {getFilterChips().length > 0 && `(${getFilterChips().length})`}
          </button>

          <div className="w-[1px] h-4 bg-gray-200 mx-1 shrink-0"></div>

          {CATEGORIAS_FILTER.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`whitespace-nowrap text-xs px-3.5 py-1.5 rounded-2xl border font-semibold transition-all ${catFilter === cat
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                }`}
            >
              {cat}
            </button>
          ))}
          <div className="w-2 shrink-0"></div>
        </div>

        {/* Chips de Filtros Activos (Camino de Migas) */}
        <ActiveFilters
          filters={getFilterChips()}
          onRemove={removeFilter}
          onClearAll={() => setActiveFilters(initialFilters)}
        />
      </div>

      <div className="px-4 py-4 pb-28 max-w-lg mx-auto">

        {/* Banner acceso denegado */}
        {showAccessDenied && (
          <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-sm text-red-700 font-medium">Acceso restringido para esa área.</p>
            <button onClick={() => setShowAccessDenied(false)} className="text-red-400 hover:text-red-500 bg-white p-1 rounded-full shadow-sm ml-3">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Link a admin (solo admins) */}
        {isAdmin && (
          <div className="mb-5">
            <a
              href="/admin"
              className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-2xl p-4 shadow-sm group hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm text-amber-600">
                  <Settings size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Panel Admin</p>
                  <p className="text-xs text-amber-700/80 mt-0.5">Gestionar comercios y promos</p>
                </div>
              </div>
              <span className="text-sm text-amber-500 bg-white p-1.5 rounded-full shadow-sm group-hover:scale-110 transition-transform">→</span>
            </a>
          </div>
        )}

        {/* Skeletons Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-3xl p-5 animate-pulse shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-2">
                    <div className="h-5 bg-gray-100 rounded-lg w-32" />
                    <div className="h-4 bg-gray-50 rounded-lg w-48" />
                  </div>
                  <div className="h-8 bg-green-50 rounded-xl w-16" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-50 rounded-lg w-20" />
                  <div className="h-6 bg-gray-50 rounded-lg w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && promosFiltradas.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-300">
              <Search size={32} />
            </div>
            <p className="text-gray-900 font-medium font-poppins">No encontramos promos en {catFilter}</p>
            <p className="text-sm text-gray-500 mt-2 max-w-[250px] mx-auto">Podes crear nuevas promociones desde el panel de administrador o probar otra categoría.</p>
          </div>
        )}

        {/* Promos */}
        <div className={viewMode === 'grid' ? 'space-y-4' : 'space-y-3'}>
          {promosFiltradas.map(promo => {
            if (viewMode === 'list') {
              return (
                <div key={promo.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-gray-900 truncate uppercase">{promo.commerce.name}</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="text-[10px] text-gray-500 truncate">{getEntidades(promo.requirements)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-indigo-600">{discountLabel(promo)}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded font-medium border border-gray-100">
                        {diasVigencia(promo).split('·')[0].trim()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 opacity-80">
                      <span className="text-[9px] font-bold text-gray-500 flex items-center gap-1"><Tag size={9} /> {capLabel(promo)}</span>
                      {maxDiscountReq(promo)?.minPurchase && (
                        <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1">Mín: ${maxDiscountReq(promo)!.minPurchase!.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPromo(promo)}
                    className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 border border-gray-100 transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                </div>
              )
            }

            return (
              <div key={promo.id}
                onClick={() => setSelectedPromo(promo)}
                className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group relative">

                <div className="p-5">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: promo.category.color + '15', color: promo.category.color }}
                        >
                          {promo.category.name}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                          <Clock size={10} />
                          {diasVigencia(promo)}
                        </div>
                      </div>
                      {getSpecialBadge(promo) && (
                        <div className={`${getSpecialBadge(promo)!.color} text-white text-[9px] font-black px-2 py-1 rounded-lg w-fit mb-2 animate-pulse shadow-sm`}>
                          {getSpecialBadge(promo)!.text}
                        </div>
                      )}
                      {timeFilter === 'week' && (promo.validDays & (1 << new Date().getDay())) === 0 && (
                        <div className="bg-gray-100 text-gray-400 text-[9px] font-bold px-2 py-1 rounded-lg w-fit mb-2 border border-gray-200 uppercase">
                          No disponible hoy
                        </div>
                      )}
                      <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">
                        {promo.commerce.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{promo.description}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={(e) => toggleSave(promo.id, e)}
                        className="p-1.5 focus:outline-none hover:bg-gray-50 rounded-full transition-colors active:scale-90"
                      >
                        <Heart
                          size={18}
                          className={promo.isSaved ? 'text-red-500 fill-red-500' : 'text-gray-300'}
                        />
                      </button>
                      <div className={`shadow-sm text-white rounded-2xl px-3 py-1.5 flex flex-col items-center justify-center min-w-[64px] ${promo.userBestDiscount
                          ? 'bg-indigo-600 shadow-indigo-100'
                          : 'bg-green-500 shadow-green-100'
                        }`}>
                        <span className="text-lg font-bold tracking-tight">
                          {discountLabel(promo)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid Exacta (Puntos solicitados) */}
                  <div className="mt-4 pt-3 border-t border-gray-50 space-y-1.5">
                    {(maxDiscountReq(promo)?.cap || maxDiscountReq(promo)?.minPurchase) && (
                      <div className="flex justify-between items-center bg-gray-50/50 rounded-lg px-2.5 py-1.5">
                        {maxDiscountReq(promo)?.cap && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-gray-400 font-medium">Tope:</span>
                            <span className="font-bold text-gray-800">{capLabel(promo)}</span>
                          </div>
                        )}
                        {maxDiscountReq(promo)?.minPurchase && (
                          <div className="flex items-center gap-1.5 text-[11px] border-l border-gray-200 pl-2">
                            <span className="text-gray-400 font-medium">Mínimo:</span>
                            <span className="font-bold text-gray-800">${maxDiscountReq(promo)!.minPurchase!.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Tarjetas</span>
                      <span className="text-[11px] font-bold text-gray-700">{getMediosDePago(promo.requirements)}</span>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Forma</span>
                      <span className="text-[11px] font-bold text-gray-700">{getFormasDePago(promo.requirements)}</span>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Bancos/Casos</span>
                      <span className="text-[11px] font-bold text-indigo-700 max-w-[60%] truncate text-right">{getEntidades(promo.requirements)}</span>
                    </div>
                  </div>

                  {/* Footer badge user */}
                  <div className="mt-3 flex justify-end">
                    {promo.userBestDiscount && (
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 uppercase tracking-tighter">
                        ★ Beneficio para vos
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════════ PROMO DETAIL MODAL / DRAWER ══════════ */}
      {selectedPromo && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPromo(null)} />
          <div className="relative bg-white rounded-t-[40px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">

            {/* Header / Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>

            <div className="px-6 pb-8 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: selectedPromo.category.color + '15', color: selectedPromo.category.color }}>
                      {selectedPromo.category.name}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">{selectedPromo.commerce.name}</h2>
                  <p className="text-gray-500 mt-1">{selectedPromo.title !== selectedPromo.commerce.name ? selectedPromo.title : 'Promoción'}</p>
                  {selectedPromo.validUntil && (
                    <p className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md w-fit mt-1 uppercase">
                      Válido hasta el {new Date(selectedPromo.validUntil).toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPromo(null)}
                  className="bg-gray-100 p-2.5 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Banner de descuento principal en detalle */}
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white mb-8 shadow-xl shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">
                    {selectedPromo.userBestDiscount ? 'TU MEJOR BENEFICIO' : 'DESCUENTO MÁXIMO'}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-4xl font-extrabold tracking-tighter">{discountLabel(selectedPromo)}</h3>
                    {maxDiscountReq(selectedPromo)?.discountType.includes('PERCENTAGE') && <span className="text-lg font-bold opacity-80">OFF</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/20">
                      <Tag size={12} /> Tope: {capLabel(selectedPromo)}
                    </div>
                    {maxDiscountReq(selectedPromo)?.minPurchase && (
                      <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/20">
                        <Info size={12} /> Mínimo: ${maxDiscountReq(selectedPromo)!.minPurchase!.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <Sparkles size={100} className="absolute -right-8 -bottom-8 text-white/10 rotate-12" />
              </div>

              {/* Descripción */}
              <div className="mb-8">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Sobre esta promo</h4>
                <p className="text-gray-600 leading-relaxed text-sm">{selectedPromo.description}</p>
              </div>

              {/* Todos los tiers / requisitos */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Variantes de descuentos</h4>
                <div className="space-y-3">
                  {selectedPromo.requirements.map((r, idx) => {
                    // Helper para obtener el label del descuento
                    const getDiscountLabel = () => {
                      if (r.discountType === 'CUOTAS_SIN_INTERES') return `${r.discountValue} cuotas`
                      return `${r.discountValue}%`
                    }

                    // Helper para el subtipo
                    const getDiscountSubtype = () => {
                      if (r.discountType === 'CUOTAS_SIN_INTERES') return 'Sin interés'
                      return r.discountType === 'PERCENTAGE_REINTEGRO' ? 'Reintegro' : 'Directo'
                    }

                    return (
                      <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          {/* Banco/Wallet con tooltip */}
                          <div className="relative group/bank inline-block">
                            <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              <span className="flex items-center gap-1.5">
                                {r.bank && <span className="text-xs">🏦</span>}
                                {r.wallet && !r.bank && <span className="text-xs">📱</span>}
                                {r.bank?.name || r.wallet?.name || 'Cualquier entidad'}
                              </span>
                              {r.segment && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] uppercase tracking-wider rounded-md">{r.segment}</span>}
                            </p>

                            {/* Tooltip para banco/wallet */}
                            {(r.bank || r.wallet) && (
                              <div className="absolute left-0 top-full mt-1 hidden group-hover/bank:block z-50 w-max">
                                <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                  <div className="font-bold mb-1">{r.bank?.name || r.wallet?.name}</div>
                                  <div className="text-gray-300">
                                    {r.bank && 'Banco emisor'}
                                    {r.wallet && !r.bank && 'Billetera digital'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tarjeta con tooltips individuales */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            {/* Red de tarjeta con tooltip */}
                            <div className="relative group/network inline-block">
                              <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 cursor-help">
                                {r.cardNetwork?.name === 'Visa' && <span className="text-blue-600">💳</span>}
                                {r.cardNetwork?.name === 'Mastercard' && <span className="text-red-600">💳</span>}
                                {r.cardNetwork?.name === 'American Express' && <span className="text-blue-400">💳</span>}
                                {!r.cardNetwork && <span className="text-gray-400">💳</span>}
                                {r.cardNetwork?.name || 'Cualquier tarjeta'}
                              </span>

                              {/* Tooltip para red */}
                              {r.cardNetwork && (
                                <div className="absolute left-0 top-full mt-1 hidden group-hover/network:block z-50 w-max">
                                  <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                    <div className="font-bold mb-1">{r.cardNetwork.name}</div>
                                    <div className="text-gray-300">Red de tarjeta</div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <span className="text-[10px] text-gray-300">•</span>

                            {/* Tipo de tarjeta con tooltip */}
                            <div className="relative group/type inline-block">
                              <span className="text-[10px] text-gray-500 font-medium cursor-help">
                                {r.cardType === 'CREDIT' ? '💰 Crédito' : r.cardType === 'DEBIT' ? '🏧 Débito' : r.cardType === 'PREPAID' ? '🎟️ Prepaga' : 'Cualquier tipo'}
                              </span>

                              {/* Tooltip para tipo */}
                              {r.cardType && (
                                <div className="absolute left-0 top-full mt-1 hidden group-hover/type:block z-50 w-max">
                                  <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                    <div className="font-bold mb-1">
                                      {r.cardType === 'CREDIT' ? 'Tarjeta de Crédito' : r.cardType === 'DEBIT' ? 'Tarjeta de Débito' : 'Tarjeta Prepaga'}
                                    </div>
                                    <div className="text-gray-300">Tipo de tarjeta requerida</div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Payment channel */}
                            {r.paymentChannel && r.paymentChannel !== 'ANY' && (
                              <>
                                <span className="text-[10px] text-gray-300">•</span>
                                <div className="relative group/channel inline-block">
                                  <span className="text-[10px] text-gray-500 font-medium cursor-help">
                                    {r.paymentChannel === 'PHYSICAL' ? '💳 Física' : '📱 Digital'}
                                  </span>

                                  {/* Tooltip para canal */}
                                  <div className="absolute left-0 top-full mt-1 hidden group-hover/channel:block z-50 w-max">
                                    <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                      <div className="font-bold mb-1">
                                        {r.paymentChannel === 'PHYSICAL' ? 'Tarjeta Física' : 'Tarjeta Digital'}
                                      </div>
                                      <div className="text-gray-300">
                                        {r.paymentChannel === 'PHYSICAL' ? 'Requiere tarjeta plástica' : 'Admite tarjeta virtual'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {r.note && <p className="text-[10px] text-indigo-500 font-bold mt-1.5 uppercase leading-none">⚠️ {r.note}</p>}
                        </div>

                        {/* Descuento */}
                        <div className="text-right shrink-0">
                          <p className="text-lg font-extrabold text-indigo-600">{getDiscountLabel()}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{getDiscountSubtype()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Otros detalles */}
              <div className="space-y-5 mb-8 bg-gray-50 p-5 rounded-3xl border border-gray-100">
                <div className="flex flex-col gap-1">
                  <h5 className="font-bold text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2"><Calendar size={14} className="text-indigo-500" /> Días de Aplicación</h5>
                  <p className="text-sm text-gray-700">{diasVigencia(selectedPromo)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <h5 className="font-bold text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2"><Smartphone size={14} className="text-indigo-500" /> Forma de Pago Admitida</h5>
                  <p className="text-sm text-gray-700">{getFormasDePago(selectedPromo.requirements)}</p>
                </div>
                {(selectedPromo.stackable || selectedPromo.uniqueUsePerPeriod) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200/60">
                    {selectedPromo.stackable && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">✔ Es Acumulable</span>}
                    {selectedPromo.uniqueUsePerPeriod && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded">⚠️ Uso Único Requerido</span>}
                  </div>
                )}
              </div>

              {/* Texto Legal Completo */}
              {selectedPromo.sourceText && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Detalle de las condiciones</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-h-[300px] overflow-y-auto">
                    <p className="text-[11px] leading-relaxed text-gray-500 whitespace-pre-wrap font-mono relative">
                      {selectedPromo.sourceText}
                    </p>
                  </div>
                  {selectedPromo.sourceUrl && (
                    <a href={selectedPromo.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-500 hover:underline mt-2 inline-block font-bold">Ver términos legales originales ↗</a>
                  )}
                </div>
              )}

              {/* Footnote backend record */}
              <div className="mt-10 pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">PromoAR Match Engine ID: {selectedPromo.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        entities={entities}
        currentFilters={activeFilters}
        onApply={(f) => {
          setActiveFilters(f)
          setIsFilterOpen(false)
        }}
      />
    </div>
  )
}