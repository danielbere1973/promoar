'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Calendar, Tag, Settings, X, Search, Sparkles, Heart, Info, Smartphone, Clock, Globe, SlidersHorizontal, LogIn, MapPin, ShoppingBag, UserCircle, ChevronDown } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import { FilterState } from '../components/FilterDrawer'
import ActiveFilters from '../components/ActiveFilters'
import { CARD_NETWORK_LOGOS } from '../components/EntitiesSheet'
import PromoCard from '../components/PromoCard'
import CommerceGroupCard from '../components/CommerceGroupCard'
import { GuestProfile } from '../components/PromoWizard'
import ThemeToggle from '../components/ThemeToggle'
import SplashScreen from '../components/SplashScreen'
import { useTracking } from '@/lib/useTracking'

const FilterDrawer = dynamic(() => import('../components/FilterDrawer'), { ssr: false })
const EntitiesSheet = dynamic(() => import('../components/EntitiesSheet'), { ssr: false })
const PromoDetailSheet = dynamic(() => import('../components/PromoDetailSheet'), { ssr: false })
const PromoWizard = dynamic(() => import('../components/PromoWizard'), { ssr: false })
const ProvinceSelector = dynamic(() => import('../components/ProvinceSelector'), { ssr: false })

// Caché de módulo: sobrevive navegaciones internas, se limpia con F5
// TTL de 5 minutos para la carga por defecto (sin filtros complejos)
const CACHE_TTL_MS = 5 * 60 * 1000
type PromoCache = { promos: Promo[]; key: string; ts: number }
let _promoCache: PromoCache | null = null

function getCached(key: string): Promo[] | null {
  if (!_promoCache) return null
  if (_promoCache.key !== key) return null
  if (Date.now() - _promoCache.ts > CACHE_TTL_MS) return null
  return _promoCache.promos
}

function setCache(key: string, promos: Promo[]) {
  _promoCache = { promos, key, ts: Date.now() }
}

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
  bank?: { id: string; name: string; logoUrl?: string | null } | null
  wallet?: { id: string; name: string; logoUrl?: string | null } | null
  cardNetwork?: { id?: string; name: string; slug: string } | null
  cardType?: string | null
  paymentChannel?: string | null
  accountType?: string | null
  segment?: string | null
  cardTier?: string | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
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
  commerce: { id?: string; name: string; logoUrl?: string | null; instagramUrl?: string | null }
  requirements: Req[]
  validFrom: string
  validUntil: string | null
  isSaved?: boolean
  globalMaxDiscount?: Req | null
  userBestDiscount?: Req | null
}

type NearbyBranch = { address: string | null; city: string | null; province: string | null; lat: number; lng: number; distanceKm: number }
type NearbyBranches = { count: number; minDistKm: number; branches: NearbyBranch[] }

type Categoria = { id: string; name: string; slug: string; icon: string; color: string; promoCount?: number }

type ProductCommerceResult = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  matchedCategories: string[]
  promoCount: number
  promos: Promo[]
}

// Orden de prioridad para secciones de categorías y "Destacadas hoy"
const PRIORITY_CAT_SLUGS = ['supermercados', 'combustible', 'transporte', 'gastronomia', 'farmacias']

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
  const nxmReq = !pctReq ? p.requirements.find(r => r.discountType === 'NXM') : null
  const req = pctReq ?? nxmReq ?? maxDiscountReq(p)
  if (!req) return ''
  if (req.discountType === 'NXM') return `${req.nxmN ?? 2}x${req.nxmM ?? 1}`
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

