'use client'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Calendar, Tag, CreditCard, Settings, X, Search, Sparkles, Filter, Heart, ChevronRight, Info, Smartphone, Building2, Clock, Globe, SlidersHorizontal, HelpCircle } from 'lucide-react'
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
  nxmN?: number | null
  nxmM?: number | null
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
  validDays: number
  validDaysNote?: string | null
  specificDates?: string | null
  category: { name: string; color: string }
  commerce: { name: string }
  requirements: Req[]
  validFrom: string
  validUntil: string | null
  sourceUrl?: string | null
  sourceText?: string | null
  isSaved?: boolean
  globalMaxDiscount?: Req | null
  userBestDiscount?: Req | null
}

const CAP_LABELS: Record<string, string> = {
  PER_TRANSACTION: 'por trx.',
  DAILY: 'por día',
  WEEKLY: 'por sem.',
  MONTHLY: 'por mes',
  TOTAL: 'total',
}

// ══════════════════════════════════════════════════════════════
// MEJORA 1: Extraer redes de tarjeta únicas
// ══════════════════════════════════════════════════════════════
function getCardNetworks(reqs: Req[]): string[] {
  const networks = new Set<string>()
  reqs.forEach(r => {
    if (r.cardNetwork?.name) {
      networks.add(r.cardNetwork.name)
    }
  })
  return Array.from(networks)
}

// Iconos de redes (SVG inline para mejor performance)
const CardNetworkIcon = ({ network }: { network: string }) => {
  const lowerNetwork = network.toLowerCase()

  if (lowerNetwork.includes('visa')) {
    return (
      <div className="w-8 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold">
        VISA
      </div>
    )
  }

  if (lowerNetwork.includes('master')) {
    return (
      <div className="w-8 h-6 bg-red-500 rounded flex items-center justify-center">
        <div className="flex -space-x-1">
          <div className="w-2.5 h-2.5 bg-red-600 rounded-full" />
          <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
        </div>
      </div>
    )
  }

  if (lowerNetwork.includes('amex') || lowerNetwork.includes('american')) {
    return (
      <div className="w-8 h-6 bg-blue-400 rounded flex items-center justify-center text-white text-[8px] font-bold">
        AMEX
      </div>
    )
  }

  // Default genérico
  return (
    <div className="w-8 h-6 bg-gray-300 rounded flex items-center justify-center text-gray-600 text-[8px] font-bold">
      {network.substring(0, 3).toUpperCase()}
    </div>
  )
}

function maxDiscountReq(p: Promo): Req | null {
  if (p.userBestDiscount) return p.userBestDiscount
  if (p.globalMaxDiscount) return p.globalMaxDiscount
  if (!p.requirements.length) return null
  return p.requirements.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), p.requirements[0])
}

// ══════════════════════════════════════════════════════════════
// MEJORA 2: Descuentos más claros (6% vs 6 CSI vs NxM)
// ══════════════════════════════════════════════════════════════
function discountLabel(p: Promo) {
  const req = maxDiscountReq(p)
  if (!req) return ''

  const isPersonalized = !!p.userBestDiscount
  const isMaxTier = isPersonalized && p.globalMaxDiscount &&
    (p.userBestDiscount?.discountValue ?? 0) >= (p.globalMaxDiscount?.discountValue ?? 0)
  const prefix = !isPersonalized || (!isMaxTier && p.requirements.length > 1) ? 'Hasta ' : ''
  const val = req.discountValue ?? 0

  // NxM (ej: 3x2, 6 cuotas sin interés)
  if (req.discountType === 'NXM' && req.nxmN && req.nxmM) {
    if (req.nxmN === req.nxmM) {
      // Cuotas sin interés
      return `${prefix}${req.nxmN} CSI`
    }
    // NxM clásico
    return `${prefix}${req.nxmN}×${req.nxmM}`
  }

  // Porcentajes
  if (req.discountType === 'PERCENTAGE_REINTEGRO' || req.discountType === 'PERCENTAGE_DESCUENTO') {
    return `${prefix}${val}%`
  }

  // Bonificación
  if (req.discountType === 'BONIFICACION') {
    return `${prefix}${val}% BONIF.`
  }

  // Monto fijo
  if (req.discountType === 'FIXED_AMOUNT') {
    return `${prefix}$${val.toLocaleString('es-AR')}`
  }

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

  if (p.specificDates && parseDates(p.specificDates)) {
    parts.push(parseDates(p.specificDates))
  } else if (p.validDaysNote) {
    parts.push(p.validDaysNote)
  } else {
    parts.push(formatValidDays(p.validDays))
  }

  if (p.validUntil) {
    const end = new Date(p.validUntil)
    const today = new Date()
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
        const dt = new Date(d)
        return `${dt.getDate()}/${dt.getMonth() + 1}`
      }).join(', ')
    }
  } catch { }
  return null
}

