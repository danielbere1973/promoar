'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import SimulatorHeader from '@/app/components/SimulatorHeader'
import TreeFilterSidebar from '@/app/components/TreeFilterSidebar'
import { FourLevelsCatalog } from '@/app/components/SimulatorPaymentSelector'

export type FuelBrand = 'YPF' | 'Axion' | 'Shell' | 'Puma'

export interface CombustibleRequirement {
  bankName: string | null
  bankSlug: string | null
  walletName: string | null
  walletSlug: string | null
  cardNetworkName: string | null
  cardNetworkSlug: string | null
}

export interface CombustiblePromoItem {
  id: string
  brand: FuelBrand
  title: string
  description: string | null
  discountPct: number
  capAmount: number | null
  validDays: string[]
  validDaysBitmask: number
  requirements: CombustibleRequirement[]
  isFeatured: boolean
  logoUrl: string | null
}

export interface CombustibleResultItem {
  brand: FuelBrand
  config: {
    name: string
    color: string
    glowClass: string
    borderClass: string
    bgGradient: string
    badgeBg: string
  }
  matchedPromo: CombustiblePromoItem | null
  alternateDayPromo: CombustiblePromoItem | null
  savings: number
  hasMatch: boolean
  hasAlternateDayMatch: boolean
  topGeneralPromo: CombustiblePromoItem | null
  totalPromosCount: number
  marketBestPromo: CombustiblePromoItem | null
  opportunityZero: {
    promo: CombustiblePromoItem
    savings: number
    entityLabel: string
  } | null
  opportunityMore: {
    promo: CombustiblePromoItem
    savings: number
    diff: number
    entityLabel: string
  } | null
}

export interface CombustibleSimulatorProps {
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
    badgeBg: 'bg-[#FBCE07]/20 text-[#FBCE07] border-[#FBCE07]/40',
  },
  Puma: {
    name: 'Puma Energy',
    color: '#006837',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(0,104,55,0.3)]',
    borderClass: 'border-[#006837]/40 hover:border-[#006837]',
    bgGradient: 'from-[#006837]/15 via-[#0A1428] to-[#0A1428]',
    badgeBg: 'bg-[#006837]/20 text-[#00A859] border-[#006837]/40',
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

function matchSlugOrName(userMethod: string, entitySlug: string | null, entityName: string | null): boolean {
  const m = userMethod.toLowerCase().trim()
  const s = (entitySlug || '').toLowerCase().trim()
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

  return promo.requirements.some(req => {
    const bMatch = req.bankSlug
      ? userMethods.some(m => matchSlugOrName(m, req.bankSlug, req.bankName))
      : true
    const wMatch = req.walletSlug
      ? userMethods.some(m => matchSlugOrName(m, req.walletSlug, req.walletName))
      : true
    const cMatch = req.cardNetworkSlug
      ? userMethods.some(m => matchSlugOrName(m, req.cardNetworkSlug, req.cardNetworkName))
      : true

    if (req.bankSlug && req.walletSlug) return bMatch && wMatch
    if (req.bankSlug) return bMatch
    if (req.walletSlug) return wMatch
    if (req.cardNetworkSlug) return cMatch
    return true
  })
}

function calculateSavings(promo: CombustiblePromoItem, monthlySpend: number): number {
  const theoretical = (monthlySpend * promo.discountPct) / 100
  if (promo.capAmount && promo.capAmount > 0) {
    return Math.min(theoretical, promo.capAmount)
  }
  return theoretical
}

function getRepresentativeEntity(promo: CombustiblePromoItem): string {
  const req = promo.requirements[0]
  if (!req) return 'Promoción abierta'
  if (req.bankName && req.walletName) return `${req.bankName} + ${req.walletName}`
  if (req.bankName) return req.bankName
  if (req.walletName) return req.walletName
  if (req.cardNetworkName) return req.cardNetworkName
  return 'Promoción bancaria'
}