export default function PromosClient({ initialPromos, initialCats, initialTotalCount }: { initialPromos: Promo[] | null, initialCats: string[], initialTotalCount: number }) {
  const { data: session, status } = useSession()
  const nombre = session?.user?.name || 'Invitado'
  const iniciales = (() => {
    const parts = nombre.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return nombre.slice(0, 2).toUpperCase()
  })()
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'
  const searchParams = useSearchParams()
  const { track } = useTracking()
  const router = useRouter()
  const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const [promos, setPromos] = useState<Promo[]>(initialPromos ?? [])
  const [loading, setLoading] = useState(initialPromos === null)

  // Seedear el cache con las promos del SSR para que el primer fetch del cliente
  // sea un cache hit y no haga una llamada al API innecesaria.
  // La clave debe coincidir con la que construye el useEffect de carga para
  // un invitado sin filtros: for_me=false&view=today
  const ssrCacheSeeded = useRef(false)
  useEffect(() => {
    if (ssrCacheSeeded.current || !initialPromos?.length) return
    setCache('for_me=false&view=today', initialPromos)
    ssrCacheSeeded.current = true
  }, [])

  // Splash solo en la primera carga de la sesión
  // Siempre true en SSR para evitar hydration mismatch — useEffect lo oculta si ya fue visto
  const [showSplash, setShowSplash] = useState(true)
  useEffect(() => {
    if (sessionStorage.getItem('splashDone')) setShowSplash(false)
  }, [])
  const [visibleCount, setVisibleCount] = useState(20)
  const [loadingAll, setLoadingAll] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [focusedCatPromos, setFocusedCatPromos] = useState<Promo[]>([])
  const [focusedCatLoading, setFocusedCatLoading] = useState(false)
  const prevFilterKeyRef = useRef('')
  const [showAccessDenied, setShowAccessDenied] = useState(
    searchParams.get('error') === 'no-autorizado'
  )

  const categoriaParam = searchParams.get('categoria')
  const [selectedCats, setSelectedCats] = useState<string[]>(initialCats)
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null)
  const [detailPromo, setDetailPromo] = useState<Promo | null>(null)

  const openPromoDetail = React.useCallback((promo: Promo) => {
    setDetailPromo(promo)
    if (promo.slug) {
      window.history.pushState({ promoSlug: promo.slug }, '', `/promos/${promo.slug}`)
    }
  }, [])

  const closePromoDetail = React.useCallback(() => {
    setDetailPromo(null)
    if (window.location.pathname !== '/promos') {
      window.history.replaceState({}, '', '/promos')
    }
  }, [])

  React.useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname === '/promos') {
        setDetailPromo(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const [focusedCat, setFocusedCat] = useState<string | null>(null)
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
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const [searchTab, setSearchTab] = useState<'comercios' | 'productos'>('comercios')
  const [searchText, setSearchText] = useState('')
  const [searchMode, setSearchMode] = useState<'startsWith' | 'contains' | 'exact'>('startsWith')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Búsqueda de productos: resultados agrupados por comercio, mostrados in-page (mismo esquema que comercios)
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<ProductCommerceResult[]>([])
  const [productSearchLoading, setProductSearchLoading] = useState(false)
  const [productSearched, setProductSearched] = useState(false)
  const [productCategoryFilter, setProductCategoryFilter] = useState<string | null>(null)
  const productSearchRef = useRef<HTMLInputElement>(null)
  const productDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [province, setProvince] = useState<string | null>(null)
  const [showProvinceSelector, setShowProvinceSelector] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [favCategories, setFavCategories] = useState<string[]>([]) // slugs, max 3
  const [favCommerces, setFavCommerces] = useState<string[]>([])   // nombres, max 5
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['favorites', 'popular']))
  const [nearbyBranches, setNearbyBranches] = useState<Record<string, NearbyBranches>>({})

  // Geolocalización: pedir una vez, cachear en localStorage 1h
  useEffect(() => {
    const cached = localStorage.getItem('userLocation')
    if (cached) {
      try {
        const { lat, lng, ts } = JSON.parse(cached)
        if (Date.now() - ts < 3600000) {
          fetch(`/api/branches/nearby?lat=${lat}&lng=${lng}&radius=10`)
            .then(r => r.json()).then(setNearbyBranches).catch(() => {})
          return
        }
      } catch {}
    }
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }))
      fetch(`/api/branches/nearby?lat=${lat}&lng=${lng}&radius=10`)
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
  const prevCatsRef = useRef<string[]>([])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (selectedCats.length > 0) {
      params.set('cats', selectedCats.join(','))
    } else {
      params.delete('cats')
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)

    // Trackear cambios de categoría (no el restore inicial desde URL)
    if (prevCatsRef.current.length > 0 || selectedCats.length > 0) {
      const added = selectedCats.filter(s => !prevCatsRef.current.includes(s))
      const removed = prevCatsRef.current.filter(s => !selectedCats.includes(s))
      added.forEach(slug => {
        const cat = categorias.find(c => c.slug === slug)
        track({ type: 'CATEGORY_CLICK', categorySlug: slug, categoryName: cat?.name ?? slug, action: 'select' })
      })
      removed.forEach(slug => {
        const cat = categorias.find(c => c.slug === slug)
        track({ type: 'CATEGORY_CLICK', categorySlug: slug, categoryName: cat?.name ?? slug, action: 'deselect' })
      })
    }
    prevCatsRef.current = selectedCats
  }, [selectedCats])

  useEffect(() => {
    if (status === 'loading') return;

    const controller = new AbortController()

    async function load() {
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
      if (forMe && guestProfile?.cards?.length && status !== 'authenticated') {
        qParams.set('guest_profile', btoa(JSON.stringify(guestProfile)))
      }
      if (province) qParams.set('province', province)

      // Detectar cambio de filtros para resetear paginación
      const filterKey = `${status}|${forMe}|${selectedCats.join(',')}|${JSON.stringify(activeFilters)}|${timeFilter}|${province}|${session?.user?.email}`
      const filtersChanged = filterKey !== prevFilterKeyRef.current
      if (filtersChanged) {
        prevFilterKeyRef.current = filterKey
        if (page !== 1) {
          setPage(1)  // resetea; el efecto se re-ejecuta con page=1
          return
        }
      }

      if (page > 1) {
        qParams.set('page', String(page))
      }

      const cacheKey = qParams.toString()

      // Caché hit solo para page=1
      if (page === 1) {
        const cached = getCached(cacheKey)
        if (cached) {
          setPromos(cached)
          setLoading(false)
          setHasMore(false)
          return
        }
      }

      if (page > 1) {
        setLoadingMore(true)
      } else if (promos.length === 0) {
        // Solo mostrar spinner si no hay contenido SSR previo — evita borrar las
        // promos del servidor mientras el cliente hace el primer fetch.
        setLoading(true)
      }
      try {
        const res = await fetch(`/api/promos?${cacheKey}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          if (page > 1) {
            setPromos(prev => [...prev, ...(data.promos ?? [])])
          } else {
            setCache(cacheKey, data.promos)
            setPromos(data.promos ?? [])
            setVisibleCount(20)
          }
          setHasMore(data.hasMore ?? false)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error(e)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    }
    load()
    return () => controller.abort()
  }, [session?.user?.email, status, selectedCats, activeFilters, forMe, timeFilter, guestProfile, province, searchMode, page])

  // "Ver todas" de una categoría: fetch on-demand cuando se abre el overlay
  useEffect(() => {
    if (!focusedCat || status === 'loading') return
    let cancelled = false
    setFocusedCatLoading(true)
    setFocusedCatPromos([])
    const qp = new URLSearchParams()
    qp.set('categories', focusedCat)
    qp.set('view', timeFilter)
    qp.set('for_me', String(forMe))
    if (activeFilters.banks.length) qp.set('banks', activeFilters.banks.join(','))
    if (activeFilters.wallets.length) qp.set('wallets', activeFilters.wallets.join(','))
    if (activeFilters.networks.length) qp.set('networks', activeFilters.networks.join(','))
    if (activeFilters.days.length) qp.set('days', activeFilters.days.join(','))
    if (activeFilters.channels.length) qp.set('channels', activeFilters.channels.join(','))
    if (activeFilters.discountRanges.length) qp.set('discountRanges', activeFilters.discountRanges.join(','))
    if (activeFilters.hasInstallments !== null) qp.set('hasInstallments', String(activeFilters.hasInstallments))
    if (forMe && guestProfile?.cards?.length && status !== 'authenticated') {
      qp.set('guest_profile', btoa(JSON.stringify(guestProfile)))
    }
    if (province) qp.set('province', province)
    fetch(`/api/promos?${qp.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled) setFocusedCatPromos(d.promos ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFocusedCatLoading(false) })
    return () => { cancelled = true }
  }, [focusedCat, status, forMe, timeFilter, activeFilters, guestProfile, province, session?.user?.email])

  // Tracking de forMe y timeFilter
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    track({ type: 'FOR_ME_TOGGLE', value: forMe })
  }, [forMe])
  useEffect(() => {
    if (isFirstRender.current) return
    track({ type: 'TIME_FILTER', value: timeFilter })
  }, [timeFilter])

  // Búsqueda de productos: debounced fetch a /api/search/products, resultados agrupados por comercio
  useEffect(() => {
    if (productDebounce.current) clearTimeout(productDebounce.current)
    const q = productQuery.trim()
    setProductCategoryFilter(null)
    if (searchTab !== 'productos' || q.length < 2) {
      setProductResults([]); setProductSearched(false); setProductSearchLoading(false)
      return
    }
    setProductSearchLoading(true)
    productDebounce.current = setTimeout(async () => {
      try {
        let url = `/api/search/products?q=${encodeURIComponent(q)}&for_me=${forMe}`
        if (forMe && guestProfile?.cards?.length && status !== 'authenticated') {
          url += `&guest_profile=${encodeURIComponent(btoa(JSON.stringify(guestProfile)))}`
        }
        const res = await fetch(url)
        const data = await res.json()
        setProductResults(data.commerces ?? [])
      } catch {
        setProductResults([])
      } finally {
        setProductSearchLoading(false)
        setProductSearched(true)
      }
    }, 400)
    return () => { if (productDebounce.current) clearTimeout(productDebounce.current) }
  }, [productQuery, searchTab, forMe, guestProfile, status])

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

  // Entidades disponibles dinámicamente según promosFiltradas + perfil
  const availableEntities = useMemo(() => {
    const source = promos
    const banksMap = new Map<string, { id: string; name: string; logoUrl?: string | null }>()
    const walletsMap = new Map<string, { id: string; name: string; logoUrl?: string | null }>()
    const networksMap = new Map<string, { id: string; name: string; slug: string }>()
    for (const p of source) {
      for (const r of p.requirements) {
        if (r.bank?.name) banksMap.set(r.bank.name, r.bank as any)
        if (r.wallet?.name) walletsMap.set(r.wallet.name, r.wallet as any)
        if (r.cardNetwork?.name) networksMap.set(r.cardNetwork.name, r.cardNetwork as any)
      }
    }
    let banks = Array.from(banksMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    let wallets = Array.from(walletsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    let networks = Array.from(networksMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    // En modo "Para Mí", filtrar por perfil del usuario
    if (forMe && userProfile) {
      const profileBankIds = new Set(userProfile.banks.map((b: any) => b.bankId))
      const profileWalletIds = new Set(userProfile.wallets.map((w: any) => w.walletId))
      const profileNetworkIds = new Set(userProfile.cards.map((c: any) => c.cardNetworkId).filter(Boolean))
      if (profileBankIds.size > 0) banks = banks.filter(b => b.id && profileBankIds.has(b.id))
      if (profileWalletIds.size > 0) wallets = wallets.filter(w => w.id && profileWalletIds.has(w.id))
      if (profileNetworkIds.size > 0) networks = networks.filter(n => n.id && profileNetworkIds.has(n.id))
    }

    return { banks, wallets, networks }
  }, [promos, forMe, userProfile])

  // Modo búsqueda de productos: reemplaza el feed por categoría con resultados agrupados por comercio
  const isProductSearchMode = searchTab === 'productos' && productQuery.trim().length >= 2

  // Categorías populares: por cantidad de comercios únicos (no promos totales)
  // En modo búsqueda de productos, derivar de los resultados de la búsqueda (no del feed general)
  // para que el menú lateral refleje las categorías involucradas en lo buscado
  const popularCatsByCommerce = useMemo(() => {
    const source = isProductSearchMode
      ? productResults.flatMap(c => c.promos.map(p => ({ category: p.category, commerce: { name: c.name } })))
      : promos
    const commercesPerCat = new Map<string, Set<string>>()
    for (const p of source) {
      const key = p.category.slug ?? p.category.name
      if (!commercesPerCat.has(key)) commercesPerCat.set(key, new Set())
      commercesPerCat.get(key)!.add(p.commerce.name)
    }
    return Array.from(commercesPerCat.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 6)
      .map(([slug]) => slug)
  }, [promos, isProductSearchMode, productResults])

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
      .filter(c => c.bestDiscount > 0 && c.bestDiscount <= 100)
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

    return { totalPromos: Math.max(promos.length, initialTotalCount), maxDiscount, dayCounts, catList, commList }
  }, [promos, selectedCats, favCategories, favCommerces, activeFilters.commerces, initialTotalCount])

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
    <>
    {showSplash && <SplashScreen loading={loading} onDone={() => { sessionStorage.setItem('splashDone', '1'); setShowSplash(false) }} />}
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col">
    <div className="flex flex-1">
      {/* ── Sidebar (Desktop) ── */}
      <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 border-r border-gray-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-950 z-30 overflow-hidden">
        {/* Logo */}
        <div className="flex items-center justify-center bg-white border-b border-gray-100 dark:border-slate-700 py-6 px-6 shrink-0">
          <img src="/promoar_gabi_transparente.png" alt="PromoAR" className="w-full h-auto object-contain" />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-6 pt-4">
          <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar pr-2">
            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-3">Explorar</p>
            <div className="flex gap-1 px-3 mb-6">
              <button
                onClick={() => setForMe(false)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  !forMe ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
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
                  forMe ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
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
                    timeFilter === f ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {f === 'today' ? 'Hoy' : 'Semana'}
                </button>
              ))}
            </div>

            <div className="space-y-1">

              {/* ── MIS FAVORITOS ── */}
              <div>
                <button onClick={() => toggleSection('favorites')} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Mis Favoritos</span>
                  <span className="text-gray-500 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-300 text-base font-bold">{openSections.has('favorites') ? '−' : '+'}</span>
                </button>
                {openSections.has('favorites') && (
                  <div className="mt-2 space-y-4 px-3">
                    <div>
                      <p className="text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                        Categorías <span className="text-gray-400 dark:text-slate-500 font-bold">({favCategories.length}/3)</span>
                      </p>
                      {favCategories.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic px-1 py-1">Marcá ★ en una categoría</p>
                      )}
                      {favCategories.map(slug => {
                        const cat = categorias.find(c => c.slug === slug)
                        if (!cat) return null
                        const isActive = selectedCats.includes(slug)
                        return (
                          <div key={slug} className={`flex items-center justify-between px-2 py-2 rounded-xl ${isActive ? 'bg-[#EEF2F8] dark:bg-[#1E3A5F]/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                            <button onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== slug) : [...prev, slug])} className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-lg">{cat.icon}</span>
                              <span className={`text-sm font-bold truncate ${isActive ? 'text-[#1E3A5F] dark:text-blue-300' : 'text-gray-700 dark:text-slate-300'}`}>{cat.name}</span>
                            </button>
                            <button onClick={() => toggleFavCategory(slug)} className="text-yellow-400 hover:text-gray-300 dark:hover:text-slate-600 ml-2 shrink-0 text-lg" title="Quitar de favoritos">★</button>
                          </div>
                        )
                      })}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                        Comercios <span className="text-gray-400 dark:text-slate-500 font-bold">({favCommerces.length}/5)</span>
                      </p>
                      {favCommerces.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic px-1 py-1">Marcá ★ en un comercio</p>
                      )}
                      {favCommerces.map(name => (
                        <div key={name} className="flex items-center justify-between px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
                          <span className="text-sm font-bold text-gray-700 dark:text-slate-300 truncate flex-1">{name}</span>
                          <button onClick={() => toggleFavCommerce(name)} className="text-yellow-400 hover:text-gray-300 dark:hover:text-slate-600 ml-2 shrink-0 text-lg" title="Quitar de favoritos">★</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />

              {/* ── BANCOS ── */}
              {availableEntities.banks.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('banks')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Bancos</span>
                    <span className="text-sm font-bold text-gray-500">{openSections.has('banks') ? '−' : '+'}</span>
                  </button>
                  {openSections.has('banks') && availableEntities.banks.map(b => {
                    const isActive = activeFilters.banks.includes((b as any).id)
                    return (
                      <button key={(b as any).id} onClick={() => setActiveFilters(prev => ({ ...prev, banks: isActive ? prev.banks.filter(id => id !== (b as any).id) : [...prev.banks, (b as any).id] }))}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isActive ? 'bg-[#EEF2F8] text-[#1E3A5F] dark:bg-[#1E3A5F]/20 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                        {b.logoUrl && <img src={b.logoUrl} alt="" className="w-5 h-5 object-contain rounded shrink-0" />}
                        <span className="truncate">{b.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {availableEntities.wallets.length > 0 && <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />}

              {/* ── BILLETERAS ── */}
              {availableEntities.wallets.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('wallets')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Billeteras</span>
                    <span className="text-sm font-bold text-gray-500">{openSections.has('wallets') ? '−' : '+'}</span>
                  </button>
                  {openSections.has('wallets') && availableEntities.wallets.map(w => {
                    const isActive = activeFilters.wallets.includes((w as any).id)
                    return (
                      <button key={(w as any).id} onClick={() => setActiveFilters(prev => ({ ...prev, wallets: isActive ? prev.wallets.filter(id => id !== (w as any).id) : [...prev.wallets, (w as any).id] }))}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isActive ? 'bg-[#EEF2F8] text-[#1E3A5F] dark:bg-[#1E3A5F]/20 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                        {w.logoUrl && <img src={w.logoUrl} alt="" className="w-5 h-5 object-contain rounded shrink-0" />}
                        <span className="truncate">{w.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />

              {/* ── TARJETAS ── */}
              {availableEntities.networks.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('networks')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Tarjetas</span>
                    <span className="text-sm font-bold text-gray-500">{openSections.has('networks') ? '−' : '+'}</span>
                  </button>
                  {openSections.has('networks') && availableEntities.networks.map(n => {
                    const isActive = activeFilters.networks.includes((n as any).id)
                    return (
                      <button key={(n as any).id ?? n.name}
                        onClick={() => setActiveFilters(prev => ({ ...prev, networks: isActive ? prev.networks.filter(id => id !== (n as any).id) : [...prev.networks, (n as any).id] }))}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isActive ? 'bg-[#EEF2F8] text-[#1E3A5F] dark:bg-[#1E3A5F]/20 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                        <span className="truncate">{n.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {availableEntities.networks.length > 0 && <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />}

              {/* ── DÍAS ── */}
              <div>
                <button onClick={() => toggleSection('days')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Días</span>
                  <span className="text-sm font-bold text-gray-500">{openSections.has('days') ? '−' : '+'}</span>
                </button>
                {openSections.has('days') && (
                  <div className="flex gap-1 px-3 pb-2 flex-wrap">
                    {[{l:'L',b:2},{l:'M',b:4},{l:'X',b:8},{l:'J',b:16},{l:'V',b:32},{l:'S',b:64},{l:'D',b:1}].map(({l, b}) => {
                      const isActive = activeFilters.days.includes(b)
                      return (
                        <button key={l} onClick={() => setActiveFilters(prev => ({ ...prev, days: isActive ? prev.days.filter(d => d !== b) : [...prev.days, b] }))}
                          className={`w-8 h-8 rounded-full text-xs font-black transition-all ${isActive ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 hover:bg-gray-200'}`}>
                          {l}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-800 mx-3" />

              {/* ── CON TOPE / MÍNIMO / CSI ── */}
              <div>
                <button onClick={() => toggleSection('extras')} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-slate-200">Condiciones</span>
                  <span className="text-sm font-bold text-gray-500">{openSections.has('extras') ? '−' : '+'}</span>
                </button>
                {openSections.has('extras') && (
                  <div className="space-y-1 px-1">
                    {[
                      { label: 'Con tope de reintegro', key: 'hasCap', val: true },
                      { label: 'Sin tope', key: 'hasCap', val: false },
                      { label: 'Con cuotas sin interés', key: 'hasInstallments', val: true },
                    ].map(({ label, key, val }) => {
                      const isActive = (activeFilters as any)[key] === val
                      return (
                        <button key={label} onClick={() => setActiveFilters(prev => ({ ...prev, [key]: isActive ? null : val }))}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isActive ? 'bg-[#EEF2F8] text-[#1E3A5F] dark:bg-[#1E3A5F]/20 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isActive ? 'border-[#1E3A5F] bg-[#1E3A5F]' : 'border-gray-300'}`}>
                            {isActive && <span className="text-white text-[8px] font-black">✓</span>}
                          </span>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
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

              {/* ── CATEGORÍAS ── */}
              <div>
                <button onClick={() => toggleSection('others')} className="w-full flex items-center justify-between px-3 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-slate-200">Categorías</span>
                  <span className="text-gray-500 dark:text-slate-400 group-hover:text-gray-500 dark:group-hover:text-slate-300 text-sm">{openSections.has('others') ? '−' : '+'}</span>
                </button>
                {openSections.has('others') && categorias.sort((a,b) => a.name.localeCompare(b.name)).map(cat => {
                  const isActive = isProductSearchMode ? productCategoryFilter === cat.name : selectedCats.includes(cat.slug)
                  const isFav = favCategories.includes(cat.slug)
                  const count = isProductSearchMode
                    ? productResults.flatMap(c2 => c2.promos).filter(p => p.category.name === cat.name).length
                    : (forMe ? promos.filter(p => p.category.name === cat.name).length : (cat.promoCount ?? 0))
                  const handleClick = () => {
                    if (isProductSearchMode) {
                      setProductCategoryFilter(prev => prev === cat.name ? null : cat.name)
                    } else {
                      setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])
                    }
                  }
                  return (
                    <div key={cat.slug} className={`flex items-center px-3 py-1.5 rounded-xl transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                      <button onClick={handleClick} className="flex items-center gap-2 flex-1 min-w-0">
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
        </div>{/* flex-1 wrapper */}

        <div className="shrink-0 pt-4 border-t border-gray-100/50 dark:border-slate-800/50 space-y-3 px-6 pb-6">
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
                <div className="w-10 h-10 rounded-full bg-[#EEF2F8] dark:bg-[#1E3A5F]/30 flex items-center justify-center text-[#1E3A5F] dark:text-blue-300 font-bold shadow-inner">
                  {nombre[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{nombre}</p>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">Mi Perfil</p>
                </div>
              </Link>
            ) : (
              <Link href="/login" className="flex items-center justify-center gap-2 w-full py-3 bg-[#1E3A5F] text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#142840] transition-all active:scale-95">
                <LogIn size={14} /> Iniciar Sesión
              </Link>
            )}
          </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto no-scrollbar">
        {/* Top bar sticky */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-20 shadow-sm shadow-black/[0.01]">
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                {/* Desktop: fecha + saludo */}
                <div className="hidden lg:flex items-center gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{fechaHoy()}</p>
                  {status === 'authenticated' && (
                    <p className="text-[11px] text-[#1E3A5F] font-bold">Hola, {nombre.split(' ')[0]} 👋</p>
                  )}
                </div>
                <h1 className="text-lg lg:text-3xl font-black tracking-tighter text-[#1E3A5F] dark:text-white hidden lg:block mt-0.5">
                  {timeFilter === 'today' ? 'Promociones Hoy' : 'Catálogo de la Semana'}
                </h1>
              </div>

              <div className="flex items-center gap-3 flex-1 justify-end">
                <div className="hidden md:flex items-center bg-gray-100 dark:bg-slate-700 rounded-2xl overflow-hidden h-10 w-96">
                  <button onClick={() => setSearchTab('comercios')}
                    className={`px-3 h-full text-[10px] font-black uppercase whitespace-nowrap border-r border-gray-200 dark:border-slate-600 transition-all ${
                      searchTab === 'comercios' ? 'bg-gray-900 text-white' : 'text-gray-400 dark:text-slate-400 hover:text-gray-600'
                    }`}>
                    Comercios
                  </button>
                  <button onClick={() => setSearchTab('productos')}
                    className={`px-3 h-full text-[10px] font-black uppercase whitespace-nowrap border-r border-gray-200 dark:border-slate-600 transition-all ${
                      searchTab === 'productos' ? 'bg-gray-900 text-white' : 'text-gray-400 dark:text-slate-400 hover:text-gray-600'
                    }`}>
                    Productos
                  </button>
                  <div className="relative flex-1 h-full">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                    {searchTab === 'comercios' ? (
                      <input
                        type="text"
                        placeholder="Buscar comercio..."
                        value={searchText}
                        onChange={(e) => {
                          setSearchText(e.target.value)
                          if (searchTimer.current) clearTimeout(searchTimer.current)
                          searchTimer.current = setTimeout(() => {
                            const val = e.target.value
                            setActiveFilters(prev => ({ ...prev, commerces: val ? [val] : [] }))
                            if (val) track({ type: 'COMMERCE_SEARCH', query: val })
                          }, 400)
                        }}
                        className="w-full h-full pl-8 pr-3 bg-transparent text-gray-900 dark:text-white text-[11px] font-medium outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="Ej: zapatillas, carteras..."
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        className="w-full h-full pl-8 pr-3 bg-transparent text-gray-900 dark:text-white text-[11px] font-medium outline-none"
                      />
                    )}
                  </div>
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

                <div className="hidden sm:flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm shrink-0">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </button>
                </div>
                <div className="hidden lg:block"><ThemeToggle /></div>
              </div>
            </div>

            {/* Mobile-only header rediseñado (estilo Mercado Libre) */}
            <div className="lg:hidden mt-2.5 space-y-2.5">
              {/* Avatar / iniciales + saludo + fecha */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                  status === 'authenticated' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}>
                  {status === 'authenticated' ? iniciales : <UserCircle size={18} />}
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[12px] font-black text-gray-900 dark:text-white truncate">
                    {status === 'authenticated' ? `Hola, ${nombre.split(' ')[0]}` : 'Invitado'}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">{fechaCorta()}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <ThemeToggle />
                  {status === 'authenticated' ? (
                    <button onClick={() => { import('next-auth/react').then(m => m.signOut({ callbackUrl: '/login' })) }}
                      className="text-[10px] font-bold text-gray-300 hover:text-red-400 transition-colors">
                      Salir
                    </button>
                  ) : (
                    <a href="/login" className="text-[10px] font-bold text-[#D94F2B]">Ingresar</a>
                  )}
                </div>
              </div>

              {/* Buscador combo: selector tipo + input en una sola barra */}
              <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-2xl overflow-hidden h-10">
                <button
                  onClick={() => setSearchTab(prev => prev === 'comercios' ? 'productos' : 'comercios')}
                  className="flex items-center gap-1 px-3 h-full text-[11px] font-black text-gray-700 dark:text-slate-200 whitespace-nowrap border-r border-gray-200 dark:border-slate-600 shrink-0"
                >
                  {searchTab === 'comercios' ? 'Comercios' : 'Productos'}
                  <ChevronDown size={11} className="opacity-50" />
                </button>
                <div className="relative flex-1 h-full">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    ref={searchTab === 'comercios' ? mobileSearchRef : productSearchRef}
                    type="text"
                    placeholder={searchTab === 'comercios' ? 'Buscar comercio...' : 'Ej: carteras, zapatillas...'}
                    value={searchTab === 'comercios' ? searchText : productQuery}
                    onChange={e => {
                      if (searchTab === 'comercios') {
                        setSearchText(e.target.value)
                        if (searchTimer.current) clearTimeout(searchTimer.current)
                        searchTimer.current = setTimeout(() => {
                          setActiveFilters(prev => ({ ...prev, commerces: e.target.value ? [e.target.value] : [] }))
                        }, 400)
                      } else {
                        setProductQuery(e.target.value)
                      }
                    }}
                    className="w-full h-full pl-8 pr-8 bg-transparent dark:text-white text-xs font-medium outline-none"
                  />
                  {(searchTab === 'comercios' ? searchText : productQuery) && (
                    <button
                      onClick={() => {
                        if (searchTab === 'comercios') { setSearchText(''); setActiveFilters(prev => ({ ...prev, commerces: [] })) }
                        else setProductQuery('')
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Chips de categorías favoritas (solo si hay favoritas) */}
              {favCategories.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {favCategories.map(slug => {
                    const cat = categorias.find(c => c.slug === slug)
                    if (!cat) return null
                    const isActive = selectedCats.includes(slug)
                    return (
                      <button key={slug}
                        onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== slug) : [...prev, slug])}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all shrink-0 border ${
                          isActive ? 'bg-[#D94F2B] border-[#D94F2B] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
                        }`}>
                        <span>★</span><span>{cat.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Todas / Para Mí / Hoy / Semana — naranja activo uniforme */}
              <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setForMe(false)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${
                    !forMe ? 'bg-[#D94F2B] border-[#D94F2B] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
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
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${
                    forMe ? 'bg-[#D94F2B] border-[#D94F2B] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
                  }`}
                >Para Mí</button>

                <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 shrink-0" />

                {(['today', 'week'] as const).map(f => (
                  <button key={f} onClick={() => setTimeFilter(f)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                      timeFilter === f ? 'bg-[#D94F2B] border-[#D94F2B] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400'
                    }`}>
                    {f === 'today' ? 'Hoy' : 'Semana'}
                  </button>
                ))}
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
        <div className="mb-4 bg-[#1E3A5F] dark:bg-slate-800 rounded-2xl p-4 text-white">
          {/* Mobile: título + stats en una línea, días en fila scrolleable abajo */}
          <div className="lg:hidden mb-2">
            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest leading-none mb-1">
              {forMe ? 'Para tu perfil' : 'Disponibles hoy'}
            </p>
            <p className="text-sm font-black leading-none">
              {todayDashboard.totalPromos} promos
              {todayDashboard.maxDiscount > 0 && <span className="text-[#D94F2B] ml-1.5">· hasta {todayDashboard.maxDiscount}%</span>}
            </p>
          </div>
          <div className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
            {todayDashboard.dayCounts.map(({ label, count, isToday, dayIdx }) => {
              const isActive = activeFilters.days.includes(dayIdx)
              return (
                <button key={label + dayIdx}
                  onClick={() => setActiveFilters(prev => ({ ...prev, days: isActive ? prev.days.filter(d => d !== dayIdx) : [...prev.days, dayIdx] }))}
                  className={`w-8 h-8 rounded-full flex flex-col items-center justify-center transition-all shrink-0 ${
                    isActive ? 'bg-white text-[#1E3A5F]' : isToday ? 'bg-[#D94F2B] text-white' : 'bg-white/10 text-white/60'
                  }`}>
                  <span className="text-[9px] font-black leading-none">{label}</span>
                  <span className="text-[8px] leading-none opacity-70">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Desktop: héroe + días en la misma fila */}
          <div className="hidden lg:flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest leading-none mb-0.5">
                {forMe ? 'Para tu perfil' : 'Disponibles hoy'}
              </p>
              <p className="text-2xl font-black leading-none">
                {todayDashboard.totalPromos} promos
                {todayDashboard.maxDiscount > 0 && <span className="text-[#D94F2B] text-lg ml-2">hasta {todayDashboard.maxDiscount}%</span>}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              {todayDashboard.dayCounts.map(({ label, count, isToday, dayIdx }) => {
                const isActive = activeFilters.days.includes(dayIdx)
                return (
                  <button key={label + dayIdx}
                    onClick={() => setActiveFilters(prev => ({ ...prev, days: isActive ? prev.days.filter(d => d !== dayIdx) : [...prev.days, dayIdx] }))}
                    className={`w-7 h-7 rounded-full flex flex-col items-center justify-center transition-all ${
                      isActive ? 'bg-white text-[#1E3A5F]' : isToday ? 'bg-[#D94F2B] text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}>
                    <span className="text-[9px] font-black leading-none">{label}</span>
                    <span className="text-[8px] leading-none opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fila 2: top categorías */}
          {todayDashboard.catList.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
              {todayDashboard.catList.map(cat => {
                const isActive = selectedCats.includes(cat.slug)
                return (
                  <button key={cat.slug}
                    onClick={() => setSelectedCats(prev => isActive ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shrink-0 ${
                      isActive ? 'bg-white text-[#1E3A5F]' : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}>
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span className={`text-[10px] font-black ${isActive ? 'text-[#D94F2B]' : 'text-white/50'}`}>{cat.bestDiscount}%</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Fila 3: top comercios */}
          {todayDashboard.commList.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
              {todayDashboard.commList.map(c => {
                const isFiltered = activeFilters.commerces[0]?.toLowerCase() === c.name.toLowerCase()
                return (
                  <button key={c.name}
                    onClick={() => {
                      if (isFiltered) { setActiveFilters(prev => ({ ...prev, commerces: [] })); setSearchText('') }
                      else { setSearchMode('exact'); setActiveFilters(prev => ({ ...prev, commerces: [c.name] })); setSearchText(c.name); track({ type: 'COMMERCE_CLICK', commerceName: c.name, source: 'dashboard' }) }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shrink-0 ${
                      isFiltered ? 'bg-white text-[#1E3A5F]' : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}>
                    {c.logoUrl
                      ? <img src={c.logoUrl} alt="" className="h-4 w-4 object-contain rounded bg-white/90 p-0.5 shrink-0" />
                      : <span className="text-[9px] font-black">{c.name.slice(0,2).toUpperCase()}</span>
                    }
                    <span>{c.name}</span>
                    <span className={`text-[10px] font-black ${isFiltered ? 'text-[#D94F2B]' : 'text-white/50'}`}>{c.bestDiscount}%</span>
                  </button>
                )
              })}
            </div>
          )}
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
        {!loading && !isProductSearchMode && promosFiltradas.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-300">
              <Search size={32} />
            </div>
            <p className="text-gray-900 font-medium">No encontramos promos{selectedCats.length > 0 ? ` en estas categorías` : ''}</p>
            <p className="text-sm text-gray-500 mt-2 max-w-[250px] mx-auto">Probá otra categoría o ajustá los filtros.</p>
          </div>
        )}

        {/* ── BÚSQUEDA DE PRODUCTOS: resultados agrupados por comercio (mismo esquema que el feed, in-page) ── */}
        {isProductSearchMode && (() => {
          const handleProductPromoClick = (promo: Promo) => {
            track({ type: 'PROMO_VIEW', promoId: promo.id, promoTitle: promo.title, commerceName: promo.commerce.name, categorySlug: promo.category.slug ?? '', discount: bestPercentageReq(promo)?.discountValue })
            openPromoDetail(promo)
          }

          // Las promos vienen anidadas bajo el comercio (sin `commerce` propio) — se les agrega acá
          const withCommerce = (c: ProductCommerceResult, p: Promo): Promo => ({ ...p, commerce: { id: c.id, name: c.name, logoUrl: c.logoUrl } })

          if (productSearchLoading) {
            return (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )
          }

          const withPromos = productResults.filter(c => c.promos.length > 0)

          if (productSearched && withPromos.length === 0) {
            return (
              <div className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-800 mb-4 text-gray-300">
                  <ShoppingBag size={32} />
                </div>
                <p className="text-gray-900 dark:text-white font-medium">No encontramos comercios para "{productQuery}"</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 max-w-[250px] mx-auto">Probá con otra palabra, por ejemplo una categoría o tipo de producto.</p>
              </div>
            )
          }

          // Categorías de PromoAR (las 19 fijas) entre las promos encontradas — desambiguación cuando el
          // producto buscado pertenece a más de una (ej. "tacos" → Gastronomía + Indumentaria)
          const allCategories = Array.from(new Set(withPromos.flatMap(c => c.promos.map(p => p.category.name)))).sort((a, b) => a.localeCompare(b, 'es'))
          const visible = productCategoryFilter
            ? withPromos
                .map(c => ({ ...c, promos: c.promos.filter(p => p.category.name === productCategoryFilter) }))
                .filter(c => c.promos.length > 0)
            : withPromos

          const ProductSection = ({ c }: { c: ProductCommerceResult }) => {
            const scrollRef = React.useRef<HTMLDivElement>(null)
            return (
              <div className="mb-5">
                <div className="flex items-center gap-2.5 px-4 mb-3">
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoUrl} alt={c.name} className="w-9 h-9 rounded-xl object-contain bg-white border border-gray-100 dark:border-slate-700 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-[#F0F2F5] dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <ShoppingBag size={16} className="text-gray-300 dark:text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{c.promos.length} {c.promos.length === 1 ? 'promo' : 'promos'} para vos</p>
                  </div>
                </div>
                <div className="relative">
                  <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto px-4 py-2" style={{ scrollbarWidth: 'none' }}>
                    {c.promos.map(p => {
                      const promo = withCommerce(c, p)
                      return <PromoCard key={p.id} promo={promo} nearbyCount={nearbyBranches[c.id]?.count} onClick={() => handleProductPromoClick(promo)} onToggleSave={toggleSave} />
                    })}
                  </div>
                  {c.promos.length > 2 && (
                    <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#f8fafc] dark:from-[#020617] to-transparent pointer-events-none" />
                  )}
                </div>
                <div className="h-px bg-[#F0F2F5] dark:bg-slate-700 mt-2 mx-4" />
              </div>
            )
          }

          const hasPercentagePromo = visible.some(c =>
            c.promos.some(p => p.requirements?.some((r: any) =>
              r.discountType === 'PERCENTAGE_REINTEGRO' || r.discountType === 'PERCENTAGE_DESCUENTO'
            ))
          )

          return (
            <div className="space-y-0 -mx-4">
              <p className="px-4 mb-3 text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                Estos resultados se basan en un catálogo que puede no reflejar el stock actual — algunas categorías o productos podrían no estar disponibles hoy.
              </p>
              {hasPercentagePromo && (
                <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex gap-2 items-start">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                    Las promos con % de supermercados suelen tener excepciones por rubro (electrónica, indumentaria, etc.). Verificá los legales en cada promo antes de ir.
                  </p>
                </div>
              )}

              {allCategories.length > 1 && (
                <div className="flex flex-wrap gap-1.5 px-4 mb-4">
                  <button
                    onClick={() => setProductCategoryFilter(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                      productCategoryFilter === null
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    Todas
                  </button>
                  {allCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setProductCategoryFilter(cat === productCategoryFilter ? null : cat)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                        productCategoryFilter === cat
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              {visible.map(c => <ProductSection key={c.id} c={c} />)}
            </div>
          )
        })()}

        {/* ── LAYOUT NETFLIX: secciones por categoría ── */}
        {!loading && !isProductSearchMode && promosFiltradas.length > 0 && (() => {
          // Agrupar por categoría
          const rawCatOrder: string[] = []
          const byCat = new Map<string, { catName: string; catIcon: string; catColor: string; promos: typeof promosFiltradas }>()
          for (const p of promosFiltradas) {
            const key = p.category.slug ?? p.category.name
            if (!byCat.has(key)) {
              rawCatOrder.push(key)
              byCat.set(key, { catName: p.category.name, catIcon: p.category.icon ?? '🏷️', catColor: p.category.color, promos: [] })
            }
            byCat.get(key)!.promos.push(p)
          }

          // Orden lógico: categorías prioritarias primero (en este orden fijo),
          // luego el resto por cantidad de promos y % de descuento máximo
          const priorityCats = PRIORITY_CAT_SLUGS.filter(slug => byCat.has(slug))
          const remainingCats = rawCatOrder
            .filter(key => !PRIORITY_CAT_SLUGS.includes(key))
            .sort((a, b) => {
              const secA = byCat.get(a)!
              const secB = byCat.get(b)!
              if (secB.promos.length !== secA.promos.length) return secB.promos.length - secA.promos.length
              const maxDiscA = Math.max(0, ...secA.promos.map(p => bestPercentageReq(p)?.discountValue ?? 0))
              const maxDiscB = Math.max(0, ...secB.promos.map(p => bestPercentageReq(p)?.discountValue ?? 0))
              return maxDiscB - maxDiscA
            })
          const catOrder = [...priorityCats, ...remainingCats]

          // Destacadas: primero las marcadas como featured, luego top por descuento,
          // siempre dentro de las categorías prioritarias
          const isPriorityCat = (p: typeof promosFiltradas[0]) => PRIORITY_CAT_SLUGS.includes(p.category.slug ?? '')
          const featuredPromos = promosFiltradas.filter(p => (p as any).isFeatured && isPriorityCat(p))
          const topByDiscount = [...promosFiltradas]
            .filter(p => !(p as any).isFeatured && isPriorityCat(p) && (bestPercentageReq(p)?.discountValue ?? 0) <= 100 && bestPercentageReq(p)?.discountValue)
            .sort((a, b) => (bestPercentageReq(b)?.discountValue ?? 0) - (bestPercentageReq(a)?.discountValue ?? 0))
            .slice(0, Math.max(0, 6 - featuredPromos.length))
          const destacadas = [...featuredPromos, ...topByDiscount]

          // Cerca tuyo: promos de comercios con sucursales cercanas (requiere geolocalización)
          const cercaTuyo = [...promosFiltradas]
            .filter(p => nearbyBranches[p.commerce.id ?? ''])
            .sort((a, b) => nearbyBranches[a.commerce.id ?? ''].minDistKm - nearbyBranches[b.commerce.id ?? ''].minDistKm)
            .slice(0, 12)

          const handlePromoClick = (promo: typeof promosFiltradas[0]) => {
            track({ type: 'PROMO_VIEW', promoId: promo.id, promoTitle: promo.title, commerceName: promo.commerce.name, categorySlug: promo.category.slug ?? '', discount: bestPercentageReq(promo)?.discountValue })
            openPromoDetail(promo)
          }

          const PREVIEW = 8

          const Section = ({ title, subtitle, catKey, promoList }: { title: string; subtitle: string; catKey?: string; promoList: typeof promosFiltradas }) => {
            const isExpanded = !catKey || focusedCat === catKey

            // Agrupar por comercio, preservando el orden de aparición (ya viene ordenado por descuento/popularidad)
            const groups: { commerce: typeof promoList[0]['commerce']; promos: typeof promoList }[] = []
            const groupMap = new Map<string, typeof groups[0]>()
            for (const p of promoList) {
              const key = p.commerce.id ?? p.commerce.name
              let group = groupMap.get(key)
              if (!group) {
                group = { commerce: p.commerce, promos: [] }
                groupMap.set(key, group)
                groups.push(group)
              }
              group.promos.push(p)
            }

            const shown = isExpanded ? groups : groups.slice(0, PREVIEW)
            const scrollRef = React.useRef<HTMLDivElement>(null)
            const scroll = (dir: 'left' | 'right') => {
              scrollRef.current?.scrollBy({ left: dir === 'right' ? 180 : -180, behavior: 'smooth' })
            }
            return (
              <div className="mb-5">
                <div className="flex items-center justify-between px-4 mb-3">
                  <div>
                    <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white">{title}</p>
                    <p className="text-[11px] text-[#8B96A5] dark:text-slate-400 mt-0.5">{subtitle}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => scroll('left')}
                      className="w-7 h-7 rounded-full bg-[#F0F2F5] dark:bg-slate-700 hover:bg-[#E4E8EF] flex items-center justify-center text-[#1E3A5F] dark:text-white transition-colors text-sm font-bold">
                      ‹
                    </button>
                    <button onClick={() => scroll('right')}
                      className="w-7 h-7 rounded-full bg-[#F0F2F5] dark:bg-slate-700 hover:bg-[#E4E8EF] flex items-center justify-center text-[#1E3A5F] dark:text-white transition-colors text-sm font-bold">
                      ›
                    </button>
                    {catKey && groups.length > PREVIEW && (
                      <button onClick={() => setFocusedCat(catKey)}
                        className="text-[11px] font-semibold text-[#D94F2B] ml-1 whitespace-nowrap">
                        Ver todas →
                      </button>
                    )}
                  </div>
                </div>
                <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
                  {shown.map(g => (
                    <CommerceGroupCard
                      key={g.commerce.id ?? g.commerce.name}
                      commerce={g.commerce}
                      promos={g.promos}
                      nearbyCount={g.commerce.id ? nearbyBranches[g.commerce.id]?.count : null}
                      onPromoClick={handlePromoClick}
                      onToggleSave={toggleSave}
                    />
                  ))}
                </div>
                <div className="h-px bg-[#F0F2F5] dark:bg-slate-700 mt-4 mx-4" />
              </div>
            )
          }

          return (
            <div className="space-y-0 -mx-4">
              {destacadas.length > 0 && (
                <Section title="⭐ Destacadas hoy" subtitle="Mejores descuentos del día" promoList={destacadas} />
              )}
              {cercaTuyo.length > 0 && (
                <Section title="📍 Cerca tuyo" subtitle="Comercios con sucursales cerca de tu ubicación" promoList={cercaTuyo} />
              )}
              {catOrder.map(key => {
                const sec = byCat.get(key)!
                return (
                  <Section key={key} catKey={key} title={`${sec.catIcon} ${sec.catName}`} subtitle={`${sec.promos.length} promos`} promoList={sec.promos} />
                )
              })}
            </div>
          )
        })()}

      </div>

      {/* ── Botón Ver más promos (paginación) ── */}
      {hasMore && !loading && (
        <div className="px-4 pb-6 pt-2">
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loadingMore}
            className="w-full py-4 text-base font-bold text-[#1E3A5F] dark:text-blue-300 border-2 border-[#1E3A5F] dark:border-blue-600 rounded-2xl hover:bg-[#EEF2F8] dark:hover:bg-[#1E3A5F]/20 transition-all disabled:opacity-50"
          >
            {loadingMore ? 'Cargando...' : 'Ver más promos →'}
          </button>
        </div>
      )}

      {/* ══════════ FOOTER ══════════ */}
    <footer className="bg-slate-900 text-slate-400 pb-24">
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
    </main>
    </div>{/* fin flex row sidebar+content */}

      {/* ── Overlay "Ver todas" de una categoría ── */}
      {focusedCat && (() => {
        const catInfo = categorias.find(c => c.slug === focusedCat)
        const sec = catInfo
          ? { catName: catInfo.name, catIcon: catInfo.icon ?? '🏷️' }
          : (() => {
              for (const p of promosFiltradas) {
                const key = p.category.slug ?? p.category.name
                if (key === focusedCat) return { catName: p.category.name, catIcon: p.category.icon ?? '🏷️' }
              }
              return null
            })()
        const catPromos = focusedCatPromos.length > 0 ? focusedCatPromos : promosFiltradas.filter(p => (p.category.slug ?? p.category.name) === focusedCat)
        if (!sec) return null
        return (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-black/50" onClick={() => setFocusedCat(null)} />
            <div className="relative bg-white dark:bg-slate-900 flex flex-col h-full max-w-lg mx-auto w-full shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
                <button onClick={() => setFocusedCat(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-white font-bold text-sm">
                  ←
                </button>
                <div>
                  <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white">{sec.catIcon} {sec.catName}</p>
                  <p className="text-[11px] text-[#8B96A5]">{focusedCatLoading ? 'Cargando...' : `${catPromos.length} promos`}</p>
                </div>
              </div>
              {/* Grid vertical */}
              <div className="overflow-y-auto flex-1 p-4">
                {focusedCatLoading ? (
                  <div className="flex justify-center py-12 text-gray-400 text-sm">Cargando promos...</div>
                ) : (
                <div className="grid grid-cols-2 gap-3">
                  {catPromos.map(p => {
                    const pctReq = bestPercentageReq(p)
                    const label = discountLabel(p)
                    const banks = Array.from(new Map(p.requirements.filter(r => r.bank?.name).map(r => [r.bank!.name, r.bank!])).values())
                    const wallets = Array.from(new Map(p.requirements.filter(r => r.wallet?.name).map(r => [r.wallet!.name, r.wallet!])).values())
                    const entities = [...banks, ...wallets].slice(0, 2)
                    const nb = p.commerce.id ? nearbyBranches[p.commerce.id] : null
                    return (
                      <div key={p.id} onClick={() => { openPromoDetail(p); setFocusedCat(null) }}
                        className="bg-white dark:bg-slate-800 border border-[#EAECF0] dark:border-slate-700 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                        <div className="relative bg-[#F8F9FB] dark:bg-slate-900 border-b border-[#F0F2F5] dark:border-slate-700 flex items-center justify-center" style={{ height: 72 }}>
                          {p.commerce.logoUrl
                            ? <img src={p.commerce.logoUrl} alt={p.commerce.name} className="max-h-10 max-w-[80%] object-contain p-1" />
                            : <span className="text-2xl">{p.category.icon ?? '🏷️'}</span>
                          }
                          {label && (
                            <div className="absolute top-1.5 right-1.5 bg-[#D94F2B] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                              {pctReq ? `${pctReq.discountValue}%` : label.replace('Hasta ', '')}
                            </div>
                          )}
                        </div>
                        <div className="px-2.5 py-2 space-y-1">
                          <p className="text-[11px] font-bold text-[#1E3A5F] dark:text-white truncate">{p.commerce.name}</p>
                          {entities.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {entities.map((e, i) => (
                                <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#EEF2F8] dark:bg-slate-700 text-[#3A5A7A] dark:text-slate-300">
                                  {e.name.split(' ').slice(-1)[0]}
                                </span>
                              ))}
                            </div>
                          )}
                          {nb && <p className="text-[9px] text-emerald-600 font-semibold">📍 {nb.count} sucursales</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {detailPromo && (
        <PromoDetailSheet
          promo={detailPromo}
          nearbyBranch={detailPromo.commerce.id ? nearbyBranches[detailPromo.commerce.id] : undefined}
          onClose={closePromoDetail}
        />
      )}

      {entitiesPromo && (
        <EntitiesSheet
          commerceName={entitiesPromo.commerce.name}
          requirements={entitiesPromo.requirements}
          onCloseAction={() => setEntitiesPromo(null)}
        />
      )}

      <BottomNav
        onFilter={() => setIsFilterOpen(true)}
        onSearch={() => {
          setTimeout(() => (searchTab === 'productos' ? productSearchRef : mobileSearchRef).current?.focus(), 100)
        }}
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
    </>
  )
}