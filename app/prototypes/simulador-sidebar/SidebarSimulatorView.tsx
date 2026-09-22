'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import SimulatorHeader from '@/app/components/SimulatorHeader'
import TreeFilterSidebar from '@/app/components/TreeFilterSidebar'
import { FourLevelsCatalog } from '@/app/components/SimulatorPaymentSelector'
import { CombustiblePromoItem, FuelBrand, CombustibleRequirement } from '@/app/ahorro_interactivo/combustible/CombustibleSimulator'

interface Props {
  initialPromos: CombustiblePromoItem[]
  fullCatalog: FourLevelsCatalog
  userProfileCatalog: FourLevelsCatalog | null
  initialUserMethods?: string[]
  userInfo?: {
    name: string | null
    email: string | null
  } | null
}

const BRAND_CONFIG: Record<FuelBrand, {
  name: string
  color: string
  glowClass: string
  borderClass: string
  bgGradient: string
  badgeBg: string
}> = {
  YPF: {
    name: 'YPF',
    color: '#0057B8',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(0,87,184,0.3)]',
    borderClass: 'border-[#0057B8]/40 hover:border-[#0057B8]',
    bgGradient: 'from-[#0057B8]/15 via-[#0A1428] to-[#0A1428]',
    badgeBg: 'bg-[#0057B8]/20 text-[#4D9CFF] border-[#0057B8]/40',
  },
  Axion: {
    name: 'Axion Energy',
    color: '#9B1B82',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(155,27,130,0.3)]',
    borderClass: 'border-[#9B1B82]/40 hover:border-[#9B1B82]',
    bgGradient: 'from-[#9B1B82]/15 via-[#0A1428] to-[#0A1428]',
    badgeBg: 'bg-[#9B1B82]/20 text-[#E86BD0] border-[#9B1B82]/40',
  },
  Shell: {
    name: 'Shell',
    color: '#FBCE07',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(251,206,7,0.25)]',
    borderClass: 'border-[#FBCE07]/40 hover:border-[#FBCE07]',
    bgGradient: 'from-[#FBCE07]/15 via-[#0A1428] to-[#0A1428]',
    badgeBg: 'bg-[#FBCE07]/20 text-[#FFDE59] border-[#FBCE07]/40',
  },
  Puma: {
    name: 'Puma Energy',
    color: '#008752',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(0,135,82,0.3)]',
    borderClass: 'border-[#008752]/40 hover:border-[#008752]',
    bgGradient: 'from-[#008752]/15 via-[#0A1428] to-[#0A1428]',
    badgeBg: 'bg-[#008752]/20 text-[#47D195] border-[#008752]/40',
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

function matchesMethod(userMethod: string, entitySlug: string | null, entityName: string | null): boolean {
  const m = (userMethod || '').toLowerCase()
  const s = (entitySlug || '').toLowerCase()
  const n = (entityName || '').toLowerCase()

  if (!m) return false
  if (m === s) return true

  // Banco Nación
  if (m === 'bna' || m === 'banco-nacion') return s.includes('nacion') || n.includes('naci')
  if (m === 'galicia' || m === 'banco-galicia') return s.includes('galicia') || n.includes('galicia')
  if (m === 'santander' || m === 'banco-santander') return s.includes('santander') || n.includes('santander')
  if (m === 'bbva' || m === 'banco-bbva') return s.includes('bbva') || n.includes('bbva')
  if (m === 'macro' || m === 'banco-macro') return s.includes('macro') || n.includes('macro')
  if (m === 'ciudad' || m === 'banco-ciudad') return s.includes('ciudad') || n.includes('ciudad')
  if (m === 'provincia' || m === 'banco-provincia') return s.includes('provincia') || n.includes('provincia')
  if (m === 'credicoop' || m === 'banco-credicoop') return s.includes('credicoop') || n.includes('credicoop')

  // Billeteras
  if (m === 'cuenta-dni' || m === 'cuentadni') return s.includes('cuenta-dni') || s.includes('cuentadni') || n.includes('cuenta dni')
  if (m === 'modo') return s.includes('modo') || n.includes('modo')
  if (m === 'personal-pay' || m === 'personalpay') return s.includes('personal-pay') || s.includes('personalpay') || n.includes('personal pay')
  if (m === 'app-ypf') return s.includes('app-ypf') || n.includes('app ypf') || (s === 'ypf' && n.includes('app'))
  if (m === 'shell-box') return s.includes('shell-box') || n.includes('shell box')
  if (m === 'mercadopago' || m === 'mercado-pago') return s.includes('mercadopago') || s.includes('mercado-pago') || n.includes('mercado pago')
  if (m === 'uala') return s.includes('uala') || n.includes('ualá')

  // Redes
  if (m === 'visa') return s.includes('visa') || n.includes('visa')
  if (m === 'mastercard') return s.includes('mastercard') || n.includes('mastercard')
  if (m === 'amex' || m === 'american-express') return s.includes('amex') || s.includes('american-express') || n.includes('american express')
  if (m === 'cabal') return s.includes('cabal') || n.includes('cabal')

  return s.includes(m) || m.includes(s) || n.includes(m)
}

