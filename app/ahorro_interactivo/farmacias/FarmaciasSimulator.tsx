'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export type PharmacyBrand =
  | 'Farmacity'
  | 'Farmaplus'
  | 'Openfarma'
  | 'Selma'
  | 'Farmaonline'
  | 'Farmacias de Barrio'

export interface PharmacyRequirement {
  bankName: string | null
  bankSlug: string | null
  walletName: string | null
  walletSlug: string | null
  cardNetworkName: string | null
  cardNetworkSlug: string | null
}

export interface PharmacyPromoItem {
  id: string
  brand: PharmacyBrand
  title: string
  description: string | null
  discountPct: number
  capAmount: number | null
  validDays: string[]
  validDaysBitmask: number
  requirements: PharmacyRequirement[]
  isFeatured: boolean
  logoUrl: string | null
}

export interface CatalogEntity {
  id: string
  slug: string
  name: string
  logoUrl?: string | null
  type: 'bank' | 'wallet' | 'card' | 'benefit'
  color?: string
  popular?: boolean
}

export interface FourLevelsCatalog {
  banks: CatalogEntity[]
  wallets: CatalogEntity[]
  cards: CatalogEntity[]
  benefits: CatalogEntity[]
}

export interface PharmacyResultItem {
  brand: PharmacyBrand
  config: {
    name: string
    color: string
    glowClass: string
    borderClass: string
    bgGradient: string
    badgeBg: string
    tagline: string
  }
  matchedPromo: PharmacyPromoItem | null
  alternateDayPromo: PharmacyPromoItem | null
  savings: number
  hasMatch: boolean
  hasAlternateDayMatch: boolean
  topGeneralPromo: PharmacyPromoItem | null
  totalPromosCount: number
  marketBestPromo: PharmacyPromoItem | null
  opportunityZero: {
    promo: PharmacyPromoItem
    savings: number
    entityLabel: string
  } | null
  opportunityMore: {
    promo: PharmacyPromoItem
    savings: number
    diff: number
    entityLabel: string
  } | null
}

interface Props {
  initialPromos: PharmacyPromoItem[]
  fullCatalog: FourLevelsCatalog
  userProfileCatalog: FourLevelsCatalog | null
  initialUserMethods?: string[]
  userInfo?: {
    name: string | null
    email: string | null
  } | null
}

const DAYS_OF_WEEK = [
  { id: 'all', label: 'Toda la semana', shortLabel: 'Toda la semana' },
  { id: 'today', label: 'Hoy', shortLabel: 'Hoy' },
  { id: '2', label: 'Lunes', shortLabel: 'Lun', bit: 2 },
  { id: '4', label: 'Martes', shortLabel: 'Mar', bit: 4 },
  { id: '8', label: 'Miércoles', shortLabel: 'Mié', bit: 8 },
  { id: '16', label: 'Jueves', shortLabel: 'Jue', bit: 16 },
  { id: '32', label: 'Viernes', shortLabel: 'Vie', bit: 32 },
  { id: '64', label: 'Sábado', shortLabel: 'Sáb', bit: 64 },
  { id: '1', label: 'Domingo', shortLabel: 'Dom', bit: 1 },
]

function getTodayInfo(): { bit: number; name: string } {
  const dayIndex = new Date().getDay()
  const map = [
    { bit: 1, name: 'Domingo' },
    { bit: 2, name: 'Lunes' },
    { bit: 4, name: 'Martes' },
    { bit: 8, name: 'Miércoles' },
    { bit: 16, name: 'Jueves' },
    { bit: 32, name: 'Viernes' },
    { bit: 64, name: 'Sábado' },
  ]
  return map[dayIndex] || { bit: 16, name: 'Jueves' }
}

const SPEND_PRESETS = [15000, 30000, 50000, 80000, 120000]

const BRAND_CONFIG: Record<PharmacyBrand, {
  name: string
  color: string
  glowClass: string
  borderClass: string
  bgGradient: string
  badgeBg: string
  tagline: string
}> = {
  Farmacity: {
    name: 'Farmacity',
    color: '#00875A',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,135,90,0.35)]',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
    bgGradient: 'from-emerald-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-emerald-600 text-white',
    tagline: 'Tu farmacia y bienestar de confianza',
  },
  Farmaplus: {
    name: 'Farmaplus',
    color: '#0052CC',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,82,204,0.35)]',
    borderClass: 'border-blue-500/40 hover:border-blue-400',
    bgGradient: 'from-blue-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-blue-600 text-white',
    tagline: 'Cuidamos tu salud y tu bolsillo',
  },
  Openfarma: {
    name: 'OpenFarma',
    color: '#FF5630',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(255,86,48,0.35)]',
    borderClass: 'border-orange-500/40 hover:border-orange-400',
    bgGradient: 'from-orange-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-orange-600 text-white',
    tagline: 'Abiertos siempre para vos',
  },
  Selma: {
    name: 'Farmacia Selma',
    color: '#6554C0',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(101,84,192,0.35)]',
    borderClass: 'border-purple-500/40 hover:border-purple-400',
    bgGradient: 'from-purple-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-purple-600 text-white',
    tagline: 'Tradición y cuidado profesional',
  },
  Farmaonline: {
    name: 'Farmaonline',
    color: '#00B8D9',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,184,217,0.35)]',
    borderClass: 'border-cyan-500/40 hover:border-cyan-400',
    bgGradient: 'from-cyan-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-cyan-600 text-white',
    tagline: 'Farmacia online con envío a domicilio',
  },
  'Farmacias de Barrio': {
    name: 'Farmacias de Barrio',
    color: '#36B37E',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(54,179,126,0.35)]',
    borderClass: 'border-teal-500/40 hover:border-teal-400',
    bgGradient: 'from-teal-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-teal-600 text-white',
    tagline: 'Farmacias locales con MODO, Cuenta DNI y BNA',
  },
}