export default function CombustibleSimulator({
  initialPromos,
  fullCatalog,
  userProfileCatalog,
  initialUserMethods = [],
  userInfo,
}: CombustibleSimulatorProps) {
  const allInitial = useMemo(() => {
    const list: string[] = []
    fullCatalog.banks.forEach(b => list.push(b.id))
    fullCatalog.wallets.forEach(w => list.push(w.id))
    fullCatalog.cards.forEach(c => list.push(c.id))
    fullCatalog.benefits.forEach(be => list.push(be.id))
    return list
  }, [fullCatalog])

  const [selectedMethods, setSelectedMethods] = useState<string[]>(() => {
    if (initialUserMethods.length > 0) return initialUserMethods
    return allInitial
  })

  const [selectedDay, setSelectedDay] = useState<string>('today')
  const [monthlySpend, setMonthlySpend] = useState<number>(80000)
  const [todayInfo, setTodayInfo] = useState({ bit: 16, name: 'Jueves' })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false)

  useEffect(() => {
    setTodayInfo(getTodayInfo())
  }, [])

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

  const results: CombustibleResultItem[] = useMemo(() => {
    const brands: FuelBrand[] = ['YPF', 'Axion', 'Shell', 'Puma']

    return brands.map(brand => {
      const brandPromos = initialPromos.filter(p => p.brand === brand)

      let dayFiltered = brandPromos
      if (selectedDay === 'today') {
        dayFiltered = brandPromos.filter(p => (p.validDaysBitmask & todayInfo.bit) !== 0)
      } else if (selectedDay !== 'all') {
        const bit = parseInt(selectedDay, 10)
        if (!isNaN(bit)) {
          dayFiltered = brandPromos.filter(p => (p.validDaysBitmask & bit) !== 0)
        }
      }

      const matchingPromos = dayFiltered
        .filter(p => promoMatchesRequirements(p, selectedMethods))
        .map(p => ({ promo: p, savings: calculateSavings(p, monthlySpend) }))
        .sort((a, b) => b.savings - a.savings)

      const bestMatch = matchingPromos[0] || null

      let alternateDayBest: { promo: CombustiblePromoItem; savings: number } | null = null
      if (!bestMatch && selectedDay !== 'all') {
        const altMatching = brandPromos
          .filter(p => promoMatchesRequirements(p, selectedMethods))
          .map(p => ({ promo: p, savings: calculateSavings(p, monthlySpend) }))
          .sort((a, b) => b.savings - a.savings)

        if (altMatching.length > 0) {
          alternateDayBest = altMatching[0]
        }
      }

      const marketBest = dayFiltered
        .map(p => ({ promo: p, savings: calculateSavings(p, monthlySpend) }))
        .sort((a, b) => b.savings - a.savings)[0] || null

      let opportunityZero: CombustibleResultItem['opportunityZero'] = null
      let opportunityMore: CombustibleResultItem['opportunityMore'] = null

      if (!bestMatch && marketBest) {
        opportunityZero = {
          promo: marketBest.promo,
          savings: marketBest.savings,
          entityLabel: getRepresentativeEntity(marketBest.promo),
        }
      } else if (bestMatch && marketBest && marketBest.savings > bestMatch.savings + 500) {
        opportunityMore = {
          promo: marketBest.promo,
          savings: marketBest.savings,
          diff: marketBest.savings - bestMatch.savings,
          entityLabel: getRepresentativeEntity(marketBest.promo),
        }
      }

      const topGeneral = dayFiltered
        .map(p => ({ promo: p, savings: calculateSavings(p, monthlySpend) }))
        .sort((a, b) => b.savings - a.savings)[0]?.promo || null

      return {
        brand,
        config: BRAND_CONFIG[brand],
        matchedPromo: bestMatch?.promo || null,
        alternateDayPromo: alternateDayBest?.promo || null,
        savings: bestMatch?.savings || 0,
        hasMatch: !!bestMatch,
        hasAlternateDayMatch: !!alternateDayBest,
        topGeneralPromo: topGeneral,
        totalPromosCount: brandPromos.length,
        marketBestPromo: marketBest?.promo || null,
        opportunityZero,
        opportunityMore,
      }
    }).sort((a, b) => b.savings - a.savings)
  }, [initialPromos, selectedMethods, selectedDay, monthlySpend, todayInfo])

  const topBrand = results[0]
  const secondBrand = results[1]
  const hasAnyMatch = results.some(r => r.hasMatch)
  const monthlySavingsPotential = topBrand?.savings || 0

  return (
    <div className="min-h-screen bg-[#0A1428] text-slate-100 flex flex-col justify-between">
      {/* Header oficial del simulador */}
      <SimulatorHeader active="combustible" />

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
                callbackUrl="/ahorro-interactivo/combustible"
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
              callbackUrl="/ahorro-interactivo/combustible"
            />
          </aside>

          {/* COLUMNA DERECHA: Resultados del Simulador */}
          <main className="flex-1 min-w-0 w-full space-y-4">
            {/* Banner de Ganador */}
            {hasAnyMatch && topBrand && monthlySavingsPotential > 0 ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Mejor opción para vos
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">
                    Cargando en <strong className="text-white font-bold">{topBrand.config.name}</strong> ahorrás hasta{' '}
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
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                    {topBrand.matchedPromo?.discountPct}% OFF
                  </span>
                </div>
              </div>
            ) : null}

            {/* Grid de Petroleras */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map(item => {
                const isWinner = hasAnyMatch && topBrand?.brand === item.brand && item.savings > 0
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
                          <h3 className="font-bold text-sm text-white">
                            {item.config.name}
                          </h3>
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
                              Tenés promo del {item.alternateDayPromo.discountPct}% ({item.alternateDayPromo.title}) con tus tarjetas, pero no aplica {selectedDay === 'today' ? 'hoy' : 'el día seleccionado'}.
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
            <p>© {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera y petrolera. Verificá términos, vigencia y exclusiones antes de comprar.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