// ══════════════════════════════════════════════════════════════
// MEJORA 3: Obtener mínimo de compra
// ══════════════════════════════════════════════════════════════
function getMinPurchase(p: Promo): number | null {
  const req = maxDiscountReq(p)
  return req?.minPurchase || null
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'
  const [promos, setPromos] = useState<Promo[]>([])
  const [filteredPromos, setFilteredPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [entities, setEntities] = useState<{ banks: any[]; wallets: any[]; cardNetworks: any[] }>({ banks: [], wallets: [], cardNetworks: [] })
  const [forMe, setForMe] = useState(status === 'authenticated')
  const [timeFilter, setTimeFilter] = useState<'today' | 'week'>('today')
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    banks: [],
    wallets: [],
    networks: [],
    days: [],
    channels: [],
    hasCap: null,
    capMin: null,
    capMax: null,
    capPeriods: [],
    commerces: [],
    discountRanges: [],
    hasInstallments: null,
  })

  useEffect(() => {
    if (status === 'authenticated') setForMe(true)
    else setForMe(false)
  }, [status])

  useEffect(() => {
    async function loadData() {
      try {
        const [promosRes, entitiesRes] = await Promise.all([
          fetch('/api/promos'),
          fetch('/api/public/entities')
        ])

        if (promosRes.ok) {
          const promosData = await promosRes.json()
          setPromos(promosData.promos || [])
          setFilteredPromos(promosData.promos || [])
        }

        if (entitiesRes.ok) {
          const entitiesData = await entitiesRes.json()
          setEntities(entitiesData)
        }

        const catParam = searchParams.get('categoria')
        if (catParam) setActiveCategory(catParam)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [searchParams])

  useEffect(() => {
    let result = promos

    if (activeCategory) {
      result = result.filter(p => p.category.name === activeCategory)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.commerce.name.toLowerCase().includes(q) ||
        p.category.name.toLowerCase().includes(q)
      )
    }

    if (activeFilters.banks.length > 0 || activeFilters.wallets.length > 0) {
      result = result.filter(p =>
        p.requirements.some(r =>
          (r.bank && activeFilters.banks.includes(r.bank.id!)) ||
          (r.wallet && activeFilters.wallets.includes(r.wallet.id!))
        )
      )
    }

    if (activeFilters.networks.length > 0) {
      result = result.filter(p =>
        p.requirements.some(r =>
          r.cardNetwork && activeFilters.networks.includes(r.cardNetwork.id!)
        )
      )
    }

    if (activeFilters.days.length > 0) {
      result = result.filter(p => {
        return activeFilters.days.some(d => (p.validDays & (1 << d)) !== 0)
      })
    }

    if (activeFilters.channels.length > 0) {
      result = result.filter(p =>
        p.requirements.some(r =>
          r.paymentChannel && activeFilters.channels.includes(r.paymentChannel)
        )
      )
    }

    if (activeFilters.hasCap !== null) {
      result = result.filter(p => {
        const req = maxDiscountReq(p)
        const hasCap = !!req?.cap
        return hasCap === activeFilters.hasCap
      })
    }

    if (activeFilters.capMin !== null || activeFilters.capMax !== null) {
      result = result.filter(p => {
        const req = maxDiscountReq(p)
        const cap = req?.cap || 0
        if (activeFilters.capMin && cap < activeFilters.capMin) return false
        if (activeFilters.capMax && cap > activeFilters.capMax) return false
        return true
      })
    }

    if (activeFilters.capPeriods.length > 0) {
      result = result.filter(p => {
        const req = maxDiscountReq(p)
        return req?.capPeriod && activeFilters.capPeriods.includes(req.capPeriod)
      })
    }

    // NUEVO: Filtro de comercios
    if (activeFilters.commerces && activeFilters.commerces.length > 0) {
      result = result.filter(p =>
        activeFilters.commerces!.includes(p.commerce.name)
      )
    }

    // NUEVO: Filtro de rangos de descuento
    if (activeFilters.discountRanges && activeFilters.discountRanges.length > 0) {
      result = result.filter(p => {
        const req = maxDiscountReq(p)
        const discount = req?.discountValue || 0
        return activeFilters.discountRanges!.some(range => {
          if (range === '0-10') return discount >= 0 && discount < 10
          if (range === '10-20') return discount >= 10 && discount < 20
          if (range === '20-30') return discount >= 20 && discount < 30
          if (range === '30+') return discount >= 30
          return false
        })
      })
    }

    // NUEVO: Filtro de cuotas sin interés
    if (activeFilters.hasInstallments !== null) {
      result = result.filter(p => {
        const hasCSI = p.requirements.some(r =>
          r.discountType === 'NXM' && r.nxmN && r.nxmM && r.nxmN === r.nxmM
        )
        return hasCSI === activeFilters.hasInstallments
      })
    }

    setFilteredPromos(result)
  }, [promos, activeCategory, searchQuery, activeFilters])

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
      chips.push({ id: String(d), label: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d], type: 'days' })
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
    // NUEVOS FILTROS
    if (activeFilters.commerces) {
      activeFilters.commerces.forEach(c => {
        chips.push({ id: c, label: c, type: 'commerces' })
      })
    }
    if (activeFilters.discountRanges) {
      activeFilters.discountRanges.forEach(r => {
        const labels: any = { '0-10': '0-10%', '10-20': '10-20%', '20-30': '20-30%', '30+': '30%+' }
        chips.push({ id: r, label: labels[r] || r, type: 'discountRanges' })
      })
    }
    if (activeFilters.hasInstallments !== null) {
      chips.push({ id: 'hasInstallments', label: activeFilters.hasInstallments ? 'Con CSI' : 'Sin CSI', type: 'hasInstallments' as any })
    }

    return chips
  }

  const removeFilter = (id: string, type: string) => {
    setActiveFilters(prev => {
      if (type === 'hasCap') return { ...prev, hasCap: null }
      if (type === 'hasInstallments') return { ...prev, hasInstallments: null }
      if (type === 'capMin' || type === 'capMax') return { ...prev, capMin: null, capMax: null }
      const list = (prev as any)[type] as any[]
      return { ...prev, [type]: list.filter((item: any) => String(item) !== id) }
    })
  }

  const categories = Array.from(new Set(promos.map(p => p.category.name)))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">Cargando promociones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">PromoAR</h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">{fechaHoy()}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFilterOpen(true)}
                className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors relative"
              >
                <Filter size={20} />
                {(activeFilters.banks.length + activeFilters.wallets.length + activeFilters.networks.length + activeFilters.days.length + activeFilters.channels.length + activeFilters.capPeriods.length + (activeFilters.commerces?.length || 0) + (activeFilters.discountRanges?.length || 0)) > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {activeFilters.banks.length + activeFilters.wallets.length + activeFilters.networks.length + activeFilters.days.length + activeFilters.channels.length + activeFilters.capPeriods.length + (activeFilters.commerces?.length || 0) + (activeFilters.discountRanges?.length || 0)}
                    </span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar promos, comercios, categorías..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
            />
          </div>

          {/* Toggle Mis Promos / Todas */}
          <div className="flex bg-slate-100 rounded-2xl p-1 mb-3">
            <button
              onClick={() => {
                if (status === 'unauthenticated') {
                  window.location.href = '/login'
                } else {
                  setForMe(true)
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all relative ${forMe
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Sparkles size={14} className={forMe ? 'text-indigo-500' : 'text-slate-400'} />
              Mis promos
              {status === 'unauthenticated' && <span className="absolute -top-2 -right-1 bg-amber-400 text-[8px] text-white px-1.5 py-0.5 rounded-full shadow-sm">Login</span>}
            </button>
            <button
              onClick={() => setForMe(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${!forMe
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Globe size={14} className={!forMe ? 'text-indigo-500' : 'text-slate-400'} />
              Todas las promos
            </button>
          </div>

          {/* Toggle Hoy / Semana */}
          <div className="flex gap-2 mb-4">
            {(['today', 'week'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${timeFilter === f
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-slate-100 text-slate-400'
                  }`}
              >
                <Clock size={12} className="inline mr-1" />
                {f === 'today' ? 'Solo Hoy' : 'Toda la semana'}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-7xl mx-auto px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === null
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters */}
      <ActiveFilters
        filters={getFilterChips()}
        onRemove={removeFilter}
        onClearAll={() => setActiveFilters({
          banks: [],
          wallets: [],
          networks: [],
          days: [],
          channels: [],
          hasCap: null,
          capMin: null,
          capMax: null,
          capPeriods: [],
          commerces: [],
          discountRanges: [],
          hasInstallments: null,
        })}
      />

      {/* Link a admin (solo admins) */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <a
            href="/admin"
            className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-2xl p-4 shadow-sm group hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-xl shadow-sm text-amber-600">
                <Settings size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Panel Admin</p>
                <p className="text-xs text-amber-700/80 mt-0.5">Gestionar comercios y promos</p>
              </div>
            </div>
            <span className="text-sm text-amber-500 bg-white p-1.5 rounded-full shadow-sm group-hover:scale-110 transition-transform">→</span>
          </a>
        </div>
      )}

      {/* Promos Grid */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-slate-600">
            {filteredPromos.length} {filteredPromos.length === 1 ? 'promoción' : 'promociones'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPromos.map(promo => {
            const networks = getCardNetworks(promo.requirements)
            const minPurchase = getMinPurchase(promo)

            return (
              <div
                key={promo.id}
                onClick={() => setSelectedPromo(promo)}
                className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-xl border border-slate-100 cursor-pointer transition-all hover:-translate-y-1 group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: promo.category.color + '15', color: promo.category.color }}
                      >
                        {promo.category.name}
                      </span>
                      {promo.validUntil && (() => {
                        const end = new Date(promo.validUntil)
                        const today = new Date()
                        const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        if (daysLeft <= 7 && daysLeft > 0) {
                          return (
                            <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded uppercase">
                              Vence {daysLeft}d
                            </span>
                          )
                        }
                      })()}
                    </div>

                    {/* MEJORA 4: Título mejorado */}
                    <h3 className="font-bold text-slate-900 text-base leading-tight mb-1 line-clamp-2">
                      {promo.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold line-clamp-1">
                      {promo.commerce.name}
                    </p>
                  </div>

                  {/* Descuento Badge */}
                  <div className="shrink-0 ml-3">
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl px-3 py-2 shadow-lg shadow-indigo-200 min-w-[60px] text-center">
                      <p className="text-xl font-black leading-none tracking-tighter">
                        {discountLabel(promo).replace('Hasta ', '')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="space-y-2 text-xs">

                  {/* MEJORA 5: Mostrar redes de tarjeta con iconos */}
                  {networks.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wide">Tarjetas</span>
                      <div className="flex items-center gap-1 group/cards relative">
                        {networks.slice(0, 3).map((net, idx) => (
                          <div key={idx} className="relative">
                            <CardNetworkIcon network={net} />
                          </div>
                        ))}
                        {networks.length > 3 && (
                          <div className="w-8 h-6 bg-slate-200 rounded flex items-center justify-center text-slate-600 text-[9px] font-bold">
                            +{networks.length - 3}
                          </div>
                        )}

                        {/* Tooltip con todas las redes - solo si hay más de una */}
                        {networks.length > 1 && (
                          <div className="absolute bottom-full mb-2 right-0 hidden group-hover/cards:block z-10 animate-in fade-in slide-in-from-bottom-1 duration-200">
                            <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap text-[11px]">
                              {networks.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tipo de tarjeta */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wide">Tipo</span>
                    <span className="text-slate-700 font-semibold text-[11px]">{getMediosDePago(promo.requirements)}</span>
                  </div>

                  {/* Forma de pago */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wide">Forma</span>
                    <span className="text-slate-700 font-semibold text-[11px]">{getFormasDePago(promo.requirements)}</span>
                  </div>

                  {/* Bancos/Billeteras */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wide">Bancos/Casos</span>
                    <span className="text-indigo-600 font-bold text-[11px] line-clamp-1 text-right flex-1 ml-2">
                      {getEntidades(promo.requirements)}
                    </span>
                  </div>

                  {/* MEJORA 6: Mostrar mínimo de compra si existe */}
                  {minPurchase && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wide">Mínimo</span>
                      <span className="text-green-600 font-bold text-[11px]">
                        ${minPurchase.toLocaleString('es-AR')}
                      </span>
                    </div>
                  )}

                  {/* Tope */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wide flex items-center gap-1">
                      <Tag size={11} /> Tope
                    </span>
                    <span className="text-slate-700 font-bold text-[11px]">{capLabel(promo)}</span>
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
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">{selectedPromo.title}</h2>
                  <p className="text-gray-500 mt-1">{selectedPromo.commerce.name}</p>

                  {/* MEJORA 7: Fecha unificada */}
                  {selectedPromo.validUntil && (
                    <p className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md w-fit mt-2 uppercase">
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

              {/* Banner de descuento principal */}
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
                    {getMinPurchase(selectedPromo) && (
                      <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/20">
                        <Info size={12} /> Mínimo: ${getMinPurchase(selectedPromo)!.toLocaleString('es-AR')}
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

              {/* Medios de pago aceptados con iconos */}
              {getCardNetworks(selectedPromo.requirements).length > 0 && (
                <div className="mb-8">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Medios de pago</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {getCardNetworks(selectedPromo.requirements).map((network, idx) => {
                      const cardTypes = new Set<string>()
                      selectedPromo.requirements.forEach(r => {
                        if (r.cardNetwork?.name === network && r.cardType) {
                          cardTypes.add(r.cardType)
                        }
                      })

                      return (
                        <div key={idx} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <CardNetworkIcon network={network} />
                          <div className="flex-1">
                            <p className="font-bold text-sm text-slate-900">{network}</p>
                            <p className="text-[10px] text-slate-500">
                              {Array.from(cardTypes).map(t =>
                                t === 'CREDIT' ? 'Crédito' : t === 'DEBIT' ? 'Débito' : 'Prepaga'
                              ).join(', ')}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Todos los tiers */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Variantes de descuentos</h4>
                <div className="space-y-3">
                  {selectedPromo.requirements.map((r, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          {r.bank?.name || r.wallet?.name || 'Cualquier entidad'}
                          {r.segment && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] uppercase tracking-wider rounded-md">{r.segment}</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className="text-[10px] text-gray-500 font-medium">
                            {r.cardNetwork?.name || 'Cualquier tarjeta'}
                          </span>
                          <span className="text-[10px] text-gray-300">•</span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {r.cardType === 'CREDIT' ? 'Crédito' : r.cardType === 'DEBIT' ? 'Débito' : r.cardType === 'PREPAID' ? 'Prepaga' : 'Cualquier tipo'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-extrabold text-indigo-600">
                          {r.discountType === 'NXM' && r.nxmN && r.nxmM
                            ? (r.nxmN === r.nxmM ? `${r.nxmN} CSI` : `${r.nxmN}×${r.nxmM}`)
                            : `${r.discountValue}%`
                          }
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                          {r.discountType === 'PERCENTAGE_REINTEGRO' ? 'Reintegro' : r.discountType === 'NXM' ? 'Cuotas' : 'Directo'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Otros detalles */}
              <div className="space-y-5 mb-8 bg-gray-50 p-5 rounded-3xl border border-gray-100">
                <div className="flex flex-col gap-1">
                  <h5 className="font-bold text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2"><Calendar size={14} className="text-indigo-500" /> Días de Aplicación</h5>
                  <p className="text-sm text-gray-700">{diasVigencia(selectedPromo)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <h5 className="font-bold text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2"><CreditCard size={14} className="text-indigo-500" /> Tipo de Tarjeta</h5>
                  <p className="text-sm text-gray-700">{getMediosDePago(selectedPromo.requirements)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <h5 className="font-bold text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2"><Smartphone size={14} className="text-indigo-500" /> Forma de Pago</h5>
                  <p className="text-sm text-gray-700">{getFormasDePago(selectedPromo.requirements)}</p>
                </div>
                {(selectedPromo.stackable || selectedPromo.uniqueUsePerPeriod) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200/60">
                    {selectedPromo.stackable && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">✔ Es Acumulable</span>}
                    {selectedPromo.uniqueUsePerPeriod && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded">⚠️ Uso Único Requerido</span>}
                  </div>
                )}
              </div>

              {/* Link a promo original */}
              {selectedPromo.sourceUrl && (
                <div className="mb-6">
                  <a
                    href={selectedPromo.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Ver promo original <ChevronRight size={16} />
                  </a>
                </div>
              )}

              {/* Texto Legal Completo */}
              {selectedPromo.sourceText && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Detalle de las condiciones</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-h-[300px] overflow-y-auto">
                    <p className="text-[11px] leading-relaxed text-gray-500 whitespace-pre-wrap font-mono relative">
                      {selectedPromo.sourceText}
                    </p>
                  </div>
                </div>
              )}

              {/* Footnote */}
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
