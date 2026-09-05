'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type SupermarketBrand = 'Coto' | 'Carrefour' | 'Jumbo' | 'Dia' | 'Changomas' | 'Disco' | 'Vea'

export interface SupermarketRequirement {
  bankName: string | null
  bankSlug: string | null
  walletName: string | null
  walletSlug: string | null
}

export interface SupermarketPromoItem {
  id: string
  brand: SupermarketBrand
  title: string
  description: string | null
  discountPct: number
  capAmount: number | null
  validDays: string[]
  validDaysBitmask: number
  requirements: SupermarketRequirement[]
  isFeatured: boolean
  logoUrl: string | null
}

interface Props {
  initialPromos: SupermarketPromoItem[]
}

// Opciones del selector de días
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

// Entidades populares para supermercados en Argentina
const POPULAR_PAYMENT_METHODS = [
  { id: 'galicia', label: 'Galicia', type: 'bank', color: '#E35205' },
  { id: 'bna', label: 'Banco Nación', type: 'bank', color: '#004B87' },
  { id: 'santander', label: 'Santander', type: 'bank', color: '#EC0000' },
  { id: 'bbva', label: 'BBVA', type: 'bank', color: '#004481' },
  { id: 'macro', label: 'Banco Macro', type: 'bank', color: '#002D72' },
  { id: 'ciudad', label: 'Banco Ciudad', type: 'bank', color: '#0072CE' },
  { id: 'credicoop', label: 'Credicoop', type: 'bank', color: '#006633' },
  { id: 'cuenta-dni', label: 'Cuenta DNI', type: 'wallet', color: '#00A650' },
  { id: 'modo', label: 'MODO', type: 'wallet', color: '#00CC99' },
  { id: 'personal-pay', label: 'Personal Pay', type: 'wallet', color: '#5A2D82' },
  { id: 'naranja-x', label: 'Naranja X', type: 'wallet', color: '#FF4E00' },
  { id: 'carrefour-banco', label: 'Mi Carrefour', type: 'wallet', color: '#0055A5' },
  { id: 'uala', label: 'Ualá', type: 'wallet', color: '#E53E3E' },
  { id: 'mercadopago', label: 'Mercado Pago', type: 'wallet', color: '#009EE3' },
]

const SPEND_PRESETS = [50000, 100000, 180000, 250000, 350000]

// Estilos de marca oficiales para las cadenas de supermercados
const BRAND_CONFIG: Record<SupermarketBrand, {
  name: string
  color: string
  glowClass: string
  borderClass: string
  bgGradient: string
  badgeBg: string
  tagline: string
}> = {
  Coto: {
    name: 'Coto',
    color: '#E30613',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(227,6,19,0.35)]',
    borderClass: 'border-red-500/40 hover:border-red-400',
    bgGradient: 'from-red-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-red-600 text-white',
    tagline: 'Yo te conozco',
  },
  Carrefour: {
    name: 'Carrefour',
    color: '#0055A5',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,85,165,0.35)]',
    borderClass: 'border-blue-500/40 hover:border-blue-400',
    bgGradient: 'from-blue-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-blue-600 text-white',
    tagline: 'El precio más bajo garantizado',
  },
  Jumbo: {
    name: 'Jumbo',
    color: '#00843D',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,132,61,0.35)]',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
    bgGradient: 'from-emerald-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-emerald-600 text-white',
    tagline: 'Les va a encantar',
  },
  Changomas: {
    name: 'ChangoMás',
    color: '#0071CE',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,113,206,0.35)]',
    borderClass: 'border-sky-500/40 hover:border-sky-400',
    bgGradient: 'from-sky-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-sky-600 text-white',
    tagline: 'Más ahorro para tu familia',
  },
  Dia: {
    name: 'Supermercados Día',
    color: '#D6001C',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(214,0,28,0.35)]',
    borderClass: 'border-rose-500/40 hover:border-rose-400',
    bgGradient: 'from-rose-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-rose-600 text-white',
    tagline: 'Expertos en ahorro',
  },
  Disco: {
    name: 'Disco',
    color: '#F58220',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(245,130,32,0.3)]',
    borderClass: 'border-orange-500/40 hover:border-orange-400',
    bgGradient: 'from-orange-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-orange-500 text-white',
    tagline: 'Frescura y variedad',
  },
  Vea: {
    name: 'Vea',
    color: '#E31B23',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(227,27,35,0.3)]',
    borderClass: 'border-amber-500/40 hover:border-amber-400',
    bgGradient: 'from-amber-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-amber-600 text-white',
    tagline: 'Cerca tuyo, siempre',
  },
}

