'use client'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Calendar, Tag, Settings, X, Search, Sparkles, Heart, Info, Smartphone, Clock, Globe, SlidersHorizontal, LogIn } from 'lucide-react'
import BottomNav from './components/BottomNav'
import FilterDrawer, { FilterState } from './components/FilterDrawer'
import ActiveFilters from './components/ActiveFilters'
import CategorySheet from './components/CategorySheet'
import EntitiesSheet, { CARD_NETWORK_LOGOS } from './components/EntitiesSheet'
import PromoWizard, { GuestProfile } from './components/PromoWizard'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaHoy() {
  const hoy = new Date()
  return `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`
}

type Req = {
  id?: string
  bank?: { id?: string; name: string; logoUrl?: string | null } | null
  wallet?: { id?: string; name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  cardType?: string | null
  paymentChannel?: string | null
  accountType?: string | null
  segment?: string | null
  cardTier?: string | null
  discountType?: string
  discountValue?: number
  cap?: number | null
  capPeriod?: string | null
  minPurchase?: number | null
  note?: string | null
}

type Promo = {
  id: string
  slug?: string | null
  title: string
  description: string
  uniqueUsePerPeriod: boolean
  stackable: boolean
  validDays: number
  validDaysNote?: string | null
  specificDates?: string | null
  sourceText?: string | null
  sourceUrl?: string | null
  category: { name: string; color: string; icon?: string }
  commerce: { name: string; logoUrl?: string | null }
  requirements: Req[]
  validFrom: string
  validUntil: string | null
  isSaved?: boolean
  globalMaxDiscount?: Req | null
  userBestDiscount?: Req | null
}

type Categoria = { id: string; name: string; slug: string; icon: string; color: string; promoCount?: number }

const DISCOUNT_RANGES = [
  { id: '0-10', label: '≤10%' },
  { id: '10-20', label: '10–20%' },
  { id: '20-30', label: '20–30%' },
  { id: '30+', label: '+30%' },
]

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

function bestPercentageReq(p: Promo): Req | null {
  // Prioriza requirements de tipo porcentaje/monto sobre CSI
  const pctReqs = p.requirements.filter(r =>
    r.discountType === 'PERCENTAGE_REINTEGRO' ||
    r.discountType === 'PERCENTAGE_DESCUENTO' ||
    r.discountType === 'BONIFICACION' ||
    r.discountType === 'FIXED_AMOUNT'
  )
  if (!pctReqs.length) return null
  return pctReqs.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), pctReqs[0])
}

function bestCsiReq(p: Promo): Req | null {
  const csiReqs = p.requirements.filter(r => r.discountType === 'CUOTAS_SIN_INTERES')
  if (!csiReqs.length) return null
  return csiReqs.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), csiReqs[0])
}

function discountLabel(p: Promo) {
  // Si hay un req de porcentaje, usarlo como label principal (ignora CSI aquí — se muestra aparte)
  const pctReq = bestPercentageReq(p)
  const req = pctReq ?? maxDiscountReq(p)
  if (!req) return ''
  const isPersonalized = !!p.userBestDiscount
  const isMaxTier = isPersonalized && p.globalMaxDiscount &&
    (p.userBestDiscount?.discountValue ?? 0) >= (p.globalMaxDiscount?.discountValue ?? 0)
  const prefix = !isPersonalized || (!isMaxTier && p.requirements.length > 1) ? 'Hasta ' : ''
  const val = req.discountValue ?? 0

  if (req.discountType === 'PERCENTAGE_REINTEGRO' || req.discountType === 'PERCENTAGE_DESCUENTO') return `${prefix}${val}%`
  if (req.discountType === 'BONIFICACION') return `${prefix}${val}% BONIF.`
  if (req.discountType === 'FIXED_AMOUNT') return `${prefix}$${val}`
  if (req.discountType === 'CUOTAS_SIN_INTERES') return `${val} CSI`
  return `${prefix}${val}`
}

