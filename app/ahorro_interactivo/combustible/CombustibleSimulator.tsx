'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type FuelBrand = 'YPF' | 'Axion' | 'Shell' | 'Puma'

export interface CombustibleRequirement {
  bankName: string | null
  bankSlug: string | null
  walletName: string | null
  walletSlug: string | null
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

interface Props {
  initialPromos: CombustiblePromoItem[]
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

// Entidades populares para la botonera rápida de selección
const POPULAR_PAYMENT_METHODS = [
  { id: 'galicia', label: 'Galicia', type: 'bank', color: '#E35205' },
  { id: 'santander', label: 'Santander', type: 'bank', color: '#EC0000' },
  { id: 'bna', label: 'Banco Nación', type: 'bank', color: '#004B87' },
  { id: 'bbva', label: 'BBVA', type: 'bank', color: '#004481' },
  { id: 'macro', label: 'Banco Macro', type: 'bank', color: '#002D72' },
  { id: 'ciudad', label: 'Banco Ciudad', type: 'bank', color: '#0072CE' },
  { id: 'credicoop', label: 'Credicoop', type: 'bank', color: '#006633' },
  { id: 'cuenta-dni', label: 'Cuenta DNI', type: 'wallet', color: '#00A650' },
  { id: 'modo', label: 'MODO', type: 'wallet', color: '#00CC99' },
  { id: 'personal-pay', label: 'Personal Pay', type: 'wallet', color: '#5A2D82' },
  { id: 'app-ypf', label: 'App YPF', type: 'wallet', color: '#0057B8' },
  { id: 'shell-box', label: 'Shell Box', type: 'wallet', color: '#FBCE07' },
  { id: 'uala', label: 'Ualá', type: 'wallet', color: '#E53E3E' },
]

const SPEND_PRESETS = [40000, 80000, 120000, 160000, 200000]

// Estilos de marca oficiales para las 4 petroleras
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
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,87,184,0.35)]',
    borderClass: 'border-blue-500/40 hover:border-blue-400',
    bgGradient: 'from-blue-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-blue-600 text-white',
  },
  Axion: {
    name: 'Axion Energy',
    color: '#E30613',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(227,6,19,0.3)]',
    borderClass: 'border-purple-500/40 hover:border-purple-400',
    bgGradient: 'from-purple-950/40 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-purple-600 text-white',
  },
  Shell: {
    name: 'Shell',
    color: '#FBCE07',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(251,206,7,0.25)]',
    borderClass: 'border-amber-500/40 hover:border-amber-400',
    bgGradient: 'from-amber-950/30 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-amber-400 text-slate-950 font-bold',
  },
  Puma: {
    name: 'Puma Energy',
    color: '#00843D',
    glowClass: 'shadow-[0_0_25px_-5px_rgba(0,132,61,0.3)]',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
    bgGradient: 'from-emerald-950/30 via-slate-900/60 to-slate-950/80',
    badgeBg: 'bg-emerald-600 text-white',
  },
}

