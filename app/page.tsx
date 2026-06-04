'use client'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Calendar, Tag, Settings, X, Search, Sparkles, Heart, Info, Smartphone, Clock, Globe, SlidersHorizontal, LogIn, MapPin } from 'lucide-react'
import BottomNav from './components/BottomNav'
import FilterDrawer, { FilterState } from './components/FilterDrawer'
import ActiveFilters from './components/ActiveFilters'
import CategorySheet from './components/CategorySheet'
import EntitiesSheet, { CARD_NETWORK_LOGOS } from './components/EntitiesSheet'
import PromoWizard, { GuestProfile } from './components/PromoWizard'
import ProvinceSelector from './components/ProvinceSelector'
import ThemeToggle from './components/ThemeToggle'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaHoy() {
  const hoy = new Date()
  return `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`
}

function fechaCorta() {
  const hoy = new Date()
  const d = String(hoy.getDate()).padStart(2, '0')
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  const a = String(hoy.getFullYear()).slice(2)
  return `${d}/${m}/${a}`
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
  salesChannel?: string | null
  commerceNote?: string | null
  category: { name: string; slug?: string; color: string; icon?: string }
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
  const iniciales = (() => {
    const parts = nombre.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return nombre.slice(0, 2).toUpperCase()
  })()
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'
  const searchParams = useSearchParams()
  const router = useRouter()
  const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(20)
  const [loadingAll, setLoadingAll] = useState(false)
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const [searchText, setSearchText] = useState('')
  const [searchMode, setSearchMode] = useState<'startsWith' | 'contains' | 'exact'>('startsWith')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [province, setProvince] = useState<string | null>(null)
  const [showProvinceSelector, setShowProvinceSelector] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [favCategories, setFavCategories] = useState<string[]>([]) // slugs, max 3
  const [favCommerces, setFavCommerces] = useState<string[]>([])   // nombres, max 5
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['favorites', 'popular']))
  const [nearbyBranches, setNearbyBranches] = useState<Record<string, { count: number; minDistKm: number }>>({})

  // Geolocalización: pedir una vez, cachear en localStorage 1h
  useEffect(() => {
    const cached = localStorage.getItem('userLocation')
    if (cached) {
      try {
        const { lat, lng, ts } = JSON.parse(cached)
        if (Date.now() - ts < 3600000) {
          fetch(`/api/branches/nearby?lat=${lat}&lng=${lng}&radius=5`)
            .then(r => r.json()).then(setNearbyBranches).catch(() => {})
          return
        }
      } catch {}
    }
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }))
      fetch(`/api/branches/nearby?lat=${lat}&lng=${lng}&radius=5`)
        .then(r => r.json()).then(setNearbyBranches).catch(() => {})
    }, () => {}, { timeout: 8000 })
  }, [])

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
          setForMe(true)
        } catch {}
      } else {
        setForMe(false)
      }
    }

    // Cargar favoritos
    try {
      const fc = localStorage.getItem('favCategories')
      if (fc) setFavCategories(JSON.parse(fc))
      const fco = localStorage.getItem('favCommerces')
      if (fco) setFavCommerces(JSON.parse(fco))
    } catch {}

    // Cargar provincia guardada (aplica a todos)
    const savedProvince = localStorage.getItem('userProvince')
    if (savedProvince) {
      setProvince(savedProvince)
    } else {
      setTimeout(() => setShowProvinceSelector(true), 2000)
    }
  }, [status])

  // Restaura selectedCats desde la URL al montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slugs = params.get('cats')?.split(',').filter(Boolean) ?? []
    if (slugs.length > 0) setSelectedCats(slugs)
  }, [])

  const toggleFavCategory = (slug: string) => {
    setFavCategories(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 3 ? [...prev, slug] : prev
      localStorage.setItem('favCategories', JSON.stringify(next))
      return next
    })
  }

  const toggleFavCommerce = (name: string) => {
    setFavCommerces(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 5 ? [...prev, name] : prev
      localStorage.setItem('favCommerces', JSON.stringify(next))
      return next
    })
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
        if (activeFilters.commerces.length) {
          qParams.set('commerces', activeFilters.commerces.join(','))
          qParams.set('searchMode', searchMode)
        }
        if (activeFilters.discountRanges.length) qParams.set('discountRanges', activeFilters.discountRanges.join(','))
        if (activeFilters.hasInstallments !== null) qParams.set('hasInstallments', String(activeFilters.hasInstallments))
        // Guest profile
        if (forMe && guestProfile?.cards?.length && status !== 'authenticated') {
          qParams.set('guest_profile', btoa(JSON.stringify(guestProfile)))
        }
        // Provincia del usuario (guest o logueado sin addressState)
        if (province && status !== 'authenticated') {
          qParams.set('province', province)
        }

        const res = await fetch(`/api/promos?${qParams.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setPromos(data.promos)
          setVisibleCount(20)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error(e)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [session?.user?.email, status, selectedCats, activeFilters, forMe, timeFilter, guestProfile, province, searchMode])

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

  const todayDashboard = useMemo(() => {
    if (promos.length === 0) return null
    const todayIdx = new Date().getDay()
    const maxDiscount = promos.reduce((max, p) => {
      const req = bestPercentageReq(p)
      if (!req) return max
      if (!['PERCENTAGE_REINTEGRO', 'PERCENTAGE_DESCUENTO', 'BONIFICACION'].includes(req.discountType ?? '')) return max
      const val = req.discountValue ?? 0
      return val <= 100 ? Math.max(max, val) : max
    }, 0)
    const DAYS_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
    const dayCounts = Array.from({ length: 7 }, (_, d) => ({
      label: DAYS_LABELS[d],
      count: promos.filter(p => (p.validDays & (1 << d)) !== 0).length,
      isToday: d === todayIdx,
      dayIdx: d,
    }))

    // Categorías
    const catMap = new Map<string, { name: string; icon: string; slug: string; bestDiscount: number; count: number }>()
    for (const p of promos) {
      const k = p.category.slug ?? p.category.name
      if (!catMap.has(k)) catMap.set(k, { name: p.category.name, icon: p.category.icon || '🏷️', slug: p.category.slug ?? '', bestDiscount: 0, count: 0 })
      const entry = catMap.get(k)!
      entry.count++
      const v = bestPercentageReq(p)?.discountValue ?? 0
      if (v > entry.bestDiscount) entry.bestDiscount = v
    }
    const catList = Array.from(catMap.values())
      .filter(c => c.bestDiscount > 0)
      .sort((a, b) => b.count !== a.count ? b.count - a.count : b.bestDiscount - a.bestDiscount)
      .slice(0, 5)

    // Comercios
    const commMap = new Map<string, { name: string; logoUrl?: string | null; bestDiscount: number; count: number }>()
    for (const p of promos) {
      const k = p.commerce.name
      if (!commMap.has(k)) commMap.set(k, { name: k, logoUrl: p.commerce.logoUrl, bestDiscount: 0, count: 0 })
      const entry = commMap.get(k)!
      entry.count++
      const v = bestPercentageReq(p)?.discountValue ?? 0
      if (v > entry.bestDiscount) entry.bestDiscount = v
    }
    const activeCommerce = activeFilters.commerces[0]
    const commList = Array.from(commMap.values())
      .filter(c => c.bestDiscount > 0)
      .sort((a, b) => b.count !== a.count ? b.count - a.count : b.bestDiscount - a.bestDiscount)
      .slice(0, 5)

    return { totalPromos: promos.length, maxDiscount, dayCounts, catList, commList }
  }, [promos, selectedCats, favCategories, favCommerces, activeFilters.commerces])

  // Ordenar: favoritos primero (categoría o comercio en favoritos), luego el resto
  const promosFiltradas = favCategories.length === 0 && favCommerces.length === 0
    ? promos
    : [...promos].sort((a, b) => {
        const aFav = favCategories.includes(a.category.slug ?? '') || favCommerces.includes(a.commerce.name)
        const bFav = favCategories.includes(b.category.slug ?? '') || favCommerces.includes(b.commerce.name)
        if (aFav && !bFav) return -1
        if (!aFav && bFav) return 1
        return 0
      })

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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col">
    <div className="flex flex-1">
      {/* ── Sidebar (Desktop) ── */}
      <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 border-r border-gray-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-950 z-30">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <img src="/logo.jpg" alt="PromoAR" className="h-8 w-auto object-contain" />
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar pr-2">
            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-3">Explorar</p>
            <div className="flex gap-1 px-3 mb-6">
              <button
                onClick={() => setForMe(false)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  !forMe ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
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
                  forMe ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
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
                    timeFilter === f ? 'bg-indigo-600 border-indigo-600 text-white shadow-md dark:shadow-indigo-900/30' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {f === 'today' ? 'Hoy' : 'Semana'}
                </button>
              ))}
            </div>

            <div className="space-y-1">

              {/* ── MIS FAVORITOS ── */}
              <div>
                <button onClick={() => toggleSection('favorites')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">⭐ Mis Favoritos</span>
                  <span className="text-gray-500 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-300 text-sm font-bold">{openSections.has('favorites') ? '−' : '+'}</span>
                </button>
                {openSections.has('favorites') && (
                  <div className="mt-1 space-y-3 px-3">
                    <div>
                      <p className="text-[9px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1">Categorías <span className="text-gray-500 dark:text-slate-500">({favCategories.length}/3)</span></p>
                      {favCategories.length === 0 && <p className="text-[10px] text-gray-500 dark:text-slate-500 italic px-1">Marcá ★ en una categoría</p>}
                      {favCategories.map(slug => {
                        const cat = categorias.find(c => c.slug === slug)
                        if (!cat) return null
                        const isActive = selectedCats.includes(slug)
                        return (
                          <div key={slug} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                            <button onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== slug) : [...prev, slug])} className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-base">{cat.icon}</span>
                              <span className={`text-xs font-bold truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-slate-300'}`}>{cat.name}</span>
                            </button>
                            <button onClick={() => toggleFavCategory(slug)} className="text-yellow-400 hover:text-gray-400 dark:hover:text-slate-600 ml-2 shrink-0" title="Quitar de favoritos">★</button>
                          </div>
                        )
                      })}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1">Comercios <span className="text-gray-500 dark:text-slate-500">({favCommerces.length}/5)</span></p>
                      {favCommerces.length === 0 && <p className="text-[10px] text-gray-500 dark:text-slate-500 italic px-1">Marcá ★ en un comercio</p>}
                      {favCommerces.map(name => (
                        <div key={name} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                          <span className="text-xs font-bold text-gray-700 dark:text-slate-300 truncate flex-1">{name}</span>
                          <button onClick={() => toggleFavCommerce(name)} className="text-yellow-400 hover:text-gray-400 dark:hover:text-slate-600 ml-2 shrink-0" title="Quitar de favoritos">★</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />

              {/* ── MÁS POPULARES ── */}
              <div>
                <button onClick={() => toggleSection('popular')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Más Populares</span>
                  <span className="text-gray-500 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-300 text-sm font-bold">{openSections.has('popular') ? '−' : '+'}</span>
                </button>
                {openSections.has('popular') && categorias.filter(c => (c as any).isPopular).sort((a,b) => a.name.localeCompare(b.name)).map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const isFav = favCategories.includes(cat.slug)
                  const count = forMe ? promos.filter(p => p.category.name === cat.name).length : (cat.promoCount ?? 0)
                  return (
                    <div key={cat.slug} className={`flex items-center px-3 py-1.5 rounded-xl transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                      <button onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])} className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-base">{cat.icon}</span>
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400'}`}>{cat.name}</span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {count > 0 && <span className="text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">{count}</span>}
                        <button onClick={() => toggleFavCategory(cat.slug)} className={`text-base leading-none transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-400 dark:text-slate-500 hover:text-yellow-400'}`} title={isFav ? 'Quitar favorito' : 'Agregar a favoritos'}>★</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />

              {/* ── POR DESCUENTO ── */}
              <div>
                <button onClick={() => toggleSection('discount')} className="w-full flex items-center justify-between px-3 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-slate-200">Por Descuento</span>
                  <span className="text-gray-500 dark:text-slate-400 group-hover:text-gray-500 dark:group-hover:text-slate-300 text-sm">{openSections.has('discount') ? '−' : '+'}</span>
                </button>
                {openSections.has('discount') && [
                  { label: '< 10%', val: '0-10' },
                  { label: '10% – 30%', val: '10-30' },
                  { label: '> 30%', val: '30+' }
                ].map(range => {
                  const isActive = activeFilters.discountRanges.includes(range.val)
                  return (
                    <button key={range.val}
                      onClick={() => setActiveFilters(prev => ({ ...prev, discountRanges: isActive ? prev.discountRanges.filter(r => r !== range.val) : [...prev.discountRanges, range.val] }))}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    >
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-gray-100 dark:bg-slate-800'}`}>%</span>
                      {range.label}
                    </button>
                  )
                })}
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />

              {/* ── OTRAS CATEGORÍAS ── */}
              <div>
                <button onClick={() => toggleSection('others')} className="w-full flex items-center justify-between px-3 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-slate-200">Otras Categorías</span>
                  <span className="text-gray-500 dark:text-slate-400 group-hover:text-gray-500 dark:group-hover:text-slate-300 text-sm">{openSections.has('others') ? '−' : '+'}</span>
                </button>
                {openSections.has('others') && categorias.filter(c => !(c as any).isPopular).sort((a,b) => a.name.localeCompare(b.name)).map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const isFav = favCategories.includes(cat.slug)
                  const count = forMe ? promos.filter(p => p.category.name === cat.name).length : (cat.promoCount ?? 0)
                  return (
                    <div key={cat.slug} className={`flex items-center px-3 py-1.5 rounded-xl transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                      <button onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])} className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-base">{cat.icon}</span>
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400'}`}>{cat.name}</span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {count > 0 && <span className="text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">{count}</span>}
                        <button onClick={() => toggleFavCategory(cat.slug)} className={`text-base leading-none transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-400 dark:text-slate-500 hover:text-yellow-400'}`} title={isFav ? 'Quitar favorito' : 'Agregar a favoritos'}>★</button>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </nav>
        </div>

        <div className="mt-auto pt-6 border-t border-gray-100/50 dark:border-slate-800/50 space-y-4 p-6">
            {isAdmin && (
              <button
                onClick={() => {
                  const alreadyUnlocked = sessionStorage.getItem('admin_unlocked') === 'true'
                  if (alreadyUnlocked) window.location.href = '/admin'
                  else setShowPinModal(true)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-300 transition-all border border-gray-200/50 dark:border-slate-700/50"
              >
                <Settings size={12} /> Admin
              </button>
            )}

            {status === 'authenticated' ? (
              <Link href="/perfil" className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shadow-inner">
                  {nombre[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{nombre}</p>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">Mi Perfil</p>
                </div>
              </Link>
            ) : (
              <Link href="/login" className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 hover:bg-indigo-700 transition-all active:scale-95">
                <LogIn size={14} /> Iniciar Sesión
              </Link>
            )}
          </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto no-scrollbar">
        {/* Top bar sticky */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-20 shadow-sm shadow-black/[0.01]">
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest hidden lg:block">{fechaHoy()}</p>
                  <p className="text-[11px] text-gray-500 font-bold tracking-widest lg:hidden">{fechaCorta()}</p>
                  {status === 'authenticated' && (
                    <p className="text-[11px] text-indigo-600 font-bold hidden lg:block">Hola, {nombre.split(' ')[0]} 👋</p>
                  )}
                  {/* Mobile: Salir inline con la fecha */}
                  {status === 'authenticated' && (
                    <button onClick={() => { import('next-auth/react').then(m => m.signOut({ callbackUrl: '/login' })) }}
                      className="lg:hidden text-[10px] font-bold text-gray-300 hover:text-red-400 transition-colors ml-1">
                      Salir
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <img src="/logo.jpg" alt="PromoAR" className="h-7 lg:h-9 w-auto object-contain" />
                  <h1 className="text-lg lg:text-3xl font-black tracking-tighter text-gray-900 hidden lg:block">
                    {timeFilter === 'today' ? 'Promociones Hoy' : 'Catálogo de la Semana'}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-1 justify-end">
                <ThemeToggle />
                <div className="relative max-w-xs w-full hidden md:block">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar comercio..."
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                      if (searchTimer.current) clearTimeout(searchTimer.current)
                      searchTimer.current = setTimeout(() => {
                        setActiveFilters(prev => ({ ...prev, commerces: e.target.value ? [e.target.value] : [] }))
                      }, 400)
                    }}
                    className="w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white border-none rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                  {searchText && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
                      {(['startsWith', 'contains', 'exact'] as const).map(mode => (
                        <button key={mode} onClick={() => setSearchMode(mode)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${searchMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-300 dark:hover:bg-slate-500'}`}>
                          {mode === 'startsWith' ? 'Empieza' : mode === 'contains' ? 'Contiene' : 'Exacto'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsFilterOpen(true)}
                  type="button"
                  className={`hidden md:flex items-center gap-2 px-4 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer relative z-10 ${
                    getFilterChips().filter(c => c.type !== 'category').length > 0
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/50'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  Filtros
                </button>

                {/* Mobile Filter Button */}
                <button
                  onClick={() => setIsFilterOpen(true)}
                  type="button"
                  className={`md:hidden p-2 rounded-lg border transition-all cursor-pointer relative z-10 ${
                    getFilterChips().filter(c => c.type !== 'category').length > 0
                      ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-700'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <SlidersHorizontal size={18} />
                </button>

                <div className="hidden sm:flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm shrink-0">
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
            <div className="lg:hidden mt-1.5">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 items-center">
                <button
                  onClick={() => setForMe(false)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                    !forMe ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >Todas</button>
                <button
                  onClick={() => {
                    if (status === 'authenticated') {
                      if (!userProfile?.cards?.length) setWizardOpen(true)
                      else setForMe(true)
                    } else {
                      setWizardOpen(true)
                    }
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                    forMe ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >Para Mí</button>

                <div className="w-px h-4 bg-gray-200 shrink-0" />

                {(['today', 'week'] as const).map(f => (
                  <button key={f} onClick={() => setTimeFilter(f)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      timeFilter === f ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-500'
                    }`}>
                    {f === 'today' ? 'Hoy' : 'Semana'}
                  </button>
                ))}

                <div className="w-px h-4 bg-gray-200 shrink-0" />

                <button onClick={() => setIsCategoryOpen(true)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-[10px] uppercase transition-all ${
                    selectedCats.length > 0 ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700'
                  }`}>
                  <Tag size={10} /> {selectedCats.length > 0 ? `Cats (${selectedCats.length})` : 'Categorías'}
                </button>
              </div>

              {/* Chip de provincia */}
              {province && (
                <button
                  onClick={() => setShowProvinceSelector(true)}
                  className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600 w-fit"
                >
                  <MapPin size={10} /> {province}
                </button>
              )}

              {/* Búsqueda mobile (se abre desde BottomNav) */}
              {mobileSearchOpen && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                    <input
                      ref={mobileSearchRef}
                      type="text"
                      placeholder="Buscar comercio..."
                      value={searchText}
                      onChange={e => {
                        setSearchText(e.target.value)
                        if (searchTimer.current) clearTimeout(searchTimer.current)
                        searchTimer.current = setTimeout(() => {
                          setActiveFilters(prev => ({ ...prev, commerces: e.target.value ? [e.target.value] : [] }))
                        }, 400)
                      }}
                      className="w-full pl-9 pr-28 py-2 bg-gray-100 dark:bg-slate-700 dark:text-white rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
                      {(['startsWith', 'contains', 'exact'] as const).map(mode => (
                        <button key={mode} onClick={() => setSearchMode(mode)}
                          className={`px-1.5 py-1 rounded-lg text-[9px] font-black transition-all ${searchMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400'}`}>
                          {mode === 'startsWith' ? 'Empieza' : mode === 'contains' ? 'Contiene' : 'Exacto'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => { setMobileSearchOpen(false); setActiveFilters(prev => ({ ...prev, commerces: [] })) }}
                    className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Categorías: scroll horizontal, todas visibles */}
              <div className="mt-1 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {categorias.sort((a,b) => (b.promoCount ?? 0) - (a.promoCount ?? 0)).map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const count = cat.promoCount ?? 0  // usar siempre el total DB, no el filtrado
                  if (count === 0 && !isActive) return null
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                      className={`shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all border ${
                        isActive ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="text-[10px]">{cat.icon}</span>
                      <span>{cat.name}</span>
                      <span className="opacity-50">·{count}</span>
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

      {/* ── Dashboard de resumen ── */}
      {!loading && todayDashboard && (
        <div className="mb-6 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-5 text-white shadow-lg shadow-indigo-200/40 dark:shadow-indigo-900/30">
          {/* Hero */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">Hoy podés ahorrar</p>
              <p className="text-4xl sm:text-5xl font-black leading-none mt-1" style={{ color: '#c6f135' }}>
                {todayDashboard.maxDiscount > 0 ? `Hasta ${todayDashboard.maxDiscount}%` : `${todayDashboard.totalPromos} promos`}
              </p>
              <p className="text-indigo-200 text-xs font-bold mt-1">{todayDashboard.totalPromos} promociones{forMe ? ' para tu perfil' : ' disponibles'} hoy</p>
            </div>
            <Sparkles size={32} className="text-white/20 mt-1 shrink-0" />
          </div>

          {/* Semana L M X J V S D */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {todayDashboard.dayCounts.map(({ label, count, isToday, dayIdx }) => {
              const isActive = activeFilters.days.includes(dayIdx)
              return (
                <button
                  key={label + dayIdx}
                  onClick={() => setActiveFilters(prev => ({
                    ...prev,
                    days: isActive ? prev.days.filter(d => d !== dayIdx) : [...prev.days, dayIdx],
                  }))}
                  className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                    isActive ? 'bg-white/30 ring-1 ring-white/60' : isToday ? 'bg-white/15 ring-1 ring-white/30' : 'hover:bg-white/10'
                  }`}
                >
                  <span className={`text-[10px] font-black leading-none ${isToday ? 'text-white' : 'text-indigo-300'}`}>{label}</span>
                  <span className={`text-[12px] font-black tabular-nums mt-0.5 ${count > 0 ? 'text-white' : 'text-indigo-500'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Top Categorías y Comercios: 1 col en mobile, 2 en desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {todayDashboard.catList.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1.5">Top categorías</p>
              <div className="flex flex-col gap-1.5">
                {todayDashboard.catList.map(cat => {
                  const isActive = selectedCats.includes(cat.slug)
                  const isFav = favCategories.includes(cat.slug)
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                      className={`flex flex-col rounded-xl px-3 py-2 transition-all text-left ${
                        isActive ? 'bg-white/25 ring-1 ring-white/60' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                        <span className="text-sm shrink-0">{cat.icon}</span>
                        <span className="text-[11px] font-bold text-white/90 truncate">{cat.name}</span>
                        {isFav && <span className="text-yellow-300 text-[9px] shrink-0">★</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50">{cat.count} promos</span>
                        <span className="text-[13px] font-black" style={{ color: '#c6f135' }}>hasta {cat.bestDiscount}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top 5 Comercios */}
          {todayDashboard.commList.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1.5">Top comercios</p>
              <div className="flex flex-col gap-1.5">
                {todayDashboard.commList.map(c => {
                  const isFav = favCommerces.includes(c.name)
                  const isFiltered = activeFilters.commerces[0]?.toLowerCase() === c.name.toLowerCase()
                  return (
                    <button
                      key={c.name}
                      onClick={() => {
                        if (isFiltered) {
                          setActiveFilters(prev => ({ ...prev, commerces: [] }))
                          setSearchText('')
                        } else {
                          setSearchMode('exact')
                          setActiveFilters(prev => ({ ...prev, commerces: [c.name] }))
                          setSearchText(c.name)
                        }
                      }}
                      className={`flex flex-col rounded-xl px-3 py-2 transition-all text-left ${
                        isFiltered ? 'bg-white/25 ring-1 ring-white/60' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5 min-w-0">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt={c.name} className="h-5 w-5 object-contain rounded shrink-0 bg-white/90 p-0.5" />
                        ) : (
                          <span className="h-5 w-5 flex items-center justify-center bg-white/20 rounded text-[9px] font-black shrink-0">{c.name.slice(0,2).toUpperCase()}</span>
                        )}
                        <span className="text-[11px] font-bold text-white/90 truncate">{c.name}</span>
                        {isFav && <span className="text-yellow-300 text-[9px] shrink-0">★</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50">{c.count} promos</span>
                        <span className="text-[12px] font-black" style={{ color: '#c6f135' }}>hasta {c.bestDiscount}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          </div>{/* fin grid 2 columnas */}
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
            <p className="text-gray-900 font-medium">No encontramos promos{selectedCats.length > 0 ? ` en estas categorías` : ''}</p>
            <p className="text-sm text-gray-500 mt-2 max-w-[250px] mx-auto">Probá otra categoría o ajustá los filtros.</p>
          </div>
        )}

        {/* ── LAYOUT NETFLIX: secciones por categoría ── */}
        {!loading && promosFiltradas.length > 0 && (() => {
          // Agrupar por categoría
          const catOrder: string[] = []
          const byCat = new Map<string, { catName: string; catIcon: string; catColor: string; promos: typeof promosFiltradas }>()
          for (const p of promosFiltradas) {
            const key = p.category.slug ?? p.category.name
            if (!byCat.has(key)) {
              catOrder.push(key)
              byCat.set(key, { catName: p.category.name, catIcon: p.category.icon ?? '🏷️', catColor: p.category.color, promos: [] })
            }
            byCat.get(key)!.promos.push(p)
          }

          // Destacadas: top 6 por descuento
          const destacadas = [...promosFiltradas]
            .filter(p => bestPercentageReq(p)?.discountValue)
            .sort((a, b) => (bestPercentageReq(b)?.discountValue ?? 0) - (bestPercentageReq(a)?.discountValue ?? 0))
            .slice(0, 6)

          const PromoCard = ({ promo }: { promo: typeof promosFiltradas[0] }) => {
            const req = maxDiscountReq(promo)
            const pctReq = bestPercentageReq(promo)
            const label = discountLabel(promo)
            const banks = Array.from(new Map(promo.requirements.filter(r => r.bank?.name).map(r => [r.bank!.name, r.bank!])).values())
            const wallets = Array.from(new Map(promo.requirements.filter(r => r.wallet?.name).map(r => [r.wallet!.name, r.wallet!])).values())
            const entities = [...banks, ...wallets].slice(0, 2)
            const days = formatValidDays(promo.validDays)

            return (
              <div
                onClick={() => promo.slug ? router.push(`/promos/${promo.slug}`) : null}
                className="bg-white border border-[#EAECF0] rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 transition-shadow hover:shadow-md active:scale-[0.98]"
                style={{ width: 'calc((100vw - 48px) / 2.1)', minWidth: 148, maxWidth: 175 }}
              >
                {/* Imagen/Logo */}
                <div className="relative bg-[#F8F9FB] border-b border-[#F0F2F5] flex items-center justify-center" style={{ height: 80 }}>
                  {promo.commerce.logoUrl ? (
                    <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="max-h-12 max-w-[80%] object-contain p-2" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black" style={{ background: promo.category.color + '20', color: promo.category.color }}>
                      {promo.category.icon ?? '🏷️'}
                    </div>
                  )}
                  {/* Badge descuento */}
                  {label && (
                    <div className="absolute top-2 right-2 bg-[#D94F2B] text-white text-[10px] font-800 font-black px-1.5 py-0.5 rounded-md leading-tight">
                      {pctReq ? `${pctReq.discountValue}%` : label.replace('Hasta ', '')}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="px-2.5 pt-2 pb-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-[#1E3A5F] truncate leading-tight">{promo.commerce.name}</p>
                  <p className="text-[10px] text-[#8B96A5] leading-tight truncate">{promo.title !== promo.commerce.name ? promo.title : label}</p>

                  {/* Entidades */}
                  {entities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entities.map((e, i) => (
                        <span key={i} className="text-[9px] font-600 font-semibold px-1.5 py-0.5 rounded-md bg-[#EEF2F8] text-[#3A5A7A]">
                          {e.name.split(' ').slice(-1)[0]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Días */}
                  <p className="text-[9.5px] text-[#8B96A5]">{days === 'Todos los días' ? 'Todos los días' : days.replace('Lunes a viernes', 'Lun–Vie')}</p>
                </div>
              </div>
            )
          }

          return (
            <div className="space-y-0 -mx-4">

              {/* Destacadas */}
              {destacadas.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-baseline justify-between px-4 mb-3">
                    <div>
                      <p className="text-[15px] font-800 font-black text-[#1E3A5F]">⭐ Destacadas hoy</p>
                      <p className="text-[11px] text-[#8B96A5] mt-0.5">Mejores descuentos del día</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                    {destacadas.map(p => <PromoCard key={p.id} promo={p} />)}
                  </div>
                </div>
              )}

              {/* Secciones por categoría */}
              {catOrder.map(key => {
                const sec = byCat.get(key)!
                return (
                  <div key={key} className="mb-5">
                    <div className="flex items-baseline justify-between px-4 mb-3">
                      <div>
                        <p className="text-[15px] font-black text-[#1E3A5F]">{sec.catIcon} {sec.catName}</p>
                        <p className="text-[11px] text-[#8B96A5] mt-0.5">{sec.promos.length} promos</p>
                      </div>
                      {sec.promos.length > 4 && (
                        <button
                          onClick={() => setSelectedCats([key])}
                          className="text-[12px] font-semibold text-[#D94F2B]"
                        >
                          Ver todas →
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                      {sec.promos.map(p => <PromoCard key={p.id} promo={p} />)}
                    </div>
                    <div className="h-px bg-[#F0F2F5] mt-5 mx-4" />
                  </div>
                )
              })}

            </div>
          )
        })()}

      </div>
    </main>

    </div>{/* fin flex row sidebar+content */}

    {/* ══════════ FOOTER ══════════ */}
    <footer className="bg-slate-900 text-slate-400 mt-12 pb-24">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div>
            <p className="text-white font-black text-sm mb-3">PromoAR</p>
            <ul className="space-y-2 text-xs">
              <li><a href="/como-funciona" className="hover:text-white transition-colors">Cómo funciona</a></li>
              <li><a href="/faq" className="hover:text-white transition-colors">Preguntas frecuentes</a></li>
              <li><a href="/quienes-somos" className="hover:text-white transition-colors">Quiénes somos</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-black text-sm mb-3">Legal</p>
            <ul className="space-y-2 text-xs">
              <li><a href="/privacidad" className="hover:text-white transition-colors">Política de privacidad</a></li>
              <li><a href="/terminos" className="hover:text-white transition-colors">Términos y condiciones</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-black text-sm mb-3">Contacto</p>
            <ul className="space-y-2 text-xs">
              <li><a href="/contacto" className="hover:text-white transition-colors">Contactanos</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-black text-sm mb-3">Seguinos</p>
            <div className="flex gap-3 mt-1">
              <a href="https://facebook.com/promoar" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" title="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://instagram.com/promoar" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" title="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://x.com/promoar" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" title="X (Twitter)">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://tiktok.com/@promoar" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" title="TikTok">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.19 8.19 0 0 0 4.79 1.53V6.75a4.85 4.85 0 0 1-1.02-.06z"/></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 text-center text-xs">
          <p>© 2026 PromoAR. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>

      {entitiesPromo && (
        <EntitiesSheet
          commerceName={entitiesPromo.commerce.name}
          requirements={entitiesPromo.requirements}
          onCloseAction={() => setEntitiesPromo(null)}
        />
      )}

      <BottomNav
        onFilter={() => setIsFilterOpen(true)}
        onSearch={() => { setMobileSearchOpen(v => !v); setTimeout(() => mobileSearchRef.current?.focus(), 100) }}
      />
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

      {/* Selector de provincia */}
      {showProvinceSelector && (
        <ProvinceSelector
          currentProvince={province || undefined}
          onSelect={(prov) => {
            setProvince(prov)
            localStorage.setItem('userProvince', prov)
            setShowProvinceSelector(false)
          }}
          onDismiss={() => setShowProvinceSelector(false)}
        />
      )}
    </div>
  )
}

export default function Home() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Cargando...</p></div>}><HomeContent /></Suspense>
}