function matchesMethod(methodId: string, slug: string | null, name: string | null): boolean {
  if (!slug && !name) return false
  const s = (slug || '').toLowerCase().trim()
  const n = (name || '').toLowerCase().trim()
  const m = methodId.toLowerCase().trim()

  if (s === m || n === m) return true

  // Tarjetas de beneficios
  if (m === 'club-la-nacion' || m === 'club-la-nación') {
    return s.includes('club-la-nacion') || s.includes('la-nacion') || n.includes('club la nacion') || n.includes('club la nación')
  }
  if (m === 'clarin-365' || m === 'clarin-365-plus') {
    return s.includes('clarin-365') || s.includes('365') || n.includes('clarin') || n.includes('clarín') || n.includes('365')
  }
  if (m === 'comunidad-coto') {
    return s.includes('comunidad-coto') || s.includes('coto') || n.includes('comunidad coto')
  }

  // Bancos
  if (m === 'bna' || m === 'banco-nacion') {
    return (
      s === 'bna' ||
      s === 'banco-nacion' ||
      s.includes('banco-nacion') ||
      n.includes('banco naci') ||
      n.includes('banco de la naci')
    )
  }
  if (m === 'galicia' || m === 'banco-galicia') return s.includes('galicia') || n.includes('galicia')
  if (m === 'santander' || m === 'banco-santander') return s.includes('santander') || n.includes('santander')
  if (m === 'bbva' || m === 'banco-bbva') return s.includes('bbva') || n.includes('bbva')
  if (m === 'macro' || m === 'banco-macro') return s.includes('macro') || n.includes('macro')
  if (m === 'ciudad' || m === 'banco-ciudad') return s.includes('ciudad') || n.includes('ciudad')
  if (m === 'credicoop' || m === 'banco-credicoop') return s.includes('credicoop') || n.includes('credicoop')
  if (m === 'banco-provincia' || m === 'provincia') return s.includes('provincia') || n.includes('provincia')
  if (m === 'banco-cordoba' || m === 'cordoba' || m === 'bancor') return s.includes('cordoba') || n.includes('cordoba') || n.includes('bancor')
  if (m === 'patagonia' || m === 'banco-patagonia') return s.includes('patagonia') || n.includes('patagonia')
  if (m === 'supervielle' || m === 'banco-supervielle') return s.includes('supervielle') || n.includes('supervielle')
  if (m === 'icbc') return s.includes('icbc') || n.includes('icbc')

  // Billeteras
  if (m === 'cuenta-dni' || m === 'cuentadni') return s.includes('cuenta-dni') || s.includes('cuentadni') || n.includes('cuenta dni')
  if (m === 'modo') return s.includes('modo') || n.includes('modo')
  if (m === 'personal-pay' || m === 'personalpay') return s.includes('personal-pay') || s.includes('personalpay') || n.includes('personal pay')
  if (m === 'naranja-x' || m === 'naranjax') return s.includes('naranja') || n.includes('naranja')
  if (m === 'uala') return s.includes('uala') || n.includes('ualá') || n.includes('uala')
  if (m === 'mercadopago' || m === 'mercado-pago') return s.includes('mercadopago') || s.includes('mercado-pago') || n.includes('mercado pago')
  if (m === 'buepp') return s.includes('buepp') || n.includes('buepp')
  if (m === 'cencopay') return s.includes('cencopay') || n.includes('cencopay')

  // Redes
  if (m === 'visa') return s.includes('visa') || n.includes('visa')
  if (m === 'mastercard') return s.includes('mastercard') || n.includes('mastercard')
  if (m === 'amex' || m === 'american-express' || m === 'american-express-banco') {
    return s.includes('amex') || s.includes('american-express') || n.includes('american express') || n.includes('amex')
  }
  if (m === 'cabal') return s.includes('cabal') || n.includes('cabal')
  if (m === 'maestro') return s.includes('maestro') || n.includes('maestro')

  return s.includes(m) || m.includes(s) || n.includes(m)
}

function promoMatchesRequirements(promo: PharmacyPromoItem, userMethods: string[]): boolean {
  if (userMethods.length === 0) return false
  if (promo.requirements.length === 0) return true

  const userNetworks = userMethods.filter(m => ['visa', 'mastercard', 'amex', 'american-express', 'cabal', 'maestro'].includes(m))
  const hasUserFilteredNetworks = userNetworks.length > 0

  return promo.requirements.some(r => {
    const hasBankReq = !!r.bankSlug || !!r.bankName
    const hasWalletReq = !!r.walletSlug || !!r.walletName
    const hasNetworkReq = !!r.cardNetworkSlug || !!r.cardNetworkName

    const userHasBank = hasBankReq && userMethods.some(m => matchesMethod(m, r.bankSlug, r.bankName))
    const userHasWallet = hasWalletReq && userMethods.some(m => matchesMethod(m, r.walletSlug, r.walletName))

    let userHasNetwork = true
    if (hasNetworkReq) {
      if (hasUserFilteredNetworks) {
        userHasNetwork = userNetworks.some(m => matchesMethod(m, r.cardNetworkSlug, r.cardNetworkName))
      } else {
        userHasNetwork = true
      }
    }

    if (hasBankReq && hasWalletReq) {
      return userHasBank && userHasWallet && userHasNetwork
    }
    if (hasBankReq) {
      return userHasBank && userHasNetwork
    }
    if (hasWalletReq) {
      return userHasWallet && userHasNetwork
    }
    if (hasNetworkReq) {
      return userMethods.some(m => matchesMethod(m, r.cardNetworkSlug, r.cardNetworkName))
    }

    return true
  })
}

function getPromoEntityLabel(promo: PharmacyPromoItem): string {
  const parts: string[] = []
  for (const r of promo.requirements) {
    const list: string[] = []
    if (r.bankName) list.push(r.bankName)
    if (r.walletName) list.push(r.walletName)
    if (r.cardNetworkName && !r.bankName && !r.walletName) list.push(r.cardNetworkName)
    const combined = list.join(' / ')
    if (combined && !parts.includes(combined)) {
      parts.push(combined)
    }
  }
  if (parts.length > 0) {
    if (parts.length <= 2) return parts.join(' o ')
    return `${parts[0]} u otras`
  }
  return 'otra entidad'
}