export default function CombustibleSimulator({ initialPromos }: Props) {
  const router = useRouter()
  
  // Estado de medios de pago seleccionados
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['galicia', 'cuenta-dni', 'modo'])
  // Estado de día seleccionado ('all', 'today', '2', '4', etc.)
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [monthlySpend, setMonthlySpend] = useState<number>(80000)
  const [copiedShare, setCopiedShare] = useState(false)

  const todayInfo = useMemo(() => getTodayInfo(), [])

  // Restaurar medios de pago guardados del usuario (guestProfile o query params)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Check query params first (para links compartidos)
    const urlParams = new URLSearchParams(window.location.search)
    const cardsParam = urlParams.get('cards')
    const spendParam = urlParams.get('gasto')
    const dayParam = urlParams.get('dia')

    if (dayParam) {
      setSelectedDay(dayParam)
    }

    if (cardsParam) {
      const fromUrl = cardsParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      if (fromUrl.length > 0) {
        setSelectedMethods(fromUrl)
        if (spendParam) {
          const s = parseInt(spendParam, 10)
          if (!isNaN(s) && s > 0) setMonthlySpend(s)
        }
        return
      }
    }

    // 2. Check localStorage guestProfile
    try {
      const raw = localStorage.getItem('guestProfile')
      if (raw) {
        const parsed = JSON.parse(raw)
        const banks: string[] = parsed.banks || []
        const wallets: string[] = parsed.wallets || []
        const combined = [...banks, ...wallets].map(s => s.toLowerCase())
        if (combined.length > 0) {
          setSelectedMethods(combined)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Toggle de medio de pago
  const toggleMethod = (id: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(id)) {
        return prev.filter(m => m !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const selectAll = () => {
    setSelectedMethods(POPULAR_PAYMENT_METHODS.map(m => m.id))
  }

  const clearAll = () => {
    setSelectedMethods([])
  }

function matchesMethod(methodId: string, slug: string | null, name: string | null): boolean {
  if (!slug && !name) return false
  const s = (slug || '').toLowerCase()
  const n = (name || '').toLowerCase()
  const m = methodId.toLowerCase()

  // Clubes de beneficios o suscripción (Club La Nación, Clarín 365) son programas aparte, NUNCA bancos
  const isBenefitsClub =
    s.includes('club-la-nacion') ||
    s.includes('clarin-365') ||
    n.includes('club la nacion') ||
    n.includes('club la nación') ||
    n.includes('clarín 365') ||
    n.includes('clarin 365')

  if (m === 'bna') {
    if (isBenefitsClub) return false
    return (
      s === 'bna' ||
      s === 'banco-nacion' ||
      s.includes('banco-nacion') ||
      n.includes('banco naci') ||
      n.includes('banco de la naci')
    )
  }
  if (m === 'galicia') return !isBenefitsClub && (s.includes('galicia') || n.includes('galicia'))
  if (m === 'santander') return !isBenefitsClub && (s.includes('santander') || n.includes('santander'))
  if (m === 'bbva') return !isBenefitsClub && (s.includes('bbva') || n.includes('bbva'))
  if (m === 'macro') return !isBenefitsClub && (s.includes('macro') || n.includes('macro'))
  if (m === 'ciudad') return !isBenefitsClub && (s.includes('ciudad') || n.includes('ciudad'))
  if (m === 'credicoop') return !isBenefitsClub && (s.includes('credicoop') || n.includes('credicoop'))
  if (m === 'cuenta-dni') return s.includes('cuenta-dni') || s.includes('cuentadni') || n.includes('cuenta dni')
  if (m === 'modo') return s.includes('modo') || n.includes('modo')
  if (m === 'personal-pay') return s.includes('personal-pay') || s.includes('personalpay') || n.includes('personal pay')
  if (m === 'app-ypf') return s.includes('app-ypf') || n.includes('app ypf') || (s === 'ypf' && n.includes('app'))
  if (m === 'shell-box') return s.includes('shell-box') || n.includes('shell box')
  if (m === 'uala') return s.includes('uala') || n.includes('ualá')

  if (isBenefitsClub) return false

  return s.includes(m) || m.includes(s) || n.includes(m)
}

function getUniqueBadges(reqs: CombustibleRequirement[]) {
  const map = new Map<string, { name: string; type: 'bank' | 'wallet' }>()
  for (const r of reqs) {
    if (r.bankName) {
      map.set(`bank-${r.bankSlug || r.bankName}`, { name: r.bankName, type: 'bank' })
    }
    if (r.walletName) {
      map.set(`wallet-${r.walletSlug || r.walletName}`, { name: r.walletName, type: 'wallet' })
    }
  }
  return Array.from(map.values())
}

  // Helper para chequear si una promo matchea con los medios seleccionados
  const promoMatchesEntities = (p: CombustiblePromoItem): boolean => {
    if (selectedMethods.length === 0) return false
    if (p.requirements.length === 0) return true

    // Matchea si AL MENOS UN requerimiento es cumplido por las tarjetas del usuario
    return p.requirements.some(r => {
      const hasBankReq = !!r.bankSlug
      const hasWalletReq = !!r.walletSlug

      const userHasBank = hasBankReq && selectedMethods.some(m => matchesMethod(m, r.bankSlug, r.bankName))
      const userHasWallet = hasWalletReq && selectedMethods.some(m => matchesMethod(m, r.walletSlug, r.walletName))

      // Si el requerimiento exige banco Y billetera (ej. Banco Nación + MODO):
      if (hasBankReq && hasWalletReq) {
        return userHasBank && userHasWallet
      }
      if (hasBankReq) return userHasBank
      if (hasWalletReq) return userHasWallet

      return true
    })
  }

  // Helper para chequear si una promo aplica al día seleccionado
  const promoMatchesDay = (p: CombustiblePromoItem): boolean => {
    if (selectedDay === 'all') return true
    const targetBit = selectedDay === 'today' ? todayInfo.bit : parseInt(selectedDay, 10)
    if (isNaN(targetBit)) return true
    if (p.validDaysBitmask >= 127) return true
    return (p.validDaysBitmask & targetBit) !== 0
  }

  // Cálculo de resultados por marca (YPF, Axion, Shell, Puma)
  const resultsByBrand = useMemo(() => {
    const brands: FuelBrand[] = ['YPF', 'Axion', 'Shell', 'Puma']

    return brands.map(brand => {
      // Filtrar promos de esta marca
      const brandPromos = initialPromos.filter(p => p.brand === brand)
      
      // Promos que matchean con las tarjetas del usuario (independiente del día)
      const cardMatchedPromos = brandPromos.filter(promoMatchesEntities)

      // Promos que matchean con tarjetas Y con el día seleccionado
      const matchedPromos = cardMatchedPromos.filter(promoMatchesDay)

      // Si hay promos que matchean, calculamos la mejor
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

      // Mejor promo de otro día de la semana con las tarjetas del usuario (para sugerirle cuándo ir)
      const alternateDayPromo = !bestPromo && cardMatchedPromos.length > 0
        ? [...cardMatchedPromos].sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))[0]
        : null

      // Mejor promo general de la marca (por si no tiene match con ninguna tarjeta)
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
    ? `${window.location.origin}/ahorro_interactivo/combustible?cards=${selectedMethods.join(',')}&gasto=${monthlySpend}&dia=${selectedDay}`
    : `https://promoar.com.ar/ahorro_interactivo/combustible`

  const dayLabelForShare = selectedDay === 'today'
    ? `para cargar hoy ${todayInfo.name}`
    : selectedDay === 'all'
    ? 'para toda la semana'
    : `para los días ${DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label}`

  const shareText = winner
    ? `Hice el cálculo en PromoAR (${dayLabelForShare}): con mis tarjetas me conviene cargar nafta en ${winner.brand} y ahorro hasta $${winner.savings.toLocaleString('es-AR')} este mes. Mirá con tus tarjetas acá:`
    : `Calculá con qué tarjeta te conviene cargar nafta ${dayLabelForShare} en YPF, Axion, Shell o Puma en PromoAR:`

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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D94F2B]/15 border border-[#D94F2B]/30 text-[#E8724F] text-xs font-bold mb-4 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#D94F2B] animate-pulse" />
          SIMULADOR INTELIGENTE DE COMBUSTIBLE
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
          ¿Con qué tarjeta te conviene <br className="hidden md:inline" />
          <span className="bg-gradient-to-r from-[#8AADD4] via-white to-[#E8724F] bg-clip-text text-transparent">
            cargar nafta este mes?
          </span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          Seleccioná tus bancos y billeteras. Calculamos en tiempo real tu mejor opción en{' '}
          <span className="text-slate-200 font-semibold">YPF, Axion, Shell y Puma</span> con los reintegros y topes de hoy.
        </p>
      </div>

      {/* PASO 1: Selector interactivo de tarjetas y billeteras */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 mb-8 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>💳 Paso 1:</span> Marcá las tarjetas y apps que tenés
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
                  isSelected
                    ? 'bg-[#142840] text-white border-2 border-[#D94F2B] shadow-[0_0_15px_-3px_rgba(217,79,43,0.4)] scale-[1.02]'
                    : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: method.color }}
                />
                <span>{method.label}</span>
                {isSelected && (
                  <span className="text-[#E8724F] font-bold ml-0.5">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* PASO 2: Selector de día de la semana */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 mb-8 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>📅 Paso 2:</span> ¿Qué día querés cargar nafta?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Las promociones bancarias de nafta son muy distintas según el día de la semana</p>
          </div>
          <div className="text-xs font-semibold text-[#8AADD4] bg-[#142840] px-3.5 py-1.5 rounded-full border border-[#26406F] self-start sm:self-auto">
            {selectedDay === 'all'
              ? '✨ Toda la semana (ver el mejor día)'
              : selectedDay === 'today'
              ? `⚡ Cargando Hoy (${todayInfo.name})`
              : `🗓️ Solo día ${DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {DAYS_OF_WEEK.map(day => {
            const isSelected = selectedDay === day.id
            const isToday = day.id === 'today'
            const isAll = day.id === 'all'

            return (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all select-none ${
                  isSelected
                    ? 'bg-[#142840] text-white border-2 border-[#D94F2B] shadow-[0_0_15px_-3px_rgba(217,79,43,0.4)] scale-[1.02]'
                    : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{isAll ? '✨' : isToday ? '⚡' : '🗓️'}</span>
                <span>{isToday ? `Hoy (${todayInfo.name})` : day.label}</span>
                {isSelected && (
                  <span className="text-[#E8724F] font-bold ml-0.5">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* PASO 3: Gasto mensual estimado en combustible */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 mb-10 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>⛽ Paso 3:</span> ¿Cuánto cargás de nafta al mes?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Para calcular con precisión cuánto te ahorrás en pesos ($)</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-white font-mono">
              ${monthlySpend.toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* Presets rápidos */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {SPEND_PRESETS.map(amount => (
            <button
              key={amount}
              onClick={() => setMonthlySpend(amount)}
              className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                monthlySpend === amount
                  ? 'bg-[#D94F2B] text-white shadow-md shadow-[#D94F2B]/30'
                  : 'bg-slate-950/50 text-slate-400 border border-slate-800/60 hover:text-white hover:border-slate-700'
              }`}
            >
              ${(amount / 1000).toFixed(0)}k
            </button>
          ))}
        </div>

        {/* Slider libre */}
        <input
          type="range"
          min={20000}
          max={300000}
          step={5000}
          value={monthlySpend}
          onChange={e => setMonthlySpend(parseInt(e.target.value, 10))}
          className="w-full accent-[#D94F2B] bg-slate-800 rounded-lg cursor-pointer h-2"
        />
        <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 font-mono">
          <span>$20.000 (1 tanque chico)</span>
          <span>$150.000</span>
          <span>$300.000 (2+ vehículos)</span>
        </div>
      </div>

      {/* BANNER DEL GANADOR DESTACADO */}
      {winner && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/40 p-6 mb-8 shadow-[0_0_30px_-10px_rgba(245,158,11,0.25)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs tracking-wider uppercase">
                <span>🏆 Tu Mejor Opción del Mes</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Puesto #1</span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white">
                Cargá en <span className="text-amber-300">{winner.brand}</span>
              </h3>
              <p className="text-sm text-slate-300">
                {winner.matchedPromo?.title || 'Mejor descuento aplicado'}
              </p>
            </div>
            <div className="sm:text-right bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/30">
              <div className="text-xs text-amber-300/80 font-medium">Ahorro estimado en tu mes</div>
              <div className="text-3xl font-black text-amber-400 font-mono">
                -${winner.savings.toLocaleString('es-AR')}
              </div>
              {winner.matchedPromo?.capAmount && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  (Tope de reintegro: ${winner.matchedPromo.capAmount.toLocaleString('es-AR')})
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PODIO DE LAS 4 ESTACIONES */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>🏁 Comparativa por Estación de Servicio</span>
          </h2>
          <span className="text-xs text-slate-400">
            {selectedMethods.length} medios seleccionados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resultsByBrand.map((item, idx) => {
            const {
              brand,
              config,
              matchedPromo,
              alternateDayPromo,
              savings,
              hasMatch,
              hasAlternateDayMatch,
              topGeneralPromo,
            } = item

            return (
              <div
                key={brand}
                className={`relative rounded-2xl p-5 border transition-all duration-200 bg-gradient-to-b ${config.bgGradient} ${config.borderClass} ${
                  hasMatch ? config.glowClass : 'opacity-70 grayscale-[30%]'
                }`}
              >
                {/* Header de la tarjeta con Logo/Nombre */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <h3 className="text-xl font-black text-white tracking-tight">
                        {config.name}
                      </h3>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${config.badgeBg}`}>
                        {hasMatch ? `${matchedPromo?.discountPct}% OFF` : 'Sin promo'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {hasMatch ? (
                        <span className="text-emerald-400 font-semibold">
                          ✓ Promo disponible con tus tarjetas
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Ninguno de tus medios aplica beneficio
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Caja de ahorro */}
                  {hasMatch ? (
                    <div className="text-right">
                      <div className="text-2xl font-black text-white font-mono">
                        -${savings.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[11px] text-slate-400">ahorro mensual</div>
                    </div>
                  ) : (
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-400">Tarifa plena</div>
                      <div className="text-[11px] text-slate-500">$0 ahorro</div>
                    </div>
                  )}
                </div>

                {/* Detalle de la promo si matchea */}
                {hasMatch && matchedPromo ? (
                  <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 font-medium">Beneficio:</span>
                      <span className="font-semibold text-white truncate max-w-[220px]">
                        {matchedPromo.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 font-medium">Días válidos:</span>
                      <span className="font-semibold text-[#8AADD4]">
                        {matchedPromo.validDays.join(', ')}
                      </span>
                    </div>

                    {matchedPromo.capAmount && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 font-medium">Tope mensual:</span>
                        <span className="font-mono text-slate-300">
                          ${matchedPromo.capAmount.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}

                    {matchedPromo.requirements.length > 0 && (
                      <div className="flex items-center justify-between text-slate-300 pt-1">
                        <span className="text-slate-500 font-medium">Medio de pago:</span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {getUniqueBadges(matchedPromo.requirements).map(b => (
                            <span
                              key={b.name}
                              className="px-2 py-0.5 rounded bg-[#142840] text-[10px] font-bold text-slate-200 border border-[#26406F]"
                            >
                              {b.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Sugerencia si no tiene promo hoy o con sus tarjetas
                  <div className="pt-3 border-t border-slate-800/60 text-xs space-y-2">
                    {hasAlternateDayMatch && alternateDayPromo ? (
                      <div className="bg-[#142840]/70 p-3 rounded-xl border border-[#26406F] space-y-1">
                        <div className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                          <span>🗓️ Día recomendado en {brand}:</span>
                        </div>
                        <p className="text-slate-200 leading-snug">
                          Con tus tarjetas tenés <strong className="text-emerald-400 font-bold">{alternateDayPromo.discountPct}% OFF</strong> los <span className="text-white font-bold underline decoration-[#D94F2B]">{alternateDayPromo.validDays.join(', ')}</span>.
                        </p>
                        <div className="text-[11px] text-slate-400 truncate">
                          {alternateDayPromo.title}
                        </div>
                      </div>
                    ) : topGeneralPromo ? (
                      <p className="text-slate-400">
                        💡 <strong className="text-slate-300">¿Sabías qué?</strong> Si tuvieras{' '}
                        <span className="text-amber-300 font-semibold">
                          {getUniqueBadges(topGeneralPromo.requirements).map(b => b.name).join(' + ') || 'otra tarjeta'}
                        </span>
                        , tendrías hasta <strong className="text-white">{topGeneralPromo.discountPct}% de reintegro</strong> en {brand}.
                      </p>
                    ) : (
                      <p className="text-slate-400">No hay promociones bancarias masivas vigentes cargadas en este momento para {brand}.</p>
                    )}
                  </div>
                )}
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
            Mandale este comparador a tu familia o guardá tus tarjetas en PromoAR para ver promociones de supermercados, farmacias y salidas en tu día a día.
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