function csiLabel(p: Promo): string | null {
  const csi = bestCsiReq(p)
  if (!csi) return null
  // Solo mostrar si también hay un req de porcentaje/monto (no es promo solo-CSI)
  const hasPct = p.requirements.some(r =>
    r.discountType === 'PERCENTAGE_REINTEGRO' ||
    r.discountType === 'PERCENTAGE_DESCUENTO' ||
    r.discountType === 'BONIFICACION' ||
    r.discountType === 'FIXED_AMOUNT'
  )
  if (!hasPct) return null
  return `${csi.discountValue} CSI`
}

function capLabel(p: Promo) {
  const req = maxDiscountReq(p)
  if (!req || !req.cap) return 'Sin tope'
  const periodo = req.capPeriod ? CAP_LABELS[req.capPeriod] ?? '' : ''
  return `$${req.cap.toLocaleString('es-AR')}${periodo ? ' ' + periodo : ''}`
}

function capValue(p: Promo) {
  const req = maxDiscountReq(p)
  return req?.cap ?? 0
}

function minPurchaseValue(p: Promo) {
  const req = maxDiscountReq(p)
  return req?.minPurchase ?? 0
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

function formatValidDaysAbbr(mask: number) {
  if (!mask || mask === 127) return 'Diario'
  const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
  const active = []
  for (let i = 0; i < 7; i++) {
    if ((mask & (1 << i)) !== 0) active.push(days[i])
  }
  if (active.length === 2 && (mask & (1 << 6)) && (mask & (1 << 0))) return 'S-D'
  if (active.length === 5 && !(mask & (1 << 0)) && !(mask & (1 << 6))) return 'L a V'
  return active.join('-')
}

function diasVigencia(p: Promo, short = false) {
  const parts = []

  // 1. Días de la semana o fechas específicas
  if (p.specificDates && parseDates(p.specificDates)) {
    parts.push(parseDates(p.specificDates))
  } else if (p.validDaysNote) {
    parts.push(p.validDaysNote)
  } else {
    const label = short ? formatValidDaysAbbr(p.validDays) : formatValidDays(p.validDays)
    parts.push(label)
  }

  // 2. Fecha de vencimiento
  if (p.validUntil) {
    const end = new Date(p.validUntil)
    const today = new Date()
    today.setHours(0,0,0,0)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diff === 0) parts.push('Hoy')
    else if (diff === 1) parts.push('Mañana')
    else if (diff > 0 && diff < 7 && !short) parts.push(`Vence en ${diff}d`)
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

function HomeContent() {
  const { data: session, status } = useSession()
  const nombre = session?.user?.name || 'Invitado'
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'
  const searchParams = useSearchParams()
  const router = useRouter()
  const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAccessDenied, setShowAccessDenied] = useState(
    searchParams.get('error') === 'no-autorizado'
  )

  const categoriaParam = searchParams.get('categoria')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null)
  const [entitiesPromo, setEntitiesPromo] = useState<Promo | null>(null)
  const [expandedPromos, setExpandedPromos] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedPromos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const categoriaParamApplied = useRef(false)

  // ── Filtros Avanzados ──
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [entities, setEntities] = useState({ banks: [], wallets: [], cardNetworks: [] })
  const [userProfile, setUserProfile] = useState<{ banks: {bankId:string}[], wallets: {walletId:string}[], cards: {cardNetworkId:string|null}[] } | null>(null)
  const initialFilters: FilterState = {
    banks: [], wallets: [], networks: [], days: [], channels: [],
    hasCap: null, capMin: null, capMax: null, capPeriods: [],
    commerces: [], discountRanges: [], hasInstallments: null,
  }
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters)
  const [forMe, setForMe] = useState(status === 'authenticated')
  const [timeFilter, setTimeFilter] = useState<'today' | 'week'>('today')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null)
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (status === 'authenticated') {
      setForMe(true)
      // Importar perfil guest si existe en localStorage
      const stored = localStorage.getItem('guestProfile')
      if (stored) {
        try {
          const gp: GuestProfile = JSON.parse(stored)
          if (gp.cards?.length) {
            fetch('/api/perfil/import-guest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cards: gp.cards }),
            }).then(() => {
              localStorage.removeItem('guestProfile')
              setGuestProfile(null)
            }).catch(() => {})
          }
        } catch {}
      }
    } else {
      // Cargar perfil guest del localStorage
      const stored = localStorage.getItem('guestProfile')
      if (stored) {
        try {
          const gp = JSON.parse(stored)
          setGuestProfile(gp)
          setForMe(true) // ya tiene perfil, activar directamente
        } catch {}
      } else {
        setForMe(false)
      }
    }
  }, [status])

  // Restaura selectedCats desde la URL al montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slugs = params.get('cats')?.split(',').filter(Boolean) ?? []
    if (slugs.length > 0) setSelectedCats(slugs)
  }, [])

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
    async function fetchCategorias() {
      try {
        const r = await fetch(`/api/categories?for_me=${forMe}`)
        if (r.ok) {
          const data = await r.json()
          if (data.categories) setCategorias(data.categories)
        }
      } catch (err) {
        console.error('Error fetching categorias:', err)
      }
    }
    async function fetchUserProfile() {
      if (status !== 'authenticated') return
      try {
        const r = await fetch('/api/perfil')
        if (r.ok) {
          const data = await r.json()
          if (data.profile) setUserProfile(data.profile)
        }
      } catch (err) {
        console.error('Error fetching user profile:', err)
      }
    }
    fetchEntities()
    fetchCategorias()
    fetchUserProfile()
  }, [status, forMe]) // Re-fetch categories when forMe changes

  useEffect(() => {
    if (!categoriaParam || categorias.length === 0 || categoriaParamApplied.current) return
    const match = categorias.find(
      c => c.slug === categoriaParam.toLowerCase()
        || c.name.toLowerCase() === categoriaParam.toLowerCase()
    )
    if (match) {
      setSelectedCats([match.slug])
      categoriaParamApplied.current = true
    }
  }, [categoriaParam, categorias])

  // Sincroniza selectedCats (slugs) → URL, sin re-render
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (selectedCats.length > 0) {
      params.set('cats', selectedCats.join(','))
    } else {
      params.delete('cats')
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [selectedCats])

  useEffect(() => {
    if (status === 'loading') return;

    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        const qParams = new URLSearchParams()
        qParams.set('for_me', String(forMe))
        qParams.set('view', timeFilter)
        if (selectedCats.length > 0) qParams.set('categories', selectedCats.join(','))
        if (activeFilters.banks.length) qParams.set('banks', activeFilters.banks.join(','))
        if (activeFilters.wallets.length) qParams.set('wallets', activeFilters.wallets.join(','))
        if (activeFilters.networks.length) qParams.set('networks', activeFilters.networks.join(','))
        if (activeFilters.days.length) qParams.set('days', activeFilters.days.join(','))
        if (activeFilters.channels.length) qParams.set('channels', activeFilters.channels.join(','))
        if (activeFilters.capPeriods.length) qParams.set('capPeriods', activeFilters.capPeriods.join(','))
        if (activeFilters.hasCap !== null) qParams.set('hasCap', String(activeFilters.hasCap))
        if (activeFilters.capMin !== null) qParams.set('capMin', String(activeFilters.capMin))
        if (activeFilters.capMax !== null) qParams.set('capMax', String(activeFilters.capMax))
        if (activeFilters.commerces.length) qParams.set('commerces', activeFilters.commerces.join(','))
        if (activeFilters.discountRanges.length) qParams.set('discountRanges', activeFilters.discountRanges.join(','))
        if (activeFilters.hasInstallments !== null) qParams.set('hasInstallments', String(activeFilters.hasInstallments))
        // Guest profile: pasar perfil temporal si no está logueado
        if (forMe && guestProfile?.cards?.length && status !== 'authenticated') {
          qParams.set('guest_profile', btoa(JSON.stringify(guestProfile)))
        }

        const res = await fetch(`/api/promos?${qParams.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setPromos(data.promos)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error(e)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [session?.user?.email, status, selectedCats, activeFilters, forMe, timeFilter, guestProfile])

  // Helper para mostrar los chips de "camino de migas"
  const getFilterChips = () => {
    const chips: { id: string, label: string, type: string }[] = []

    selectedCats.forEach(slug => {
      const cat = categorias.find(c => c.slug === slug)
      if (cat) chips.push({ id: slug, label: `${cat.icon} ${cat.name}`, type: 'category' })
    })

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
    if (type === 'category') {
      setSelectedCats(prev => prev.filter(c => c !== id))
      return
    }
    setActiveFilters(prev => {
      if (type === 'hasCap') return { ...prev, hasCap: null }
      if (type === 'capMin' || type === 'capMax') return { ...prev, capMin: null, capMax: null }
      const list = (prev as any)[type] as any[]
      return { ...prev, [type]: list.filter(item => String(item) !== id) }
    })
  }

  const quickCats = useMemo(() => {
    const PINNED = ['supermercados', 'combustible']
    const excluded = new Set([...PINNED, 'sin-categoria'])
    const pinned = PINNED.map(slug => categorias.find(c => c.slug === slug)).filter(Boolean) as Categoria[]
    const dynamic = [...categorias]
      .filter(c => !excluded.has(c.slug))
      .sort((a, b) => (b.promoCount ?? 0) - (a.promoCount ?? 0))
      .slice(0, 3)
    return [...pinned, ...dynamic]
  }, [categorias])

  const quickRanges = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of promos) {
      const req = bestPercentageReq(p)
      if (!req?.discountValue) continue
      const v = req.discountValue
      const bucket = v <= 10 ? '0-10' : v <= 20 ? '10-20' : v <= 30 ? '20-30' : '30+'
      counts[bucket] = (counts[bucket] ?? 0) + 1
    }
    return DISCOUNT_RANGES
      .filter(r => (counts[r.id] ?? 0) > 0)
      .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
      .slice(0, 3)
  }, [promos])

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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex">
      {/* ── Sidebar (Desktop) ── */}
      <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 border-r border-gray-200/50 bg-white/50 backdrop-blur-xl z-30">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={24} />
            </div>
            <span className="text-xl font-black tracking-tighter text-gray-900">PromoAR</span>
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar pr-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-3">Explorar</p>
            <div className="flex gap-1 px-3 mb-6">
              <button
                onClick={() => setForMe(false)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  !forMe ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => {
                  if (status === 'authenticated') {
                    if (!userProfile?.cards?.length) setWizardOpen(true)
                    else setForMe(true)
                  } else if (guestProfile?.cards?.length) {
                    setForMe(true)
                  } else {
                    setWizardOpen(true)
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  forMe ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                }`}
              >
                Para Mí
              </button>
            </div>

            <div className="flex gap-1 px-3 mb-6">
              {(['today', 'week'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all border ${
                    timeFilter === f ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {f === 'today' ? 'Hoy' : 'Semana'}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {/* Más Populares */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3">Más Populares</p>
                {categorias.filter(c => (c as any).isPopular).sort((a,b) => a.name.localeCompare(b.name)).map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const count = forMe ? (promos.filter(p => p.category.name === cat.name).length) : (cat.promoCount ?? 0)
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{cat.icon}</span>
                        <span className="flex items-center gap-1">{cat.name} 🔥</span>
                      </div>
                      {count > 0 && <span className="text-[10px] opacity-60 bg-white/50 px-1.5 py-0.5 rounded-md">{count}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Rangos de Descuento */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3">Por Descuento</p>
                {[
                  { label: '< 10%', val: '0-10' },
                  { label: '10% - 30%', val: '10-30' },
                  { label: '> 30%', val: '30+' }
                ].map(range => {
                  const isActive = activeFilters.discountRanges.includes(range.val)
                  return (
                    <button
                      key={range.val}
                      onClick={() => setActiveFilters(prev => ({
                        ...prev,
                        discountRanges: isActive ? prev.discountRanges.filter(r => r !== range.val) : [...prev.discountRanges, range.val]
                      }))}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        <span className="text-[10px] font-black">%</span>
                      </div>
                      {range.label}
                    </button>
                  )
                })}
              </div>

              {/* Otras Categorías */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3">Otras Categorías</p>
                {categorias.filter(c => !(c as any).isPopular).sort((a,b) => a.name.localeCompare(b.name)).map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const count = forMe ? (promos.filter(p => p.category.name === cat.name).length) : (cat.promoCount ?? 0)
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{cat.icon}</span>
                        <span>{cat.name}</span>
                      </div>
                      {count > 0 && <span className="text-[10px] opacity-60">{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </nav>
        </div>

        <div className="mt-auto pt-6 border-t border-gray-100/50 space-y-4 p-6">
            {isAdmin && (
              <button
                onClick={() => {
                  const alreadyUnlocked = sessionStorage.getItem('admin_unlocked') === 'true'
                  if (alreadyUnlocked) window.location.href = '/admin'
                  else setShowPinModal(true)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-gray-100 hover:text-gray-900 transition-all border border-gray-200/50"
              >
                <Settings size={12} /> Admin
              </button>
            )}

            {status === 'authenticated' ? (
              <Link href="/perfil" className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-inner">
                  {nombre[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{nombre}</p>
                  <p className="text-[10px] text-gray-500 truncate">Mi Perfil</p>
                </div>
              </Link>
            ) : (
              <Link href="/login" className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                <LogIn size={14} /> Iniciar Sesión
              </Link>
            )}
          </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto no-scrollbar">
        {/* Top bar sticky */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-20 shadow-sm shadow-black/[0.01]">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{fechaHoy()}</p>
                  {status === 'authenticated' && (
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  )}
                  {status === 'authenticated' && (
                    <p className="text-[11px] text-indigo-600 font-bold">Hola, {nombre.split(' ')[0]} 👋</p>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tighter text-gray-900 mt-0.5">
                  {timeFilter === 'today' ? 'Promociones Hoy' : 'Catálogo de la Semana'}
                </h1>
              </div>

              <div className="flex items-center gap-3 flex-1 justify-end">
                <div className="relative max-w-xs w-full hidden md:block">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar comercio..."
                    value={activeFilters.commerces[0] || ''}
                    onChange={(e) => setActiveFilters(prev => ({ ...prev, commerces: e.target.value ? [e.target.value] : [] }))}
                    className="w-full pl-11 pr-4 py-3 bg-gray-100 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>

                <button
                  onClick={() => setIsFilterOpen(true)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                    getFilterChips().filter(c => c.type !== 'category').length > 0
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  <span className="hidden md:inline">Filtros</span>
                </button>

                <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm shrink-0">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile-only selector y quick filters */}
            <div className="lg:hidden mt-4">
              {/* Toggle Todas / Para Mí */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setForMe(false)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    !forMe ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => {
                    if (status === 'authenticated') {
                      if (!userProfile?.cards?.length) setWizardOpen(true)
                      else setForMe(true)
                    } else {
                      setWizardOpen(true)
                    }
                  }}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    forMe ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  Para Mí
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {(['today', 'week'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      timeFilter === f ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {f === 'today' ? 'Solo Hoy' : 'Toda la semana'}
                  </button>
                ))}
                <div className="w-[1px] bg-gray-200 shrink-0 mx-1" />
                <button
                  onClick={() => setIsCategoryOpen(true)}
                  className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-[10px] uppercase transition-all ${
                    selectedCats.length > 0 ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <Tag size={12} /> Categorías {selectedCats.length > 0 && `(${selectedCats.length})`}
                </button>
              </div>

              {/* Mobile Quick Categories (Wrapped, no scroll) */}
              <div className="mt-4 flex flex-wrap gap-2">
                {quickCats.slice(0, 4).map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const count = forMe ? (promos.filter(p => p.category.name === cat.name).length) : (cat.promoCount ?? 0)
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                        isActive ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                      {count > 0 && <span className="opacity-60">{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          <ActiveFilters
            filters={getFilterChips()}
            onRemove={removeFilter}
            onClearAll={() => { setActiveFilters(initialFilters); setSelectedCats([]) }}
          />
        </div>

        <div className="px-6 py-6 pb-28 max-w-[1440px] w-full mx-auto">

        {/* Banner perfil guest */}
        {status !== 'authenticated' && guestProfile && !guestBannerDismissed && forMe && (
          <div className="mb-4 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0">✨</span>
              <div className="min-w-0">
                <p className="text-xs font-black text-indigo-900">Estás viendo promos para tu perfil</p>
                <p className="text-[11px] text-indigo-600 truncate">Registrate gratis para no perder tu configuración</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                onClick={() => setWizardOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-600 text-[11px] font-black hover:bg-indigo-50 transition-colors whitespace-nowrap"
              >
                Editar
              </button>
              <button
                onClick={() => router.push('/register')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-black hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                Registrarse
              </button>
              <button onClick={() => setGuestBannerDismissed(true)} className="text-indigo-300 hover:text-indigo-500 p-1">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Banner acceso denegado */}
        {showAccessDenied && (
          <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-sm text-red-700 font-medium">Acceso restringido para esa área.</p>
            <button onClick={() => setShowAccessDenied(false)} className="text-red-400 hover:text-red-500 bg-white p-1 rounded-full shadow-sm ml-3">
              <X size={14} />
            </button>
          </div>
        )}


        {/* Modal PIN admin */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-7 shadow-xl w-full max-w-xs text-center">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Settings size={22} className="text-amber-500" />
              </div>
              <h2 className="text-base font-black text-gray-900 mb-1">PIN de administrador</h2>
              <p className="text-xs text-gray-400 mb-5">Ingresá el PIN para continuar</p>
              <form onSubmit={e => {
                e.preventDefault()
                if (pinInput === process.env.NEXT_PUBLIC_ADMIN_PIN) {
                  sessionStorage.setItem('admin_unlocked', 'true')
                  setShowPinModal(false)
                  window.location.href = '/admin'
                } else {
                  setPinError(true)
                  setPinInput('')
                }
              }} className="space-y-3">
                <input
                  type="password"
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value); setPinError(false) }}
                  placeholder="••••"
                  autoFocus
                  className={`w-full text-center text-2xl tracking-[0.5em] font-bold border-2 rounded-2xl px-4 py-3 outline-none transition-colors ${pinError ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-amber-400'}`}
                />
                {pinError && <p className="text-xs text-red-500 font-medium">PIN incorrecto</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPinModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-2xl text-sm font-bold">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold">
                    Entrar
                  </button>
                </div>
              </form>
            </div>
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
            <p className="text-gray-900 font-medium font-poppins">No encontramos promos{selectedCats.length > 0 ? ` en estas categorías` : ''}</p>
            <p className="text-sm text-gray-500 mt-2 max-w-[250px] mx-auto">Podes crear nuevas promociones desde el panel de administrador o probar otra categoría.</p>
          </div>
        )}

        {/* Promos */}
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
          : 'space-y-4'}>
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
                  </div>
                  <button
                    onClick={() => promo.slug ? router.push(`/promos/${promo.slug}`) : setSelectedPromo(promo)}
                    className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 border border-gray-100 transition-colors shrink-0"
                  >
                    <Search size={18} />
                  </button>
                </div>
              )
            }

            {/* ── CARD V2 ── */}
            const TIER_LABELS: Record<string, string> = { EMINENT: 'Eminent', SELECTA: 'Selecta', BLACK: 'Black', INFINITE: 'Infinite', SIGNATURE: 'Signature', PLATINUM: 'Platinum', GOLD: 'Gold', CLASSIC: 'Classic' }
            const seg = promo.requirements.find(r => r.segment)?.segment
              || (promo.requirements.find(r => r.cardTier)?.cardTier ? TIER_LABELS[promo.requirements.find(r => r.cardTier)!.cardTier!] : undefined)
            const isExpanded = expandedPromos.has(promo.id)
            const uniqueEntities = Array.from(new Map([
              ...promo.requirements.filter(r => r.bank?.id).map(r => [r.bank!.id!, { logo: r.bank?.logoUrl, name: r.bank?.name || '?' }] as [string, {logo: string|null|undefined, name: string}]),
              ...promo.requirements.filter(r => r.wallet?.id).map(r => [r.wallet!.id!, { logo: r.wallet?.logoUrl, name: r.wallet?.name || '?' }] as [string, {logo: string|null|undefined, name: string}]),
            ]).values())
            const uniqueNets = Array.from(new Set(promo.requirements.map(r => r.cardNetwork?.slug).filter(Boolean)))
            const daysLabel = formatValidDays(promo.validDays)

            return (
              <div key={promo.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">

                {/* Header: logo grande O icono+nombre */}
                <div className="relative cursor-pointer" onClick={() => setSelectedPromo(promo)}>
                  {promo.commerce.logoUrl ? (
                    <div className="h-28 flex items-center justify-center p-5 bg-white">
                      <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-28 flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-slate-800">
                      <span className="text-4xl">{promo.category.icon || '🏷️'}</span>
                      <p className="text-sm font-black text-gray-700 dark:text-gray-200 px-4 text-center line-clamp-2">{promo.commerce.name}</p>
                    </div>
                  )}
                  {/* Corazón flotante */}
                  <button onClick={(e) => toggleSave(promo.id, e)} className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm">
                    <Heart size={14} className={promo.isSaved ? 'text-red-500 fill-red-500' : 'text-gray-400'} />
                  </button>
                  {/* Nombre cuando hay logo */}
                  {promo.commerce.logoUrl && (
                    <div className="absolute bottom-2 left-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md" style={{ background: promo.category.color + '20', color: promo.category.color }}>{promo.category.name}</span>
                    </div>
                  )}
                </div>

                {/* Bloque descuento */}
                <div className={`mx-3 mt-3 mb-2 rounded-2xl py-3 px-4 text-center cursor-pointer ${promo.userBestDiscount ? 'bg-indigo-700' : 'bg-gray-900'}`} onClick={() => setSelectedPromo(promo)}>
                  {seg && <p className="text-[9px] font-black uppercase tracking-[3px] text-indigo-300 mb-0.5">✦ {seg}</p>}
                  {getSpecialBadge(promo) && <div className={`${getSpecialBadge(promo)!.color} text-white text-[8px] font-black px-2 py-0.5 rounded-lg w-fit mx-auto mb-1`}>{getSpecialBadge(promo)!.text}</div>}
                  <p className="text-5xl font-black leading-none" style={{ color: '#c6f135' }}>{discountLabel(promo)}</p>
                  {csiLabel(promo) && <p className="text-[10px] text-gray-400 mt-0.5">{csiLabel(promo)}</p>}
                </div>

                {/* Info rápida */}
                <div className="px-4 pb-2 pt-1 space-y-0.5 cursor-pointer" onClick={() => setSelectedPromo(promo)}>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{daysLabel}</p>
                  {capValue(promo) > 0 && <p className="text-[11px] text-gray-500">Tope: <span className="font-bold text-gray-700">{capLabel(promo).split(' ')[0]}</span></p>}
                  {minPurchaseValue(promo) > 0 && <p className="text-[11px] text-gray-500">Mínimo: <span className="font-bold text-gray-700">${minPurchaseValue(promo).toLocaleString()}</span></p>}
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="mx-3 mb-2 p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl space-y-2.5">
                    {/* Nombre del comercio */}
                    <p className="text-sm font-black text-gray-900 dark:text-white">{promo.commerce.name}</p>
                    {/* Banco / Billetera */}
                    {uniqueEntities.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Banco / Billetera</p>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueEntities.map((ent, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1">
                              {ent.logo && <img src={ent.logo} className="w-6 h-6 object-contain" />}
                              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{ent.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Tarjetas */}
                    {uniqueNets.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Tarjetas</p>
                        <div className="flex flex-wrap gap-1">
                          {uniqueNets.map((slug, i) => (
                            <img key={i} src={CARD_NETWORK_LOGOS[slug!] || ''} className="h-7 w-auto object-contain" alt={slug!} title={slug!} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Vigencia */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Vigencia</p>
                      <p className="text-[11px] text-gray-700 dark:text-gray-300">{daysLabel}</p>
                      {(promo.validFrom || promo.validUntil) && (
                        <p className="text-[11px] text-gray-500">
                          {promo.validFrom ? new Date(promo.validFrom).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                          {promo.validFrom && promo.validUntil ? ' al ' : ''}
                          {promo.validUntil ? new Date(promo.validUntil).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'sin vencimiento'}
                        </p>
                      )}
                    </div>
                    {/* Forma de pago */}
                    {promo.requirements.some(r => r.paymentChannel && r.paymentChannel !== 'ANY') && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Forma de pago</p>
                        <p className="text-[11px] text-gray-700 dark:text-gray-300">{getFormasDePago(promo.requirements)}</p>
                      </div>
                    )}
                    {/* Legales */}
                    {promo.sourceText && promo.sourceText.length > 50 && promo.sourceText !== promo.description && (
                      <details className="pt-1 border-t border-gray-200 dark:border-slate-600">
                        <summary className="text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer select-none">Términos y condiciones</summary>
                        <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed line-clamp-6">{promo.sourceText}</p>
                      </details>
                    )}
                    {/* Link oficial — solo si apunta a una promo específica */}
                    {promo.sourceUrl && (() => {
                      try {
                        const u = new URL(promo.sourceUrl)
                        const hasSpecificPath = u.pathname.length > 1 || u.hash.length > 1
                        if (!hasSpecificPath) return null
                        return (
                          <a href={promo.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1 pt-1 border-t border-gray-200 dark:border-slate-600">
                            <Globe size={10} /> Ver promo oficial
                          </a>
                        )
                      } catch { return null }
                    })()}
                  </div>
                )}

                {/* Footer: logos (clickeable → popup) + botón info */}
                <div className="px-4 py-3 mt-auto border-t border-gray-50 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-1.5 flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setEntitiesPromo(promo) }}
                  >
                    {uniqueEntities.slice(0, 3).map((ent, i) => (
                      <div key={i} className="h-9 w-9 rounded-full bg-white border border-gray-200 flex items-center justify-center p-1 overflow-hidden shadow-sm">
                        {ent.logo ? <img src={ent.logo} className="w-full h-full object-contain" /> : <span className="text-[9px] font-black text-gray-400">{ent.name[0]}</span>}
                      </div>
                    ))}
                    {uniqueNets.slice(0, 4).map((slug, i) => (
                      <img key={i} src={CARD_NETWORK_LOGOS[slug!] || ''} className="h-8 w-auto object-contain" alt={slug!} title={slug!} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ))}
                    {(uniqueEntities.length + uniqueNets.length) === 0 && (
                      <span className="text-[10px] text-gray-400">Ver entidades</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => toggleExpand(promo.id, e)}
                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 shrink-0 hover:text-indigo-800 transition-colors"
                  >
                    {isExpanded ? '− Menos' : '+ Info'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>

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
                    {maxDiscountReq(selectedPromo)?.discountType?.includes('PERCENTAGE') && <span className="text-lg font-bold opacity-80">OFF</span>}
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
                                {r.bank && (
                                  r.bank.logoUrl ? (
                                    <img src={r.bank.logoUrl} className="w-5 h-5 object-contain" alt={r.bank.name} />
                                  ) : (
                                    <span className="text-xs">🏦</span>
                                  )
                                )}
                                {r.wallet && !r.bank && (
                                  r.wallet.logoUrl ? (
                                    <img src={r.wallet.logoUrl} className="w-5 h-5 object-contain" alt={r.wallet.name} />
                                  ) : (
                                    <span className="text-xs">📱</span>
                                  )
                                )}
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

              {/* Link a página de detalle SEO */}
              {selectedPromo.slug && (
                <div className="mt-6 text-center">
                  <Link
                    href={`/promos/${selectedPromo.slug}`}
                    className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-2xl transition-colors"
                  >
                    <Globe size={13} />
                    Ver página completa · compartir
                  </Link>
                </div>
              )}

              {/* Footnote backend record */}
              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">PromoAR Match Engine ID: {selectedPromo.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {entitiesPromo && (
        <EntitiesSheet
          commerceName={entitiesPromo.commerce.name}
          requirements={entitiesPromo.requirements}
          onCloseAction={() => setEntitiesPromo(null)}
        />
      )}

      <BottomNav />
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        entities={entities}
        userProfile={userProfile}
        forMe={forMe}
        currentFilters={activeFilters}
        onApply={(f) => {
          setActiveFilters(f)
          setIsFilterOpen(false)
        }}
      />
      <CategorySheet
        isOpen={isCategoryOpen}
        onClose={() => setIsCategoryOpen(false)}
        categorias={categorias}
        selected={selectedCats}
        onChange={setSelectedCats}
      />
      <PromoWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialProfile={guestProfile}
        onComplete={(profile) => {
          setGuestProfile(profile)
          setForMe(true)
          setWizardOpen(false)
          setGuestBannerDismissed(false)
        }}
      />
    </div>
  )
}

export default function Home() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Cargando...</p></div>}><HomeContent /></Suspense>
}