export default function FarmaciasSimulator({
  initialPromos,
  fullCatalog,
  userProfileCatalog,
  initialUserMethods = [],
  userInfo = null,
}: Props) {
  const router = useRouter()
  const { data: clientSession } = useSession()

  const hasRegisteredProfile = !!(userProfileCatalog && initialUserMethods.length > 0)

  const [selectionMode, setSelectionMode] = useState<'profile' | 'all'>(() => {
    return hasRegisteredProfile ? 'profile' : 'all'
  })

  const [selectedMethods, setSelectedMethods] = useState<string[]>(() => {
    if (initialUserMethods.length > 0) {
      return initialUserMethods
    }
    return ['banco-nacion', 'modo', 'cuenta-dni', 'galicia', 'visa', 'clarin-365', 'club-la-nacion']
  })

  const [bankSearchQuery, setBankSearchQuery] = useState('')
  const [showAllBanks, setShowAllBanks] = useState(false)

  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [monthlySpend, setMonthlySpend] = useState<number>(30000)
  const [copiedShare, setCopiedShare] = useState(false)

  const todayInfo = useMemo(() => getTodayInfo(), [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const cardsParam = urlParams.get('cards')
    const spendParam = urlParams.get('gasto')
    const dayParam = urlParams.get('dia')

    if (cardsParam) {
      const cards = cardsParam.split(',').filter(Boolean)
      if (cards.length > 0) {
        setSelectedMethods(cards)
        setSelectionMode('all')
      }
    } else if (initialUserMethods.length > 0) {
      setSelectedMethods(initialUserMethods)
      setSelectionMode('profile')
    }

    if (spendParam && !isNaN(Number(spendParam))) {
      setMonthlySpend(Number(spendParam))
    }
    if (dayParam && DAYS_OF_WEEK.some(d => d.id === dayParam)) {
      setSelectedDay(dayParam)
    }
  }, [initialUserMethods])

  const toggleMethod = (id: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter(m => m !== id)
      }
      return [...prev, id]
    })
  }

  const selectAllInLevel = (items: CatalogEntity[]) => {
    const ids = items.map(i => i.id)
    setSelectedMethods(prev => Array.from(new Set([...prev, ...ids])))
  }

  const deselectAllInLevel = (items: CatalogEntity[]) => {
    const ids = new Set(items.map(i => i.id))
    setSelectedMethods(prev => {
      const filtered = prev.filter(m => !ids.has(m))
      return filtered.length === 0 ? prev : filtered
    })
  }

  const selectAll = () => {
    const allIds = [
      ...fullCatalog.banks.map(b => b.id),
      ...fullCatalog.wallets.map(w => w.id),
      ...fullCatalog.cards.map(c => c.id),
      ...fullCatalog.benefits.map(b => b.id),
    ]
    setSelectedMethods(Array.from(new Set(allIds)))
  }

  const selectOnlyProfile = () => {
    if (initialUserMethods.length > 0) {
      setSelectedMethods(initialUserMethods)
      setSelectionMode('profile')
    }
  }

  const clearAll = () => {
    setSelectedMethods([])
  }

  const resetRecommended = () => {
    setSelectedMethods(['banco-nacion', 'modo', 'cuenta-dni', 'galicia', 'visa', 'clarin-365', 'club-la-nacion'])
  }

  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) {
      return showAllBanks ? fullCatalog.banks : fullCatalog.banks.slice(0, 12)
    }
    const q = bankSearchQuery.toLowerCase().trim()
    return fullCatalog.banks.filter(b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q))
  }, [fullCatalog.banks, bankSearchQuery, showAllBanks])

  const userProfileItemCount = useMemo(() => {
    if (!userProfileCatalog) return 0
    return (
      userProfileCatalog.banks.length +
      userProfileCatalog.wallets.length +
      userProfileCatalog.cards.length +
      userProfileCatalog.benefits.length
    )
  }, [userProfileCatalog])

  const resultsByBrand = useMemo<PharmacyResultItem[]>(() => {
    const brands: PharmacyBrand[] = [
      'Farmacity',
      'Farmaplus',
      'Openfarma',
      'Selma',
      'Farmaonline',
      'Farmacias de Barrio',
    ]

    return brands.map(brand => {
      const brandPromos = initialPromos.filter(p => p.brand === brand)

      const matchedPromos = brandPromos.filter(p => promoMatchesRequirements(p, selectedMethods))

      const dayFilteredPromos = matchedPromos.filter(p => {
        if (selectedDay === 'all') return true
        if (selectedDay === 'today') {
          return (p.validDaysBitmask & todayInfo.bit) !== 0 || p.validDaysBitmask >= 127
        }
        const bit = parseInt(selectedDay, 10)
        return (p.validDaysBitmask & bit) !== 0 || p.validDaysBitmask >= 127
      })

      let bestPromo: PharmacyPromoItem | null = null
      let maxSavings = 0

      for (const promo of dayFilteredPromos) {
        const potentialSavings = (monthlySpend * (promo.discountPct || 10)) / 100
        const actualSavings = promo.capAmount ? Math.min(potentialSavings, promo.capAmount) : potentialSavings

        if (actualSavings > maxSavings) {
          maxSavings = actualSavings
          bestPromo = promo
        }
      }

      let alternateDayPromo: PharmacyPromoItem | null = null
      if (!bestPromo && matchedPromos.length > 0 && selectedDay !== 'all') {
        let altMax = 0
        for (const promo of matchedPromos) {
          const potentialSavings = (monthlySpend * (promo.discountPct || 10)) / 100
          const actualSavings = promo.capAmount ? Math.min(potentialSavings, promo.capAmount) : potentialSavings
          if (actualSavings > altMax) {
            altMax = actualSavings
            alternateDayPromo = promo
          }
        }
      }

      const dayAllPromos = brandPromos.filter(p => {
        if (selectedDay === 'all') return true
        if (selectedDay === 'today') {
          return (p.validDaysBitmask & todayInfo.bit) !== 0 || p.validDaysBitmask >= 127
        }
        const bit = parseInt(selectedDay, 10)
        return (p.validDaysBitmask & bit) !== 0 || p.validDaysBitmask >= 127
      })

      let marketBestPromo: PharmacyPromoItem | null = null
      let marketMaxSavings = 0

      for (const promo of dayAllPromos) {
        const potentialSavings = (monthlySpend * (promo.discountPct || 10)) / 100
        const actualSavings = promo.capAmount ? Math.min(potentialSavings, promo.capAmount) : potentialSavings
        if (actualSavings > marketMaxSavings) {
          marketMaxSavings = actualSavings
          marketBestPromo = promo
        }
      }

      let opportunityZero: PharmacyResultItem['opportunityZero'] = null
      if (maxSavings === 0 && marketBestPromo && marketMaxSavings > 0) {
        opportunityZero = {
          promo: marketBestPromo,
          savings: marketMaxSavings,
          entityLabel: getPromoEntityLabel(marketBestPromo),
        }
      }

      let opportunityMore: PharmacyResultItem['opportunityMore'] = null
      if (maxSavings > 0 && marketBestPromo && marketMaxSavings > maxSavings + 1000) {
        opportunityMore = {
          promo: marketBestPromo,
          savings: marketMaxSavings,
          diff: marketMaxSavings - maxSavings,
          entityLabel: getPromoEntityLabel(marketBestPromo),
        }
      }

      const topGeneralPromo = brandPromos.length > 0 ? brandPromos[0] : null

      return {
        brand,
        config: BRAND_CONFIG[brand],
        matchedPromo: bestPromo,
        alternateDayPromo,
        savings: maxSavings,
        hasMatch: bestPromo !== null,
        hasAlternateDayMatch: alternateDayPromo !== null,
        topGeneralPromo,
        totalPromosCount: brandPromos.length,
        marketBestPromo,
        opportunityZero,
        opportunityMore,
      }
    }).sort((a, b) => {
      if (b.savings !== a.savings) return b.savings - a.savings
      if (a.hasMatch && !b.hasMatch) return -1
      if (!a.hasMatch && b.hasMatch) return 1
      if (a.hasAlternateDayMatch && !b.hasAlternateDayMatch) return -1
      if (!a.hasAlternateDayMatch && b.hasAlternateDayMatch) return 1
      return b.totalPromosCount - a.totalPromosCount
    })
  }, [initialPromos, selectedMethods, selectedDay, monthlySpend, todayInfo])

  const topWinner = resultsByBrand[0]
  const secondPlace = resultsByBrand[1]
  const thirdPlace = resultsByBrand[2]

  const shareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.origin + window.location.pathname)
    url.searchParams.set('cards', selectedMethods.join(','))
    url.searchParams.set('gasto', monthlySpend.toString())
    url.searchParams.set('dia', selectedDay)
    return url.toString()
  }

  const handleShare = async () => {
    const url = shareUrl()
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Simulador de Farmacias PromoAR: Dónde te conviene comprar`,
          text: `Con mis tarjetas puedo ahorrar hasta $${topWinner.savings.toLocaleString('es-AR')} en ${topWinner.brand} este mes. ¡Calculá tu compra en PromoAR!`,
          url,
        })
      } catch {
        // fallback
      }
    } else {
      navigator.clipboard.writeText(url)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1428] text-slate-100 selection:bg-[#D94F2B]/30 pb-20">
      {/* Barra de navegación superior con vuelta al inicio */}
      <header className="border-b border-slate-800/80 bg-[#0A1428]/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>←</span> Volver a promociones
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Simulador Interactivo
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Farmacias
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            SIMULADOR INTELIGENTE DE FARMACIAS
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
            ¿En qué farmacia te conviene <br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-rose-300 via-white to-[#E8724F] bg-clip-text text-transparent">
              comprar este mes?
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Seleccioná tus bancos, tarjetas y beneficios. Calculamos en tiempo real tu mayor ahorro en{' '}
            <span className="text-slate-200 font-semibold">Farmacity, Farmaplus, OpenFarma, Selma, Farmaonline y farmacias de barrio</span> con reintegros actualizados.
          </p>
        </div>

        {/* PASO 1: SELECTOR CON LAS 2 OPCIONES ARRIBA Y LOS 4 NIVELES ORGANIZADOS */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 md:p-7 mb-8 backdrop-blur-md shadow-2xl shadow-black/40">
          {/* Header de Paso 1 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-slate-800/80">
            <div>
              <h2 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span className="text-rose-400 text-xl">💳</span>
                <span>Paso 1:</span> Elegí tus medios de pago
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Calcularemos en vivo los reintegros aplicables a cada farmacia
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                {selectedMethods.length} activos
              </span>
              <button
                onClick={selectAll}
                className="text-xs font-bold text-[#E8724F] hover:text-white px-2.5 py-1 rounded-lg bg-[#142840] hover:bg-[#1E3A5F] border border-[#26406F] transition-colors"
              >
                Todos
              </button>
              <button
                onClick={clearAll}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={resetRecommended}
                className="text-xs font-medium text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
              >
                Recomendados
              </button>
            </div>
          </div>

          {/* LAS 2 OPCIONES ARRIBA DEL CUADRO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                setSelectionMode('profile')
                if (hasRegisteredProfile && initialUserMethods.length > 0) {
                  setSelectedMethods(initialUserMethods)
                }
              }}
              className={`p-4 rounded-2xl text-left transition-all border flex items-start gap-3.5 relative overflow-hidden ${
                selectionMode === 'profile'
                  ? 'bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/50 border-slate-800/90 hover:bg-slate-850 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                  selectionMode === 'profile'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                👤
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${selectionMode === 'profile' ? 'text-white' : 'text-slate-300'}`}>
                    1. Mis productos financieros
                  </span>
                  {hasRegisteredProfile && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {userProfileItemCount} registrados
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {hasRegisteredProfile
                    ? `Según tu perfil registrado en PromoAR (${userInfo?.name || userInfo?.email})`
                    : 'Usá tus tarjetas y bancos guardados en PromoAR'}
                </p>
              </div>
              {selectionMode === 'profile' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-3 right-3" />
              )}
            </button>

            <button
              onClick={() => setSelectionMode('all')}
              className={`p-4 rounded-2xl text-left transition-all border flex items-start gap-3.5 relative overflow-hidden ${
                selectionMode === 'all'
                  ? 'bg-gradient-to-br from-blue-950/50 via-slate-900 to-slate-900 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                  : 'bg-slate-900/50 border-slate-800/90 hover:bg-slate-850 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                  selectionMode === 'all'
                    ? 'bg-blue-500 text-white font-black shadow-md shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                🌐
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${selectionMode === 'all' ? 'text-white' : 'text-slate-300'}`}>
                    2. Ver todas las opciones
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    4 niveles
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Bancos, billeteras, tarjetas de crédito/débito y beneficios
                </p>
              </div>
              {selectionMode === 'all' && (
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping absolute top-3 right-3" />
              )}
            </button>
          </div>

          {/* CONTENIDO OPCIÓN 1: MIS PRODUCTOS */}
          {selectionMode === 'profile' && (
            <div className="space-y-5 animate-fadeIn">
              {hasRegisteredProfile && userProfileCatalog ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 mb-4 text-xs text-emerald-300">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✨</span>
                      <span>
                        Simulando exclusivamente con tus{' '}
                        <strong className="text-white font-bold">{userProfileItemCount} medios de pago</strong> guardados.
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={selectOnlyProfile}
                        className="text-emerald-400 hover:text-white font-semibold underline"
                      >
                        Marcar todos mis productos
                      </button>
                      <Link
                        href="/perfil"
                        className="font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg transition-colors shrink-0"
                      >
                        Editar mi perfil →
                      </Link>
                    </div>
                  </div>

                  {/* Bancos */}
                  {userProfileCatalog.banks.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <span>🏛️</span> Tus Bancos ({userProfileCatalog.banks.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userProfileCatalog.banks.map(bank => {
                          const isSelected = selectedMethods.includes(bank.id)
                          return (
                            <button
                              key={bank.id}
                              onClick={() => toggleMethod(bank.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                                isSelected
                                  ? 'bg-white text-slate-950 border-white shadow-md shadow-white/10 scale-[1.02]'
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span>{bank.name}</span>
                              {isSelected && <span className="text-emerald-600 font-black">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Billeteras */}
                  {userProfileCatalog.wallets.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <span>📱</span> Tus Billeteras Virtuales ({userProfileCatalog.wallets.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userProfileCatalog.wallets.map(wallet => {
                          const isSelected = selectedMethods.includes(wallet.id)
                          return (
                            <button
                              key={wallet.id}
                              onClick={() => toggleMethod(wallet.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                                isSelected
                                  ? 'bg-emerald-400 text-slate-950 border-emerald-400 shadow-md shadow-emerald-400/10 scale-[1.02]'
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span>{wallet.name}</span>
                              {isSelected && <span className="text-slate-950 font-black">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tarjetas */}
                  {userProfileCatalog.cards.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <span>💳</span> Tus Tarjetas (Redes) ({userProfileCatalog.cards.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userProfileCatalog.cards.map(card => {
                          const isSelected = selectedMethods.includes(card.id)
                          return (
                            <button
                              key={card.id}
                              onClick={() => toggleMethod(card.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                                isSelected
                                  ? 'bg-blue-400 text-slate-950 border-blue-400 shadow-md shadow-blue-400/10 scale-[1.02]'
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span>{card.name}</span>
                              {isSelected && <span className="text-slate-950 font-black">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Beneficios */}
                  {userProfileCatalog.benefits.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <span>⭐</span> Tus Tarjetas de Beneficios ({userProfileCatalog.benefits.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userProfileCatalog.benefits.map(benefit => {
                          const isSelected = selectedMethods.includes(benefit.id)
                          return (
                            <button
                              key={benefit.id}
                              onClick={() => toggleMethod(benefit.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                                isSelected
                                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20 scale-[1.02]'
                                  : 'bg-amber-950/30 text-amber-300 border-amber-500/30 hover:bg-amber-950/60'
                              }`}
                            >
                              <span>⭐ {benefit.name}</span>
                              {isSelected && <span className="text-slate-950 font-black">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-[#142840]/60 border border-slate-800 text-center max-w-xl mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center text-2xl mx-auto mb-3">
                    🛡️
                  </div>
                  <h3 className="text-base font-black text-white mb-2">
                    Aún no tenés productos registrados en PromoAR
                  </h3>
                  <p className="text-xs md:text-sm text-slate-400 mb-5 leading-relaxed">
                    Iniciá sesión o configurá tus bancos, tarjetas y beneficios en tu perfil para que el simulador reconozca automáticamente tus medios de pago reales.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/login?callbackUrl=/ahorro_interactivo/farmacias"
                      className="px-4 py-2 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-400 text-slate-950 transition-colors shadow-md shadow-rose-500/20"
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/perfil"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      Configurar tarjetas
                    </Link>
                    <button
                      onClick={() => setSelectionMode('all')}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Explorar todas las opciones →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO OPCIÓN 2: TODAS LAS OPCIONES (4 NIVELES) */}
          {selectionMode === 'all' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Nivel 1: Bancos */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                      Nivel 1: Bancos ({fullCatalog.banks.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => selectAllInLevel(fullCatalog.banks)}
                      className="text-slate-400 hover:text-white font-medium underline"
                    >
                      Marcar bancos
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => deselectAllInLevel(fullCatalog.banks)}
                      className="text-slate-400 hover:text-white font-medium underline"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Buscar banco... (ej. Galicia, BNA, Santander, Córdoba, Macro)"
                    value={bankSearchQuery}
                    onChange={e => setBankSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {filteredBanks.map(bank => {
                    const isSelected = selectedMethods.includes(bank.id)
                    return (
                      <button
                        key={bank.id}
                        onClick={() => toggleMethod(bank.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-white text-slate-950 border-white shadow-md shadow-white/10 scale-[1.02]'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span>{bank.name}</span>
                        {isSelected && <span className="text-emerald-600 font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>

                {!bankSearchQuery && (
                  <div className="mt-3 text-center">
                    <button
                      onClick={() => setShowAllBanks(prev => !prev)}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {showAllBanks
                        ? '▲ Mostrar menos bancos'
                        : `▼ Ver todos los bancos de Argentina (+${fullCatalog.banks.length - 12} más)`}
                    </button>
                  </div>
                )}
              </div>

              {/* Nivel 2: Billeteras */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📱</span>
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                      Nivel 2: Billeteras Virtuales ({fullCatalog.wallets.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => selectAllInLevel(fullCatalog.wallets)}
                      className="text-slate-400 hover:text-white font-medium underline"
                    >
                      Marcar todas
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => deselectAllInLevel(fullCatalog.wallets)}
                      className="text-slate-400 hover:text-white font-medium underline"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {fullCatalog.wallets.map(wallet => {
                    const isSelected = selectedMethods.includes(wallet.id)
                    return (
                      <button
                        key={wallet.id}
                        onClick={() => toggleMethod(wallet.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-emerald-400 text-slate-950 border-emerald-400 shadow-md shadow-emerald-400/20 scale-[1.02]'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span>{wallet.name}</span>
                        {isSelected && <span className="text-slate-950 font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Nivel 3: Tarjetas */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💳</span>
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                      Nivel 3: Tarjetas de Crédito / Débito (Redes)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => selectAllInLevel(fullCatalog.cards)}
                      className="text-slate-400 hover:text-white font-medium underline"
                    >
                      Marcar todas
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => deselectAllInLevel(fullCatalog.cards)}
                      className="text-slate-400 hover:text-white font-medium underline"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {fullCatalog.cards.map(card => {
                    const isSelected = selectedMethods.includes(card.id)
                    return (
                      <button
                        key={card.id}
                        onClick={() => toggleMethod(card.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-blue-400 text-slate-950 border-blue-400 shadow-md shadow-blue-400/20 scale-[1.02]'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span>{card.name}</span>
                        {isSelected && <span className="text-slate-950 font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Nivel 4: Beneficios */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⭐</span>
                    <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                      Nivel 4: Tarjetas de Beneficios y Clubes
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => selectAllInLevel(fullCatalog.benefits)}
                      className="text-amber-400 hover:text-amber-200 font-medium underline"
                    >
                      Marcar todos
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => deselectAllInLevel(fullCatalog.benefits)}
                      className="text-amber-400 hover:text-amber-200 font-medium underline"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>
                <p className="text-xs text-amber-200/70 mb-3">
                  Incluye descuentos directos en Openfarma (Club La Nación y Clarín 365 hasta 15%), Farmaonline (10%) y Selma (10%).
                </p>

                <div className="flex flex-wrap gap-2">
                  {fullCatalog.benefits.map(benefit => {
                    const isSelected = selectedMethods.includes(benefit.id)
                    return (
                      <button
                        key={benefit.id}
                        onClick={() => toggleMethod(benefit.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/25 scale-[1.02]'
                            : 'bg-amber-950/40 text-amber-200 border-amber-500/40 hover:bg-amber-900/50 hover:text-white'
                        }`}
                      >
                        <span>⭐ {benefit.name}</span>
                        {isSelected && <span className="text-slate-950 font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PASO 2: Gasto estimado y día de compra */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  💊 Paso 2: Tu compra mensual en farmacia
                </h2>
                <span className="text-xl font-black text-rose-400">
                  ${monthlySpend.toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Medicamentos, cuidado personal, dermocosmética y perfumería
              </p>

              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {SPEND_PRESETS.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setMonthlySpend(amount)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                      monthlySpend === amount
                        ? 'bg-rose-500 text-white font-black shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    ${amount / 1000}k
                  </button>
                ))}
              </div>

              <input
                type="range"
                min={10000}
                max={150000}
                step={5000}
                value={monthlySpend}
                onChange={e => setMonthlySpend(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>$10k</span>
                <span>$75k</span>
                <span>$150k</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  📅 ¿Qué día vas a la farmacia?
                </h2>
                <span className="text-xs font-bold text-slate-400">
                  {selectedDay === 'today' ? `Hoy (${todayInfo.name})` : DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Los bancos concentran sus mejores reintegros en días específicos
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {DAYS_OF_WEEK.slice(0, 5).map(day => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                      selectedDay === day.id
                        ? 'bg-rose-500 text-white font-black shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {DAYS_OF_WEEK.slice(5).map(day => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                      selectedDay === day.id
                        ? 'bg-rose-500 text-white font-black shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PODIO DE RESULTADOS */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                Veredicto en vivo
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
                El podio de farmacias para vos
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#142840] hover:bg-[#1E3A5F] border border-[#26406F] text-slate-200 flex items-center gap-2 transition-all shadow-sm"
              >
                <span>🔗</span>
                <span>{copiedShare ? '¡Enlace copiado!' : 'Compartir cálculo'}</span>
              </button>
            </div>
          </div>

          {topWinner && (
            <div
              className={`relative overflow-hidden rounded-3xl border ${topWinner.config.borderClass} ${topWinner.config.glowClass} bg-gradient-to-br ${topWinner.config.bgGradient} p-6 md:p-8 mb-6 transition-all`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 flex items-center gap-1">
                      <span>🏆</span> Puesto 1: Mayor ahorro en farmacia
                    </span>
                    <span className="text-xs text-slate-400 italic">
                      "{topWinner.config.tagline}"
                    </span>
                  </div>

                  <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                    {topWinner.brand}
                  </h3>

                  {topWinner.hasMatch && topWinner.matchedPromo ? (
                    <p className="text-sm md:text-base text-slate-300 mt-2 max-w-xl">
                      Ahorrás con{' '}
                      <span className="text-white font-bold underline decoration-rose-400 underline-offset-4">
                        {topWinner.matchedPromo.title}
                      </span>{' '}
                      ({topWinner.matchedPromo.discountPct}% OFF
                      {topWinner.matchedPromo.capAmount ? `, tope $${topWinner.matchedPromo.capAmount.toLocaleString('es-AR')}` : ''})
                    </p>
                  ) : topWinner.hasAlternateDayMatch && topWinner.alternateDayPromo ? (
                    <p className="text-sm text-amber-300 mt-2">
                      ⚠️ No hay promo activa hoy, pero los{' '}
                      <strong>{topWinner.alternateDayPromo.validDays.join(', ')}</strong> ahorrás hasta{' '}
                      <strong>${topWinner.savings.toLocaleString('es-AR')}</strong> con{' '}
                      {topWinner.alternateDayPromo.title}.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 mt-2">
                      Sin promociones coincidentes para las tarjetas marcadas.
                    </p>
                  )}
                </div>

                <div className="flex md:flex-col items-baseline md:items-end justify-between border-t md:border-t-0 border-slate-800/80 pt-4 md:pt-0">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Ahorro estimado
                  </span>
                  <div className="text-3xl md:text-5xl font-black text-rose-400 drop-shadow-sm">
                    ${topWinner.savings.toLocaleString('es-AR')}
                  </div>
                  {topWinner.savings > 0 && (
                    <span className="text-[11px] text-slate-400 mt-1 font-mono">
                      Pagás ${Math.max(0, monthlySpend - topWinner.savings).toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              </div>

              {topWinner.opportunityMore && (
                <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 px-3.5 py-2 rounded-xl border border-amber-500/20">
                  <span className="text-base shrink-0">💡</span>
                  <span>
                    <strong>Tip de ahorro extra:</strong> Si pagaras con{' '}
                    <strong className="text-white">{topWinner.opportunityMore.entityLabel}</strong>{' '}
                    ahorrarías <strong>+${topWinner.opportunityMore.diff.toLocaleString('es-AR')} más</strong> en {topWinner.brand}.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {secondPlace && (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                    <span>🥈</span> Puesto 2
                  </span>
                  <h4 className="text-lg font-black text-white">{secondPlace.brand}</h4>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {secondPlace.matchedPromo?.title || 'Sin promo para tus tarjetas seleccionadas'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-black text-rose-400">
                    ${secondPlace.savings.toLocaleString('es-AR')}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">ahorro</div>
                </div>
              </div>
            )}

            {thirdPlace && (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                    <span>🥉</span> Puesto 3
                  </span>
                  <h4 className="text-lg font-black text-white">{thirdPlace.brand}</h4>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {thirdPlace.matchedPromo?.title || 'Sin promo para tus tarjetas seleccionadas'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-black text-rose-400">
                    ${thirdPlace.savings.toLocaleString('es-AR')}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">ahorro</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DETALLE POR CADENA DE FARMACIAS */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <span>🏷️</span> Detalle por cadena de farmacias
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              Ordenado por mayor ahorro
            </span>
          </div>

          <div className="space-y-4">
            {resultsByBrand.map((item, index) => {
              const hasPositiveSavings = item.savings > 0
              const finalPrice = Math.max(0, monthlySpend - item.savings)

              return (
                <div
                  key={item.brand}
                  className={`p-5 md:p-6 rounded-2xl border transition-all ${
                    hasPositiveSavings
                      ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-sm'
                      : 'bg-slate-950/40 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm text-white"
                        style={{ backgroundColor: item.config.color }}
                      >
                        #{index + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg font-black text-white">{item.brand}</h3>
                          <span className="text-xs text-slate-400 italic">
                            • {item.config.tagline}
                          </span>
                          {item.hasMatch && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              Promo activa
                            </span>
                          )}
                        </div>

                        {item.hasMatch && item.matchedPromo ? (
                          <div className="mt-1">
                            <p className="text-xs md:text-sm text-slate-300 font-medium">
                              {item.matchedPromo.title}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                              <span className="text-rose-400 font-bold">
                                {item.matchedPromo.discountPct}% OFF
                              </span>
                              {item.matchedPromo.capAmount && (
                                <span>Tope: ${item.matchedPromo.capAmount.toLocaleString('es-AR')}</span>
                              )}
                              <span>• Días: {item.matchedPromo.validDays.join(', ')}</span>
                            </div>
                          </div>
                        ) : item.hasAlternateDayMatch && item.alternateDayPromo ? (
                          <div className="mt-1 text-xs text-amber-300">
                            <span>
                              Sin promo hoy. Pero los{' '}
                              <strong>{item.alternateDayPromo.validDays.join(', ')}</strong> ahorrás hasta{' '}
                              <strong>${item.savings.toLocaleString('es-AR')}</strong> con{' '}
                              {item.alternateDayPromo.title}.
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-slate-500">
                            {item.topGeneralPromo ? (
                              <span>
                                Mejor promo de la cadena:{' '}
                                <strong className="text-slate-400">{item.topGeneralPromo.title}</strong>{' '}
                                (no coincide con tus tarjetas seleccionadas).
                              </span>
                            ) : (
                              <span>Sin promociones bancarias registradas en este período.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-baseline md:items-end justify-between border-t md:border-t-0 border-slate-800 pt-3 md:pt-0 shrink-0">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block md:text-right">
                          Ahorro real
                        </span>
                        <div
                          className={`text-2xl font-black ${
                            hasPositiveSavings ? 'text-rose-400' : 'text-slate-600'
                          }`}
                        >
                          ${item.savings.toLocaleString('es-AR')}
                        </div>
                      </div>

                      {hasPositiveSavings && (
                        <div className="text-xs text-slate-400 font-mono text-right mt-0.5">
                          Final: ${finalPrice.toLocaleString('es-AR')}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.opportunityZero && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/15">
                      <span className="text-base shrink-0">💡</span>
                      <span>
                        <strong>Ahorro potencial:</strong> Con{' '}
                        <strong className="text-white">{item.opportunityZero.entityLabel}</strong> podrías
                        ahorrar hasta{' '}
                        <strong className="text-rose-400">
                          ${item.opportunityZero.savings.toLocaleString('es-AR')}
                        </strong>{' '}
                        en {item.brand}.
                      </span>
                    </div>
                  )}

                  {item.opportunityMore && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-sky-300/90 bg-sky-500/5 px-3 py-2 rounded-xl border border-sky-500/15">
                      <span className="text-base shrink-0">✨</span>
                      <span>
                        <strong>Tip para ahorrar más:</strong> Si pagaras con{' '}
                        <strong className="text-white">{item.opportunityMore.entityLabel}</strong> tu ahorro
                        subiría a{' '}
                        <strong className="text-rose-400">
                          ${item.opportunityMore.savings.toLocaleString('es-AR')}
                        </strong>{' '}
                        (+${item.opportunityMore.diff.toLocaleString('es-AR')} extra).
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Aviso Legal y Descargo de Responsabilidad */}
        <div className="p-6 md:p-7 rounded-2xl bg-slate-900/60 border border-slate-800/90 text-xs text-slate-400 leading-relaxed space-y-3 mb-10">
          <div className="flex items-center gap-2 text-slate-200 font-bold uppercase tracking-wider text-[11px]">
            <span className="text-amber-400 text-sm">⚖️</span>
            <span>Términos, condiciones y descargo de responsabilidad</span>
          </div>
          <p>
            Los cálculos, porcentajes de descuento, reintegros estimados y topes exhibidos en este simulador son de carácter <strong className="text-slate-300">estrictamente informativo y referencial</strong>. La información final, oficial y vinculante respecto de vigencias, días habilitados, topes de reintegro por cuenta/transacción, medios de pago participantes y sucursales adheridas se encuentra exclusivamente en las <strong className="text-slate-300">bases y condiciones publicadas por cada entidad bancaria, billetera virtual, tarjeta de beneficios o cadena farmacéutica (Farmacity, Farmaplus, Openfarma, Selma, etc.)</strong>.
          </p>
          <p>
            Cada entidad y farmacia se reserva el derecho de modificar, suspender o dar de baja sus promociones sin previo aviso. Recomendamos a los usuarios <strong className="text-slate-300">leer atentamente las exclusiones específicas de cada promoción</strong> antes de efectuar la compra (tales como medicamentos con receta médica, productos oncológicos o de alto costo, leches maternizadas, perfumería importada o compras mediante obras sociales/prepagas donde el descuento bancario no sea acumulable).
          </p>
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/70">
            PromoAR es una plataforma independiente de agregación y difusión de beneficios. PromoAR no emite instrumentos de pago, no procesa transacciones monetarias ni forma parte de la relación contractual entre el consumidor, la entidad financiera y la farmacia, quedando expresamente desligada de cualquier responsabilidad civil, comercial o de cualquier otra índole por divergencias en los montos acreditados, rechazos de pago, demoras en las devoluciones o modificaciones comerciales unilaterales dispuestas por los emisores.
          </p>
        </div>
      </div>

      {/* Footer oficial con la estructura de PromoAR */}
      <footer className="w-full bg-[#060D1A] border-t border-slate-800/80 text-slate-400 py-12 px-4 mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {/* Columna 1: Marca y Redes */}
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-block mb-3">
                <span className="text-xl font-black text-white tracking-tight">
                  Promo<span className="text-[#D94F2B]">AR</span>
                </span>
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                El agregador de promociones bancarias y descuentos más completo de Argentina.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://www.instagram.com/promoar.com.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
                <a
                  href="https://wa.me/541173691613"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <span className="text-sm">💬</span>
                </a>
              </div>
            </div>

            {/* Columna 2: Herramientas */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Herramientas</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/promos" className="hover:text-white transition-colors">Todas las Promos</Link></li>
                <li><Link href="/ahorro-interactivo/supermercados" className="text-emerald-400 font-semibold hover:text-white transition-colors">Simulador Supermercados</Link></li>
                <li><Link href="/ahorro-interactivo/combustible" className="text-[#E8724F] font-semibold hover:text-white transition-colors">Simulador Nafta</Link></li>
                <li><Link href="/ahorro-interactivo/farmacias" className="text-rose-400 font-semibold hover:text-white transition-colors">Simulador Farmacias</Link></li>
                <li><Link href="/finanzas" className="hover:text-white transition-colors">Tasas de Billeteras</Link></li>
                <li><Link href="/perfil" className="hover:text-white transition-colors">Mi Perfil Financiero</Link></li>
              </ul>
            </div>

            {/* Columna 3: Empresa */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Empresa</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/quienes-somos" className="hover:text-white transition-colors">Quiénes somos</Link></li>
                <li><Link href="/como-funciona" className="hover:text-white transition-colors">Cómo funciona</Link></li>
                <li><Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link></li>
              </ul>
            </div>

            {/* Columna 4: Legal */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Legal</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link></li>
                <li><Link href="/terminos" className="hover:text-white transition-colors">Términos y Condiciones</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera y farmacia. Verificá términos, vigencia y exclusiones antes de comprar.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