function promoMatchesRequirements(promo: CombustiblePromoItem, userMethods: string[]): boolean {
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

function getPromoEntityLabel(promo: CombustiblePromoItem): string {
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
  return 'otra tarjeta o app'
}

function getUniqueBadges(reqs: CombustibleRequirement[]) {
  const map = new Map<string, { name: string; type: 'bank' | 'wallet' | 'card' }>()
  for (const r of reqs) {
    if (r.bankName) {
      map.set(`bank-${r.bankSlug || r.bankName}`, { name: r.bankName, type: 'bank' })
    }
    if (r.walletName) {
      map.set(`wallet-${r.walletSlug || r.walletName}`, { name: r.walletName, type: 'wallet' })
    }
    if (r.cardNetworkName && !r.bankName && !r.walletName) {
      map.set(`card-${r.cardNetworkSlug || r.cardNetworkName}`, { name: r.cardNetworkName, type: 'card' })
    }
  }
  return Array.from(map.values())
}

export default function SidebarSimulatorView({
  initialPromos,
  fullCatalog,
  userProfileCatalog,
  initialUserMethods = [],
  userInfo = null,
}: Props) {
  // Estado de medios de pago seleccionados
  const [selectedMethods, setSelectedMethods] = useState<string[]>(() => {
    if (initialUserMethods.length > 0) return initialUserMethods
    return ['banco-nacion', 'modo', 'cuenta-dni', 'galicia', 'visa', 'personal-pay', 'app-ypf']
  })

  // Día y gasto
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [monthlySpend, setMonthlySpend] = useState<number>(80000)
  const [copiedShare, setCopiedShare] = useState(false)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

  const todayInfo = useMemo(() => getTodayInfo(), [])

  // Sincronizar con URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const cardsParam = urlParams.get('cards')
    const spendParam = urlParams.get('gasto')
    const dayParam = urlParams.get('dia')

    if (cardsParam) {
      const cards = cardsParam.split(',').filter(Boolean)
      if (cards.length > 0) setSelectedMethods(cards)
    }
    if (spendParam && !isNaN(Number(spendParam))) {
      setMonthlySpend(Number(spendParam))
    }
    if (dayParam) setSelectedDay(dayParam)
  }, [])

  const toggleMethod = (id: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter(m => m !== id)
      }
      return [...prev, id]
    })
  }

  const selectAll = () => {
    const all = [
      ...fullCatalog.banks.map(b => b.id),
      ...fullCatalog.wallets.map(w => w.id),
      ...fullCatalog.cards.map(c => c.id),
      ...fullCatalog.benefits.map(be => be.id),
    ]
    setSelectedMethods(Array.from(new Set(all)))
  }

  const clearAll = () => setSelectedMethods([])

  const selectProfileOnly = () => {
    if (initialUserMethods.length > 0) setSelectedMethods(initialUserMethods)
  }

  // Helper día
  const promoMatchesDay = (p: CombustiblePromoItem): boolean => {
    if (selectedDay === 'all') return true
    const targetBit = selectedDay === 'today' ? todayInfo.bit : parseInt(selectedDay, 10)
    if (isNaN(targetBit)) return true
    if (p.validDaysBitmask >= 127) return true
    return (p.validDaysBitmask & targetBit) !== 0
  }

  // CÁLCULO DE RESULTADOS EN TIEMPO REAL (REACTIVO)
  const resultsByBrand = useMemo(() => {
    const brands: FuelBrand[] = ['YPF', 'Axion', 'Shell', 'Puma']

    return brands.map(brand => {
      const brandPromos = initialPromos.filter(p => p.brand === brand)
      const cardMatchedPromos = brandPromos.filter(p => promoMatchesRequirements(p, selectedMethods))
      const matchedPromos = cardMatchedPromos.filter(promoMatchesDay)

      let bestPromo: CombustiblePromoItem | null = null
      let maxSavings = 0

      for (const p of matchedPromos) {
        const rawSavings = monthlySpend * (p.discountPct / 100)
        const actualSavings = p.capAmount ? Math.min(rawSavings, p.capAmount) : rawSavings
        if (actualSavings > maxSavings || !bestPromo) {
          maxSavings = actualSavings
          bestPromo = p
        }
      }

      // Promo alternativa de otro día
      const alternateDayPromo = !bestPromo && cardMatchedPromos.length > 0
        ? [...cardMatchedPromos].sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))[0]
        : null

      // Mejor promo del mercado en general
      const dayAllPromos = brandPromos.filter(promoMatchesDay)
      const candidatePromos = dayAllPromos.length > 0 ? dayAllPromos : brandPromos

      let marketBestPromo: CombustiblePromoItem | null = null
      let marketMaxSavings = 0

      for (const p of candidatePromos) {
        const raw = monthlySpend * (p.discountPct / 100)
        const act = p.capAmount ? Math.min(raw, p.capAmount) : raw
        if (act > marketMaxSavings || !marketBestPromo) {
          marketMaxSavings = act
          marketBestPromo = p
        }
      }

      const roundedMaxSavings = Math.round(maxSavings)
      const roundedMarketSavings = Math.round(marketMaxSavings)

      const opportunityZero = !bestPromo && marketBestPromo && roundedMarketSavings > 0
        ? {
            promo: marketBestPromo,
            savings: roundedMarketSavings,
            entityLabel: getPromoEntityLabel(marketBestPromo),
          }
        : null

      const opportunityMore = bestPromo && marketBestPromo && (roundedMarketSavings - roundedMaxSavings >= 1500)
        ? {
            promo: marketBestPromo,
            savings: roundedMarketSavings,
            diff: roundedMarketSavings - roundedMaxSavings,
            entityLabel: getPromoEntityLabel(marketBestPromo),
          }
        : null

      const topGeneralPromo = [...brandPromos].sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))[0] || null

      return {
        brand,
        config: BRAND_CONFIG[brand],
        matchedPromo: bestPromo,
        alternateDayPromo,
        savings: roundedMaxSavings,
        hasMatch: matchedPromos.length > 0,
        hasAlternateDayMatch: !!alternateDayPromo,
        topGeneralPromo,
        totalPromosCount: brandPromos.length,
        marketBestPromo,
        opportunityZero,
        opportunityMore,
      }
    }).sort((a, b) => {
      if (a.hasMatch && b.hasMatch) return b.savings - a.savings
      if (a.hasMatch && !b.hasMatch) return -1
      if (!a.hasMatch && b.hasMatch) return 1
      return (b.topGeneralPromo?.discountPct || 0) - (a.topGeneralPromo?.discountPct || 0)
    })
  }, [initialPromos, selectedMethods, selectedDay, monthlySpend, todayInfo.bit])

  const winner = resultsByBrand.find(r => r.hasMatch && r.savings > 0)
  const totalMaxSavings = winner ? winner.savings : 0

  // Compartir
  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1428] text-slate-100 selection:bg-[#D94F2B]/30 pb-20">
      <SimulatorHeader active="combustible" />

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Simulador de Ahorro en Combustible
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white mb-2 leading-tight">
            ¿Dónde te conviene cargar nafta hoy?
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-2xl mx-auto leading-relaxed">
            Marcá o desmarcá opciones en el árbol de la izquierda y mirá cómo el comparador de la derecha se recalcula en tiempo real.
          </p>
        </div>

        {/* Barra superior de filtros para Mobile (< lg) */}
        <div className="lg:hidden flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md mb-4 shadow-md">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">{selectedMethods.length} medios activos</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              {selectedDay === 'today' ? `Hoy (${todayInfo.name})` : selectedDay === 'all' ? 'Toda la semana' : 'Día puntual'}
            </span>
          </div>
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <span>⚙️</span> Filtros
          </button>
        </div>

        {/* Modal / Drawer para Mobile */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-h-[90vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Filtros de Medios de Pago</span>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <TreeFilterSidebar
                  fullCatalog={fullCatalog}
                  userProfileCatalog={userProfileCatalog}
                  userInfo={userInfo}
                  selectedMethods={selectedMethods}
                  onToggleMethod={toggleMethod}
                  onSelectAll={selectAll}
                  onClearAll={clearAll}
                  onSelectProfileOnly={selectProfileOnly}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  monthlySpend={monthlySpend}
                  onChangeSpend={setMonthlySpend}
                  todayInfo={todayInfo}
                  callbackUrl="/prototypes/simulador-sidebar"
                  isMobileDrawer={true}
                  onCloseMobile={() => setIsMobileDrawerOpen(false)}
                />
              </div>
              <div className="p-3 border-t border-slate-800 bg-slate-950/80">
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Aplicar filtros ({selectedMethods.length} seleccionados)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* LAYOUT 2 COLUMNAS: ÁRBOL A LA IZQUIERDA + RESULTADOS A LA DERECHA   */}
        {/* =================================================================== */}
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          {/* COLUMNA 1: ÁRBOL DE FILTROS LATERAL (Solo Desktop) */}
          <aside className="hidden lg:block w-72 xl:w-80 shrink-0">
            <TreeFilterSidebar
              fullCatalog={fullCatalog}
              userProfileCatalog={userProfileCatalog}
              userInfo={userInfo}
              selectedMethods={selectedMethods}
              onToggleMethod={toggleMethod}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              onSelectProfileOnly={selectProfileOnly}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              monthlySpend={monthlySpend}
              onChangeSpend={setMonthlySpend}
              todayInfo={todayInfo}
              callbackUrl="/prototypes/simulador-sidebar"
            />
          </aside>

          {/* COLUMNA 2: RESULTADOS Y COMPARADOR EN TIEMPO REAL */}
          <main className="flex-1 min-w-0 w-full space-y-6">
            {/* Banner de Ganador Resumen en vivo */}
            <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-[#142840] via-[#1E3A5F] to-[#0A1428] border border-[#26406F] shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-widest text-[#8AADD4] block mb-1">
                  Tu mejor opción calculada
                </span>
                {winner ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-white">
                      🥇 {winner.brand}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Ahorrás hasta ${winner.savings.toLocaleString('es-AR')}
                    </span>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-amber-300">
                    ⚠️ Sin descuentos con los filtros actuales
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Cálculo basado en un gasto mensual de ${monthlySpend.toLocaleString('es-AR')} para {selectedDay === 'today' ? `hoy (${todayInfo.name})` : selectedDay === 'all' ? 'toda la semana' : 'el día seleccionado'}.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-xl bg-[#0A1428] hover:bg-[#142840] text-slate-200 border border-[#26406F] text-xs font-bold transition-all shadow-sm"
                >
                  {copiedShare ? '✓ Enlace copiado' : '🔗 Compartir'}
                </button>
              </div>
            </div>

            {/* Grilla de las 4 Estaciones (YPF, Axion, Shell, Puma) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resultsByBrand.map((item, index) => {
                const isWinner = index === 0 && item.hasMatch && item.savings > 0
                const finalPrice = Math.max(0, monthlySpend - item.savings)

                return (
                  <div
                    key={item.brand}
                    className={`rounded-3xl border p-5 md:p-6 transition-all relative overflow-hidden bg-gradient-to-b ${item.config.bgGradient} ${
                      isWinner
                        ? 'border-[#D94F2B] shadow-xl shadow-[#D94F2B]/10 ring-1 ring-[#D94F2B]/40 scale-[1.01]'
                        : item.hasMatch
                        ? `${item.config.borderClass} shadow-lg`
                        : 'border-slate-800/80 opacity-80'
                    }`}
                  >
                    {/* Badge de ganador */}
                    {isWinner && (
                      <div className="absolute top-0 right-0 bg-[#D94F2B] text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-wider shadow-md">
                        ⭐ Mayor Ahorro
                      </div>
                    )}

                    {/* Encabezado de la estación */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-white tracking-tight">
                            {item.brand}
                          </h3>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${item.config.badgeBg}`}>
                            {item.totalPromosCount} promos
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block">
                          {item.config.name}
                        </span>
                      </div>

                      {/* Monto de ahorro */}
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Ahorro real
                        </span>
                        <div className={`text-2xl font-black ${item.savings > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          ${item.savings.toLocaleString('es-AR')}
                        </div>
                        {item.savings > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Pagás: ${finalPrice.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cuerpo de la Promo activa */}
                    {item.hasMatch && item.matchedPromo ? (
                      <div className="space-y-3 pt-3 border-t border-[#26406F]/50 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Descuento:</span>
                          <span className="font-black text-emerald-400 text-sm">
                            {item.matchedPromo.discountPct}% OFF
                          </span>
                        </div>

                        {item.matchedPromo.capAmount && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Tope mensual:</span>
                            <span className="font-mono text-slate-200 font-bold">
                              ${item.matchedPromo.capAmount.toLocaleString('es-AR')}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Medio aplicado:</span>
                          <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                            {getUniqueBadges(item.matchedPromo.requirements).slice(0, 3).map(b => (
                              <span
                                key={b.name}
                                className="px-2 py-0.5 rounded bg-[#142840] text-[10px] font-bold text-slate-200 border border-[#26406F]"
                              >
                                {b.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#0A1428]/80 border border-[#26406F]/60 text-[11px] text-slate-300">
                          {item.matchedPromo.title}
                        </div>
                      </div>
                    ) : item.hasAlternateDayMatch && item.alternateDayPromo ? (
                      /* Sugerencia de otro día */
                      <div className="pt-3 border-t border-[#26406F]/50 text-xs space-y-2">
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                          <span className="font-bold">🗓️ Oportunidad en otro día:</span> Tenés{' '}
                          <strong className="text-white font-bold">{item.alternateDayPromo.discountPct}% OFF</strong>{' '}
                          los días <strong>{item.alternateDayPromo.validDays.join(', ')}</strong>.
                        </div>
                      </div>
                    ) : item.opportunityZero ? (
                      /* No tiene tarjetas que apliquen */
                      <div className="pt-3 border-t border-[#26406F]/50 text-xs space-y-2">
                        <p className="text-slate-500 text-xs">
                          Sin descuento con tus filtros seleccionados.
                        </p>
                        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-200">
                          💡 Con <strong>{item.opportunityZero.entityLabel}</strong> podrías ahorrar hasta{' '}
                          <strong className="text-emerald-300 font-bold">${item.opportunityZero.savings.toLocaleString('es-AR')}</strong>.
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-[#26406F]/50 text-xs text-slate-500">
                        Sin promociones vigentes para este criterio.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Aviso Legal y Descargo de Responsabilidad */}
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
            <p>© {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera y petrolera. Verificá términos, vigencia y exclusiones antes de comprar.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