export default function SupermercadosSimulator({ initialPromos }: Props) {
  const router = useRouter()

  // Estado de medios de pago seleccionados
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['bna', 'cuenta-dni', 'modo', 'galicia'])
  // Estado de día seleccionado ('all', 'today', '2', '4', etc.)
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [monthlySpend, setMonthlySpend] = useState<number>(100000)
  const [copiedShare, setCopiedShare] = useState(false)

  const todayInfo = useMemo(() => getTodayInfo(), [])

  // Restaurar medios de pago guardados del usuario (guestProfile o query params)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Check query params first
    const urlParams = new URLSearchParams(window.location.search)
    const cardsParam = urlParams.get('cards')
    const spendParam = urlParams.get('gasto')
    const dayParam = urlParams.get('dia')

    if (cardsParam) {
      const cards = cardsParam.split(',').filter(Boolean)
      if (cards.length > 0) setSelectedMethods(cards)
    } else {
      // 2. Fallback a guestProfile
      try {
        const guestStr = localStorage.getItem('guestProfile')
        if (guestStr) {
          const guest = JSON.parse(guestStr)
          const allUserItems: string[] = []
          if (Array.isArray(guest.banks)) {
            guest.banks.forEach((b: string) => {
              const matched = POPULAR_PAYMENT_METHODS.find(p => p.type === 'bank' && (p.id === b || b.toLowerCase().includes(p.id)))
              if (matched) allUserItems.push(matched.id)
            })
          }
          if (Array.isArray(guest.wallets)) {
            guest.wallets.forEach((w: string) => {
              const matched = POPULAR_PAYMENT_METHODS.find(p => p.type === 'wallet' && (p.id === w || w.toLowerCase().includes(p.id)))
              if (matched) allUserItems.push(matched.id)
            })
          }
          if (allUserItems.length > 0) {
            setSelectedMethods(Array.from(new Set(allUserItems)))
          }
        }
      } catch {
        // ignore
      }
    }

    if (spendParam && !isNaN(Number(spendParam))) {
      setMonthlySpend(Number(spendParam))
    }
    if (dayParam && DAYS_OF_WEEK.some(d => d.id === dayParam)) {
      setSelectedDay(dayParam)
    }
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
    setSelectedMethods(POPULAR_PAYMENT_METHODS.map(m => m.id))
  }

  const clearAll = () => {
    setSelectedMethods(['bna', 'cuenta-dni'])
  }

  // Motor de cálculo de ahorro por cadena de supermercados
  const resultsByBrand = useMemo(() => {
    const brands: SupermarketBrand[] = ['Coto', 'Carrefour', 'Jumbo', 'Changomas', 'Dia', 'Disco', 'Vea']

    return brands.map(brand => {
      const brandPromos = initialPromos.filter(p => p.brand === brand)

      // 1. Filtrar promos que coinciden con los medios de pago seleccionados
      const matchedPromos = brandPromos.filter(p => {
        if (p.requirements.length === 0) return true
        return p.requirements.some(req => {
          const bankSlug = (req.bankSlug || '').toLowerCase()
          const bankName = (req.bankName || '').toLowerCase()
          const walletSlug = (req.walletSlug || '').toLowerCase()
          const walletName = (req.walletName || '').toLowerCase()

          return selectedMethods.some(userMethod => {
            const methodDef = POPULAR_PAYMENT_METHODS.find(m => m.id === userMethod)
            if (!methodDef) return false

            if (methodDef.type === 'bank') {
              return (
                bankSlug === userMethod ||
                bankSlug.includes(userMethod) ||
                bankName.includes(userMethod) ||
                bankName.includes(methodDef.label.toLowerCase())
              )
            }
            if (methodDef.type === 'wallet') {
              return (
                walletSlug === userMethod ||
                walletSlug.includes(userMethod) ||
                walletName.includes(userMethod) ||
                walletName.includes(methodDef.label.toLowerCase())
              )
            }
            return false
          })
        })
      })

      // 2. Filtrar por día seleccionado
      const dayFilteredPromos = matchedPromos.filter(p => {
        if (selectedDay === 'all') return true
        if (selectedDay === 'today') {
          return (p.validDaysBitmask & todayInfo.bit) !== 0 || p.validDaysBitmask >= 127
        }
        const bit = parseInt(selectedDay, 10)
        return (p.validDaysBitmask & bit) !== 0 || p.validDaysBitmask >= 127
      })

      // 3. Encontrar la mejor promoción y calcular el ahorro efectivo
      let bestPromo: SupermarketPromoItem | null = null
      let maxSavings = 0

      for (const promo of dayFilteredPromos) {
        const potentialSavings = (monthlySpend * (promo.discountPct || 10)) / 100
        const actualSavings = promo.capAmount ? Math.min(potentialSavings, promo.capAmount) : potentialSavings

        if (actualSavings > maxSavings) {
          maxSavings = actualSavings
          bestPromo = promo
        }
      }

      // Si no hay promo en el día específico, buscar la mejor en otro día para sugerir
      let alternateDayPromo: SupermarketPromoItem | null = null
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

      const topGeneralPromo = [...brandPromos].sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))[0] || null

      return {
        brand,
        config: BRAND_CONFIG[brand],
        matchedPromo: bestPromo,
        alternateDayPromo,
        savings: Math.round(maxSavings),
        hasMatch: matchedPromos.length > 0,
        hasAlternateDayMatch: !!alternateDayPromo,
        topGeneralPromo,
        totalPromosCount: brandPromos.length,
      }
    }).sort((a, b) => {
      if (a.hasMatch && b.hasMatch) return b.savings - a.savings
      if (a.hasMatch && !b.hasMatch) return -1
      if (!a.hasMatch && b.hasMatch) return 1
      return (b.topGeneralPromo?.discountPct || 0) - (a.topGeneralPromo?.discountPct || 0)
    })
  }, [initialPromos, selectedMethods, selectedDay, monthlySpend, todayInfo.bit])

  // Ganador absoluto
  const winner = resultsByBrand.find(r => r.hasMatch && r.savings > 0)

  // Generar link para compartir
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/ahorro-interactivo/supermercados?cards=${selectedMethods.join(',')}&gasto=${monthlySpend}&dia=${selectedDay}`
    : `https://promoar.com.ar/ahorro-interactivo/supermercados`

  const dayLabelForShare = selectedDay === 'today'
    ? `para comprar hoy ${todayInfo.name}`
    : selectedDay === 'all'
    ? 'para toda la semana'
    : `para los días ${DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label}`

  const shareText = winner
    ? `Hice el cálculo en PromoAR (${dayLabelForShare}): con mis tarjetas me conviene comprar en ${winner.brand} y ahorro hasta $${winner.savings.toLocaleString('es-AR')} este mes. Mirá en qué súper ahorrás más vos:`
    : `Calculá en qué supermercado te conviene comprar ${dayLabelForShare} (Coto, Carrefour, Jumbo, Día, ChangoMás) según tus tarjetas en PromoAR:`

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
    window.open(url, '_blank')
  }

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2500)
    }
  }

  const handleSaveToProfile = () => {
    try {
      const existing = localStorage.getItem('guestProfile')
      const parsed = existing ? JSON.parse(existing) : { banks: [], wallets: [] }

      const newBanks = selectedMethods.filter(m => POPULAR_PAYMENT_METHODS.find(p => p.id === m && p.type === 'bank'))
      const newWallets = selectedMethods.filter(m => POPULAR_PAYMENT_METHODS.find(p => p.id === m && p.type === 'wallet'))

      localStorage.setItem('guestProfile', JSON.stringify({
        ...parsed,
        banks: Array.from(new Set([...(parsed.banks || []), ...newBanks])),
        wallets: Array.from(new Set([...(parsed.wallets || []), ...newWallets])),
      }))
    } catch {
      // ignore
    }
    router.push('/promos')
  }

  return (
    <>
      {/* Barra de navegación superior clarita para destacar el logo oficial de PromoAR */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.01]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/promoar_logo_transparent.png"
              alt="PromoAR"
              className="h-10 md:h-12 w-auto object-contain shrink-0"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-[#D94F2B] hover:bg-[#c44325] text-white text-xs md:text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Entrá a PromoAR</span>
            <span className="text-white/80 font-normal">→</span>
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Header con paleta oficial PromoAR */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SIMULADOR INTELIGENTE DE SUPERMERCADOS
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
            ¿En qué supermercado te conviene <br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-emerald-300 via-white to-[#E8724F] bg-clip-text text-transparent">
              hacer la compra este mes?
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Seleccioná tus bancos y tarjetas. Calculamos en tiempo real tu mayor ahorro en{' '}
            <span className="text-slate-200 font-semibold">Coto, Carrefour, Jumbo, ChangoMás, Día, Disco y Vea</span> con reintegros y topes actualizados.
          </p>
        </div>

        {/* PASO 1: Selector interactivo de tarjetas y billeteras */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 mb-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>💳 Paso 1:</span> Marcá las tarjetas y billeteras que tenés
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Tocá para activar o desactivar cada medio de pago</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={selectAll}
                className="text-[#E8724F] hover:text-white font-semibold px-2.5 py-1 rounded bg-[#142840] hover:bg-[#1E3A5F] border border-[#26406F] transition-colors"
              >
                Marcar todos
              </button>
              <button
                onClick={clearAll}
                className="text-slate-400 hover:text-slate-200 font-medium px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {POPULAR_PAYMENT_METHODS.map(method => {
              const isSelected = selectedMethods.includes(method.id)
              return (
                <button
                  key={method.id}
                  onClick={() => toggleMethod(method.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-white text-slate-900 border-white shadow-md shadow-white/10 scale-[1.02]'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: method.color }}
                  />
                  <span>{method.label}</span>
                  {isSelected && <span className="text-emerald-600 font-black text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* PASO 2: Gasto estimado y día de compra */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Presupuesto de compra */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  🛒 Paso 2: Tu compra mensual
                </h2>
                <span className="text-xl font-black text-emerald-400">
                  ${monthlySpend.toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Elegí o deslizá cuánto gastás en el súper por mes
              </p>

              {/* Presets rápidos */}
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {SPEND_PRESETS.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setMonthlySpend(amount)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                      monthlySpend === amount
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    ${amount / 1000}k
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min={20000}
                max={400000}
                step={10000}
                value={monthlySpend}
                onChange={e => setMonthlySpend(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>$20k</span>
                <span>$200k</span>
                <span>$400k</span>
              </div>
            </div>
          </div>

          {/* Selector de día */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  📅 ¿Qué día vas al súper?
                </h2>
                <span className="text-xs font-bold text-slate-400">
                  {selectedDay === 'today' ? `Hoy (${todayInfo.name})` : DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Las cadenas cambian sus mejores descuentos según el día
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {DAYS_OF_WEEK.slice(0, 5).map(day => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                      selectedDay === day.id
                        ? 'bg-white text-slate-950 shadow-md font-black'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {day.shortLabel}
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
                        ? 'bg-white text-slate-950 shadow-md font-black'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {day.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TROFEO: Cadena Ganadora destacada */}
        {winner && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-[#142840] border border-emerald-500/40 p-6 md:p-8 mb-10 shadow-2xl">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative z-10">
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider">
                  🏆 Tu mejor opción en supermercados
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white">
                  Te conviene comprar en <span className="text-emerald-400">{winner.brand}</span>
                </h3>
                <p className="text-sm text-slate-300 max-w-xl">
                  {winner.matchedPromo?.title || `Descuento vigente para tus tarjetas con hasta ${winner.matchedPromo?.discountPct}% de reintegro.`}
                </p>
                <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 font-semibold border border-slate-700">
                    Días: {winner.matchedPromo?.validDays.join(', ')}
                  </span>
                  {winner.matchedPromo?.capAmount && (
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-amber-300 font-semibold border border-slate-700">
                      Tope reintegro: ${winner.matchedPromo.capAmount.toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 text-center shrink-0 min-w-[170px] shadow-xl">
                <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Ahorro mensual</span>
                <span className="text-3xl md:text-4xl font-black text-emerald-400 block font-mono">
                  -${winner.savings.toLocaleString('es-AR')}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  en tu compra de ${monthlySpend.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PODIO DE LAS 7 CADENAS DE SUPERMERCADOS */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span>📊 Ranking de Supermercados</span>
              <span className="text-xs font-normal text-slate-400">(ordenado por mayor ahorro con tus tarjetas)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resultsByBrand.map((item, idx) => {
              const { brand, config, matchedPromo, alternateDayPromo, savings, hasMatch, topGeneralPromo } = item
              const isWinner = idx === 0 && savings > 0

              return (
                <div
                  key={brand}
                  className={`rounded-2xl border p-5 transition-all flex flex-col justify-between relative bg-gradient-to-b ${config.bgGradient} ${config.borderClass} ${
                    isWinner ? `${config.glowClass} ring-2 ring-emerald-500/60` : ''
                  }`}
                >
                  {/* Posición del Podio */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-black text-slate-200">
                        #{idx + 1}
                      </span>
                      <div>
                        <h3 className="font-black text-lg text-white leading-none">{brand}</h3>
                        <span className="text-[11px] text-slate-400">{config.tagline}</span>
                      </div>
                    </div>

                    {isWinner && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
                        MEJOR OPCIÓN
                      </span>
                    )}
                  </div>

                  {/* Estado según si tiene match */}
                  {matchedPromo ? (
                    <div className="space-y-3 my-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-400 font-mono">
                          -${savings.toLocaleString('es-AR')}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-black ${config.badgeBg}`}>
                          {matchedPromo.discountPct}% OFF
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed">
                        {matchedPromo.title}
                      </p>

                      <div className="pt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-900/80 text-slate-300 font-medium border border-slate-800">
                          {matchedPromo.validDays.join(', ')}
                        </span>
                        {matchedPromo.capAmount && (
                          <span className="px-2 py-0.5 rounded bg-slate-900/80 text-amber-300/90 font-medium border border-slate-800">
                            Tope: ${matchedPromo.capAmount.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : alternateDayPromo ? (
                    <div className="my-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5">
                      <span className="text-[11px] font-bold text-amber-400 block">
                        💡 Aplica en otros días:
                      </span>
                      <p className="text-xs text-slate-300 line-clamp-2">
                        {alternateDayPromo.title}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-400">
                          {alternateDayPromo.validDays.join(', ')}
                        </span>
                        <span className="text-xs font-black text-amber-400">
                          {alternateDayPromo.discountPct}% OFF
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="my-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400">
                      {topGeneralPromo ? (
                        <p>
                          Sin promo para tus tarjetas seleccionadas.{' '}
                          <span className="text-slate-300">
                            Con otras entidades hay hasta{' '}
                            <strong className="text-white">{topGeneralPromo.discountPct}% de reintegro</strong>.
                          </span>
                        </p>
                      ) : (
                        <p>No hay promociones bancarias masivas vigentes cargadas en este momento para {brand}.</p>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-800/60 pt-3 mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Promos activas: {item.totalPromosCount}</span>
                    <Link
                      href="/promos"
                      className="text-slate-300 hover:text-white font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>Ver todas</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* BLOQUE VIRAL Y DE ACCIÓN CON IDENTIDAD PROMOAR */}
        <div className="bg-gradient-to-tr from-[#142840] via-[#0A1428] to-[#1E3A5F] border border-[#26406F] rounded-3xl p-6 md:p-8 text-center space-y-6 shadow-xl">
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-xl md:text-2xl font-black text-white">
              Compartí tu cálculo o guardá tus tarjetas
            </h3>
            <p className="text-xs md:text-sm text-slate-300">
              Mandale este comparador a tu familia para planificar las compras o guardá tus tarjetas en PromoAR para ver descuentos diarios en farmacias, nafta y salidas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {/* Compartir por WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
            >
              <span>📲 Compartir en WhatsApp</span>
            </button>

            {/* Copiar enlace */}
            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#142840] hover:bg-[#1E3A5F] text-[#8AADD4] hover:text-white text-sm font-semibold border border-[#26406F] transition-all"
            >
              <span>{copiedShare ? '✓ Enlace copiado' : '🔗 Copiar enlace interactivo'}</span>
            </button>

            {/* Guardar en perfil */}
            <button
              onClick={handleSaveToProfile}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D94F2B] to-[#B8401F] hover:from-[#E8724F] hover:to-[#D94F2B] text-white font-bold text-sm shadow-lg shadow-[#D94F2B]/30 transition-all hover:scale-[1.02]"
            >
              <span>⭐ Guardar mis tarjetas en PromoAR →</span>
            </button>
          </div>
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
                <li><Link href="/terminos" className="hover:text-white transition-colors">Términos</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera. Verificá vigencia y condiciones antes de usar.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
