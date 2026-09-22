'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import SimulatorHeader from '@/app/components/SimulatorHeader'
import TreeFilterSidebar from '@/app/components/TreeFilterSidebar'
import { FourLevelsCatalog, CatalogEntity } from '@/app/components/SimulatorPaymentSelector'

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

export { type CatalogEntity, type FourLevelsCatalog }

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

export interface FarmaciasSimulatorProps {
  initialPromos: PharmacyPromoItem[]
  fullCatalog: FourLevelsCatalog
  userProfileCatalog: FourLevelsCatalog | null
  initialUserMethods?: string[]
  userInfo?: {
    name: string | null
    email: string | null
  } | null
}

export type Props = FarmaciasSimulatorProps

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
}: FarmaciasSimulatorProps) {
  const allInitial = useMemo(() => {
    return [
      ...fullCatalog.banks.map(b => b.id),
      ...fullCatalog.wallets.map(w => w.id),
      ...fullCatalog.cards.map(c => c.id),
      ...fullCatalog.benefits.map(b => b.id),
    ]
  }, [fullCatalog])

  const [selectedMethods, setSelectedMethods] = useState<string[]>(() => {
    if (initialUserMethods.length > 0) {
      return initialUserMethods
    }
    return ['banco-nacion', 'modo', 'cuenta-dni', 'galicia', 'visa', 'clarin-365', 'club-la-nacion']
  })

  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [monthlySpend, setMonthlySpend] = useState<number>(30000)
  const [todayInfo, setTodayInfo] = useState({ bit: 16, name: 'Jueves' })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false)
  const [copiedShare, setCopiedShare] = useState(false)

  useEffect(() => {
    setTodayInfo(getTodayInfo())
  }, [])

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
      }
    } else if (initialUserMethods.length > 0) {
      setSelectedMethods(initialUserMethods)
    }

    if (spendParam && !isNaN(Number(spendParam))) {
      setMonthlySpend(Number(spendParam))
    }
    if (dayParam) {
      setSelectedDay(dayParam)
    }
  }, [initialUserMethods])

  const handleToggleMethod = (id: string) => {
    setSelectedMethods(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => setSelectedMethods(allInitial)
  const handleClearAll = () => setSelectedMethods([])

  const handleSelectProfileOnly = () => {
    if (initialUserMethods.length > 0) {
      setSelectedMethods(initialUserMethods)
    }
  }

  const handleShare = () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('cards', selectedMethods.join(','))
    url.searchParams.set('gasto', String(monthlySpend))
    url.searchParams.set('dia', selectedDay)
    navigator.clipboard.writeText(url.toString())
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 2500)
  }

  const results: PharmacyResultItem[] = useMemo(() => {
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
        hasMatch: !!bestPromo,
        hasAlternateDayMatch: !!alternateDayPromo,
        topGeneralPromo,
        totalPromosCount: brandPromos.length,
        marketBestPromo,
        opportunityZero,
        opportunityMore,
      }
    }).sort((a, b) => b.savings - a.savings)
  }, [initialPromos, selectedMethods, selectedDay, monthlySpend, todayInfo])

  const topWinner = results[0]
  const secondBrand = results[1]
  const hasAnyMatch = results.some(r => r.hasMatch)
  const monthlySavingsPotential = topWinner?.savings || 0

  return (
    <div className="min-h-screen bg-[#0A1428] text-slate-100 flex flex-col justify-between">
      {/* Header oficial del simulador */}
      <SimulatorHeader active="farmacias" />

      {/* Contenido Principal con layout 2 columnas en Desktop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Banner resumen en Mobile */}
        <div className="lg:hidden mb-4 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between sticky top-16 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtros:</span>
            <span className="text-xs font-semibold text-slate-200">
              {selectedMethods.length === allInitial.length ? 'Todos activos' : `${selectedMethods.length} seleccionados`}
            </span>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold hover:bg-sky-500/30 transition-colors flex items-center gap-1.5"
          >
            <span>Filtros</span>
            <span className="text-[10px] bg-sky-500/30 px-1 rounded-full">{selectedMethods.length}</span>
          </button>
        </div>

        {/* Modal Drawer en Mobile */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative ml-auto w-full max-w-xs h-full bg-slate-900 z-10 shadow-2xl flex flex-col">
              <TreeFilterSidebar
                fullCatalog={fullCatalog}
                userProfileCatalog={userProfileCatalog}
                userInfo={userInfo}
                selectedMethods={selectedMethods}
                onToggleMethod={handleToggleMethod}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
                onSelectProfileOnly={handleSelectProfileOnly}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                monthlySpend={monthlySpend}
                onChangeSpend={setMonthlySpend}
                todayInfo={todayInfo}
                callbackUrl="/ahorro-interactivo/farmacias"
                isMobileDrawer={true}
                onCloseMobile={() => setMobileDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Layout 2 Columnas Desktop */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* COLUMNA IZQUIERDA: Árbol de Filtros */}
          <aside className="hidden lg:block w-72 xl:w-80 shrink-0">
            <TreeFilterSidebar
              fullCatalog={fullCatalog}
              userProfileCatalog={userProfileCatalog}
              userInfo={userInfo}
              selectedMethods={selectedMethods}
              onToggleMethod={handleToggleMethod}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
              onSelectProfileOnly={handleSelectProfileOnly}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              monthlySpend={monthlySpend}
              onChangeSpend={setMonthlySpend}
              todayInfo={todayInfo}
              callbackUrl="/ahorro-interactivo/farmacias"
            />
          </aside>

          {/* COLUMNA DERECHA: Resultados del Simulador */}
          <main className="flex-1 min-w-0 w-full space-y-4">
            {/* Banner de Ganador */}
            {hasAnyMatch && topWinner && monthlySavingsPotential > 0 ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Mejor opción para vos
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">
                    Comprando en <strong className="text-white font-bold">{topWinner.config.name}</strong> ahorrás hasta{' '}
                    <strong className="text-emerald-400 font-mono text-base">
                      ${monthlySavingsPotential.toLocaleString('es-AR')}
                    </strong>{' '}
                    este mes.
                  </p>
                  {secondBrand && secondBrand.savings > 0 && (
                    <p className="text-xs text-slate-400">
                      ${(monthlySavingsPotential - secondBrand.savings).toLocaleString('es-AR')} más que en {secondBrand.config.name}.
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span>🔗</span>
                    <span>{copiedShare ? '¡Copiado!' : 'Compartir'}</span>
                  </button>
                  {topWinner.matchedPromo && (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                      {topWinner.matchedPromo.discountPct}% OFF
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* Grid de Farmacias */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map(item => {
                const isWinner = hasAnyMatch && topWinner?.brand === item.brand && item.savings > 0
                return (
                  <div
                    key={item.brand}
                    className={`rounded-2xl p-4 transition-all flex flex-col justify-between border ${
                      isWinner
                        ? `${item.config.borderClass} ${item.config.glowClass} bg-gradient-to-b ${item.config.bgGradient}`
                        : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Cabecera de marca */}
                      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.config.color }}
                          />
                          <div>
                            <h3 className="font-bold text-sm text-white">
                              {item.config.name}
                            </h3>
                            <span className="text-[10px] text-slate-400 italic">
                              "{item.config.tagline}"
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isWinner && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              Mejor Opción
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {item.totalPromosCount} promos
                          </span>
                        </div>
                      </div>

                      {/* Estado: match directo vs sin match */}
                      {item.matchedPromo ? (
                        <div className="space-y-2.5">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <div className="text-2xl font-black font-mono text-emerald-400">
                                ${item.savings.toLocaleString('es-AR')}
                              </div>
                              <span className="text-[11px] text-slate-400">Ahorro mensual estimado</span>
                            </div>
                            <span className="text-sm font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {item.matchedPromo.discountPct}% OFF
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                            <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                              {item.matchedPromo.title}
                            </p>
                            {item.matchedPromo.capAmount && (
                              <p className="text-[11px] text-slate-400">
                                Tope: ${item.matchedPromo.capAmount.toLocaleString('es-AR')} por mes
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {item.matchedPromo.requirements.map((req, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
                                >
                                  {req.bankName || req.walletName || req.cardNetworkName}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : item.alternateDayPromo ? (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300">
                            <div className="font-semibold flex items-center gap-1.5 mb-1">
                              <span>📅</span>
                              <span>Disponible otro día de la semana</span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">
                              Tenés promo del {item.alternateDayPromo.discountPct}% ({item.alternateDayPromo.title}) con tus tarjetas los días <strong>{item.alternateDayPromo.validDays.join(', ')}</strong>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                            <p>No tenés promos activas con los filtros actuales para {item.config.name}.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Oportunidad de ahorro extra si existe */}
                    {item.opportunityMore && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                        <span className="truncate">
                          💡 Con <strong className="text-slate-300">{item.opportunityMore.entityLabel}</strong>:{' '}
                          <span className="text-sky-400 font-semibold">+${item.opportunityMore.diff.toLocaleString('es-AR')} más</span>
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Aviso Legal y Descargo de Responsabilidad Condensado */}
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[11px] text-slate-400 leading-snug mt-6 flex items-center gap-2">
              <span className="text-xs shrink-0">⚖️</span>
              <p>
                Estimaciones y cálculos de carácter informativo, no vinculantes y sujetos a las condiciones de cada entidad. Consultá nuestros{' '}
                <Link href="/terminos" className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2">
                  Términos y Condiciones
                </Link>.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Footer oficial con la estructura de PromoAR */}
      <footer className="w-full bg-[#060D1A] border-t border-slate-800/80 text-slate-400 py-12 px-4 mt-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {/* Columna 1: Marca y Redes */}
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-block mb-3.5 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/promoar_logo_clean.png"
                  alt="PromoAR"
                  className="h-8 sm:h-9 w-auto object-contain block transition-transform group-hover:scale-105"
                />
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                El agregador de promociones bancarias y descuentos más completo de Argentina.
              </p>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://www.instagram.com/promoar.com.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram @promoar.com.ar"
                  title="Instagram @promoar.com.ar"
                  className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-pink-400 hover:bg-slate-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="https://x.com/promoarok"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X @promoarok"
                  title="X @promoarok"
                  className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a
                  href="https://wa.me/541173691613"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp PromoAR"
                  title="WhatsApp PromoAR"
                  className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.7 2.6 4.12 3.65.58.25 1.02.4 1.38.52.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.29-.25-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42-.14-.01-.31-.01-.47-.01"/>
                  </svg>
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
            <p>© {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera y cadena de farmacias. Verificá términos, vigencia y exclusiones antes de comprar.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
