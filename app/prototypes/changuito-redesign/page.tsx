'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Minus,
  Trash2,
  Store,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Monitor,
  Trophy,
  RotateCcw,
  X,
  Copy,
  Check
} from 'lucide-react'

// --- Tipos para la demo interactiva ---
interface CartProduct {
  id: string
  name: string
  brand: string
  category: string
  imageUrl: string
  quantity: number
  marketQuantities?: { [market: string]: number }
  prices: {
    [market: string]: {
      listPrice: number
      promoLabel?: string
      promoType?: '2x1' | '3x2' | '2da70' | '4x3' | 'direct'
      discountPct?: number
      excludedFromBankPromo?: boolean
      available: boolean
    }
  }
}

interface BankPromo {
  id: string
  name: string
  entity: string
  discountPct: number
  capAmount: number // Tope en pesos
  stacking: 'ALWAYS' | 'NEVER' // Cuenta DNI acumula siempre, otras compiten con ofertas de góndola
  icon: string
  color: string
}

// Promos bancarias para simular
const BANK_OPTIONS: BankPromo[] = [
  {
    id: 'cuentadni',
    name: 'Cuenta DNI',
    entity: 'Banco Provincia',
    discountPct: 20,
    capAmount: 6000,
    stacking: 'ALWAYS',
    icon: '📱',
    color: 'from-emerald-600 to-teal-700'
  },
  {
    id: 'galicia_modo',
    name: 'Galicia con MODO',
    entity: 'Banco Galicia',
    discountPct: 20,
    capAmount: 8000,
    stacking: 'ALWAYS',
    icon: '⚡',
    color: 'from-orange-600 to-amber-700'
  },
  {
    id: 'santander_visa',
    name: 'Santander Visa',
    entity: 'Banco Santander',
    discountPct: 25,
    capAmount: 10000,
    stacking: 'NEVER', // En caja no acumula con 2x1
    icon: '🔴',
    color: 'from-red-600 to-rose-800'
  },
  {
    id: 'ninguna',
    name: 'Sin promo bancaria',
    entity: 'Efectivo / Débito',
    discountPct: 0,
    capAmount: 0,
    stacking: 'NEVER',
    icon: '💵',
    color: 'from-slate-600 to-slate-800'
  }
]

// Carrito de prueba con productos y marcas representativas
const INITIAL_CART: CartProduct[] = [
  {
    id: '1',
    name: 'Leche Entera Clásica 1L',
    brand: 'La Serenísima',
    category: 'Lácteos',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=60',
    quantity: 3,
    prices: {
      Coto: { listPrice: 1650, promoLabel: '3x2', promoType: '3x2', available: true },
      Carrefour: { listPrice: 1720, promoLabel: '2da 70%', promoType: '2da70', available: true },
      Dia: { listPrice: 1590, available: true },
      MasOnline: { listPrice: 1750, promoLabel: '15% OFF', discountPct: 15, available: true }
    }
  },
  {
    id: '2',
    name: 'Fideos Spaghetti 500g',
    brand: 'Matarazzo',
    category: 'Almacén',
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=120&auto=format&fit=crop&q=60',
    quantity: 4,
    prices: {
      Coto: { listPrice: 1450, promoLabel: '2x1', promoType: '2x1', available: true },
      Carrefour: { listPrice: 1520, promoLabel: '2da 70%', promoType: '2da70', available: true },
      Dia: { listPrice: 1390, promoLabel: '4x3', promoType: '4x3', available: true },
      MasOnline: { listPrice: 1550, available: true }
    }
  },
  {
    id: '3',
    name: 'Coca-Cola Sabor Original 2.25L',
    brand: 'Coca-Cola',
    category: 'Bebidas',
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=120&auto=format&fit=crop&q=60',
    quantity: 2,
    prices: {
      Coto: { listPrice: 3800, excludedFromBankPromo: true, available: true },
      Carrefour: { listPrice: 3950, excludedFromBankPromo: true, available: true },
      Dia: { listPrice: 3750, excludedFromBankPromo: true, available: true },
      MasOnline: { listPrice: 4100, excludedFromBankPromo: true, available: true }
    }
  },
  {
    id: '4',
    name: 'Aceite de Girasol Puro 1.5L',
    brand: 'Cocinero',
    category: 'Almacén',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=120&auto=format&fit=crop&q=60',
    quantity: 2,
    prices: {
      Coto: { listPrice: 3400, available: true },
      Carrefour: { listPrice: 3300, available: true },
      Dia: { listPrice: 3250, available: true },
      MasOnline: { listPrice: 3500, promoLabel: '20% OFF', discountPct: 20, available: true }
    }
  },
  {
    id: '5',
    name: 'Jabón Líquido para Ropa 3L',
    brand: 'Skip',
    category: 'Limpieza',
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=120&auto=format&fit=crop&q=60',
    quantity: 1,
    prices: {
      Coto: { listPrice: 14200, promoLabel: '2da 70%', promoType: '2da70', available: true },
      Carrefour: { listPrice: 13900, promoLabel: '25% OFF', discountPct: 25, available: true },
      Dia: { listPrice: 14800, available: false }, // Simula sin stock
      MasOnline: { listPrice: 14500, promoLabel: '20% OFF', discountPct: 20, available: true }
    }
  }
]

const MARKETS = ['Coto', 'Carrefour', 'Dia', 'MasOnline'] as const
type MarketName = typeof MARKETS[number]

const MARKET_INFO: Record<MarketName, { name: string; color: string; dot: string; logoText: string; storeUrl: string; searchUrl: (q: string) => string }> = {
  Coto: {
    name: 'Coto Digital',
    color: 'border-red-500/40 text-red-600',
    dot: 'bg-red-500',
    logoText: 'COTO',
    storeUrl: 'https://www.cotodigital3.com.ar',
    searchUrl: (q: string) => `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=${encodeURIComponent(q)}`
  },
  Carrefour: {
    name: 'Carrefour Online',
    color: 'border-blue-500/40 text-blue-600',
    dot: 'bg-blue-500',
    logoText: 'CARREFOUR',
    storeUrl: 'https://www.carrefour.com.ar',
    searchUrl: (q: string) => `https://www.carrefour.com.ar/${encodeURIComponent(q)}?_q=${encodeURIComponent(q)}&map=ft`
  },
  Dia: {
    name: 'Día Online',
    color: 'border-rose-500/40 text-rose-600',
    dot: 'bg-rose-500',
    logoText: 'DÍA',
    storeUrl: 'https://diaonline.supermercadosdia.com.ar',
    searchUrl: (q: string) => `https://diaonline.supermercadosdia.com.ar/${encodeURIComponent(q)}?_q=${encodeURIComponent(q)}&map=ft`
  },
  MasOnline: {
    name: 'Más Online (Jumbo/Disco)',
    color: 'border-amber-500/40 text-amber-600',
    dot: 'bg-amber-500',
    logoText: 'MÁS ONLINE',
    storeUrl: 'https://www.masonline.com.ar',
    searchUrl: (q: string) => `https://www.masonline.com.ar/${encodeURIComponent(q)}?_q=${encodeURIComponent(q)}&map=ft`
  }
}

export default function ChanguitoRedesignPrototype() {
  const [cart, setCart] = useState<CartProduct[]>(INITIAL_CART)
  const [selectedBank, setSelectedBank] = useState<BankPromo>(BANK_OPTIONS[0])
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop')
  const [activeMobileMarket, setActiveMobileMarket] = useState<MarketName>('Coto')
  const [showExclusionsExplainer, setShowExclusionsExplainer] = useState(false)
  const [promoDetailModal, setPromoDetailModal] = useState<{
    item: CartProduct
    market: MarketName
    calc: NonNullable<ReturnType<typeof calculateItemPrice>>
  } | null>(null)
  const [buyAssistantMarket, setBuyAssistantMarket] = useState<MarketName | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [copiedList, setCopiedList] = useState(false)

  // Modificar cantidad base general (afecta a toda la fila para supers no independizados)
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const newQ = Math.max(1, item.quantity + delta)
            return { ...item, quantity: newQ }
          }
          return item
        })
        .filter(item => item.quantity > 0)
    )
  }

  // Modificar cantidad INDIVIDUAL para un supermercado específico dentro de la fila
  const updateMarketQuantity = (id: string, market: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const current = item.marketQuantities?.[market] ?? item.quantity
        const next = Math.max(1, current + delta)
        return {
          ...item,
          marketQuantities: {
            ...item.marketQuantities,
            [market]: next
          }
        }
      })
    )
  }

  // Re-vincular un supermercado a la cantidad base general
  const resetMarketQuantity = (id: string, market: string) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id !== id || !item.marketQuantities) return item
        const { [market]: _removed, ...rest } = item.marketQuantities
        return { ...item, marketQuantities: Object.keys(rest).length > 0 ? rest : undefined }
      })
    )
  }

  // Eliminar producto
  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  // Cálculo por producto en cada supermercado (respetando cantidad individual o base)
  const calculateItemPrice = (item: CartProduct, market: MarketName) => {
    const p = item.prices[market]
    if (!p || !p.available) return null

    const qty = item.marketQuantities?.[market] ?? item.quantity
    const isOverridden = item.marketQuantities?.[market] !== undefined
    let totalGondola = p.listPrice * qty
    let promoSavings = 0

    let promoActive = false
    let unitsNeeded = 0

    if (p.promoType === '2x1') {
      promoActive = qty >= 2
      if (!promoActive) unitsNeeded = 2 - qty
      const freeUnits = Math.floor(qty / 2)
      promoSavings = freeUnits * p.listPrice
      totalGondola -= promoSavings
    } else if (p.promoType === '3x2') {
      promoActive = qty >= 3
      if (!promoActive) unitsNeeded = 3 - qty
      const freeUnits = Math.floor(qty / 3)
      promoSavings = freeUnits * p.listPrice
      totalGondola -= promoSavings
    } else if (p.promoType === '4x3') {
      promoActive = qty >= 4
      if (!promoActive) unitsNeeded = 4 - qty
      const freeUnits = Math.floor(qty / 4)
      promoSavings = freeUnits * p.listPrice
      totalGondola -= promoSavings
    } else if (p.promoType === '2da70') {
      promoActive = qty >= 2
      if (!promoActive) unitsNeeded = 2 - qty
      const pairs = Math.floor(qty / 2)
      promoSavings = pairs * (p.listPrice * 0.7)
      totalGondola -= promoSavings
    } else if (p.discountPct) {
      promoActive = true
      promoSavings = (p.listPrice * qty) * (p.discountPct / 100)
      totalGondola -= promoSavings
    }

    return {
      listPriceUnit: p.listPrice,
      listPriceTotal: p.listPrice * qty,
      effectiveUnit: totalGondola / qty,
      totalGondola,
      promoSavings,
      promoLabel: p.promoLabel,
      excludedFromBank: !!p.excludedFromBankPromo,
      qty,
      isOverridden,
      promoActive,
      unitsNeeded
    }
  }

  // Resumen completo por supermercado
  const marketTotals = useMemo(() => {
    const results: Record<
      MarketName,
      {
        totalList: number
        totalGondola: number
        gondolaSavings: number
        bankSavings: number
        capped: boolean
        finalTotal: number
        missingCount: number
        isComplete: boolean
      }
    > = {} as any

    for (const market of MARKETS) {
      let totalList = 0
      let totalGondola = 0
      let eligibleForBank = 0
      let missingCount = 0

      for (const item of cart) {
        const calc = calculateItemPrice(item, market)
        if (!calc) {
          missingCount++
          continue
        }
        totalList += calc.listPriceTotal
        totalGondola += calc.totalGondola
        if (!calc.excludedFromBank) {
          eligibleForBank += calc.totalGondola
        }
      }

      const gondolaSavings = totalList - totalGondola

      // Cálculo del descuento bancario con aplicación estricta de tope
      let bankSavings = 0
      let capped = false

      if (selectedBank.discountPct > 0 && eligibleForBank > 0) {
        const potentialBankSavings = eligibleForBank * (selectedBank.discountPct / 100)
        if (selectedBank.capAmount > 0 && potentialBankSavings >= selectedBank.capAmount) {
          bankSavings = selectedBank.capAmount
          capped = true
        } else {
          bankSavings = potentialBankSavings
        }
      }

      const finalTotal = totalGondola - bankSavings

      results[market] = {
        totalList,
        totalGondola,
        gondolaSavings,
        bankSavings,
        capped,
        finalTotal,
        missingCount,
        isComplete: missingCount === 0
      }
    }

    return results
  }, [cart, selectedBank])

  // Identificar supermercado ganador (más barato y con canasta completa)
  const sortedMarkets = useMemo(() => {
    return [...MARKETS].sort((a, b) => {
      // Priorizar canastas completas
      if (marketTotals[a].isComplete && !marketTotals[b].isComplete) return -1
      if (!marketTotals[a].isComplete && marketTotals[b].isComplete) return 1
      return marketTotals[a].finalTotal - marketTotals[b].finalTotal
    })
  }, [marketTotals])

  const winnerMarket = sortedMarkets[0]
  const winnerData = marketTotals[winnerMarket]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ── 1. NAVBAR OFICIAL PROMOAR ── */}
      <header className="sticky top-0 z-50 bg-[#1E3A5F]/95 dark:bg-[#0A1428]/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src="/promoar_logo_transparent.png"
                alt="PromoAR"
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <span className="font-black text-xl text-white tracking-tight hidden sm:inline-block">PromoAR</span>
            </Link>

            <span className="hidden md:inline-block text-xs text-blue-200/60 font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              Supermercados
            </span>
          </div>

          {/* Links de navegación PromoAR */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-blue-100/80">
            <Link href="/promos/explorar" className="hover:text-white transition-colors">
              Promos
            </Link>
            <Link href="/ahorro-interactivo" className="text-white flex items-center gap-1.5 font-black">
              <span>Comparadores</span>
              <span className="text-[10px] bg-[#D94F2B] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                Nuevo
              </span>
            </Link>
            <Link href="/finanzas" className="hover:text-white transition-colors">
              Tasas
            </Link>
            <Link href="/comunidad" className="hover:text-white transition-colors">
              Comunidad
            </Link>
          </nav>

          {/* Switcher de evaluación Web / Mobile */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
              <button
                onClick={() => setDeviceView('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  deviceView === 'desktop'
                    ? 'bg-[#D94F2B] text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">Web</span>
              </button>
              <button
                onClick={() => setDeviceView('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  deviceView === 'mobile'
                    ? 'bg-[#D94F2B] text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone size={14} />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>

            <Link
              href="/perfil"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white transition-colors"
              title="Mi Perfil Financiero"
            >
              👤
            </Link>
          </div>
        </div>
      </header>

      {/* ── Sub-header de rubros de ahorro ── */}
      <div className="bg-[#162D4A] border-b border-white/5 py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-blue-200/60 uppercase tracking-widest text-[10px] hidden sm:inline">Simuladores:</span>
            <Link
              href="/ahorro-interactivo"
              className="px-2.5 py-1 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
            >
              ⚡ Hub
            </Link>
            <span className="px-2.5 py-1 rounded-lg bg-[#D94F2B] text-white font-extrabold shadow-xs">
              🛒 Supermercados
            </span>
            <Link
              href="/ahorro-interactivo/combustible"
              className="px-2.5 py-1 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
            >
              ⛽ Nafta & Combustibles
            </Link>
            <Link
              href="/ahorro-interactivo/farmacias"
              className="px-2.5 py-1 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
            >
              💊 Farmacias
            </Link>
          </div>
          <Link href="/precios/super" className="text-[#D94F2B] hover:underline font-black text-xs shrink-0 flex items-center gap-1">
            <span>Ir a catálogo en vivo</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="flex-1 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Banner de contexto de la evaluación */}
          <div className="bg-gradient-to-r from-[#1E3A5F]/60 via-slate-900 to-slate-900 border border-blue-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
                <span>Changuito Inteligente</span>
                <span>•</span>
                <span>Cálculo Neto de Ahorro</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>🛒 Simulador de Ahorro en Supermercados</span>
              </h1>
              <p className="text-xs text-blue-200/80">
                Seleccioná tu medio de pago y mirá el podio en tiempo real. Aplica ofertas del súper, reintegros bancarios y topes legales automáticamente.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">Modo de prueba:</span>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 uppercase">
                {deviceView === 'desktop' ? 'Vista Web' : 'Vista Mobile'}
              </span>
            </div>
          </div>

        {deviceView === 'desktop' ? (
          <div className="space-y-6">
            {/* ── Selector de Tarjeta / Billetera ── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                    1. ¿Con qué medio de pago querés simular?
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Se aplican topes y exclusiones legales automáticamente
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {BANK_OPTIONS.map(bank => {
                  const isSelected = selectedBank.id === bank.id
                  return (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBank(bank)}
                      className={`relative p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">{bank.icon}</span>
                        {isSelected && (
                          <span className="text-[10px] font-black uppercase bg-blue-500 text-white px-1.5 py-0.5 rounded">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm text-white">{bank.name}</p>
                      <p className="text-[11px] text-slate-400">{bank.entity}</p>
                      {bank.discountPct > 0 ? (
                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                          <span className="font-black text-emerald-400">{bank.discountPct}% ahorro</span>
                          <span className="text-[11px] text-slate-400">Tope: ${bank.capAmount.toLocaleString('es-AR')}</span>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                          Solo promociones de góndola
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                MÓDULO: PODIO DE SUPERMERCADOS (El Veredicto Limpio)
               ══════════════════════════════════════════════════════════════════ */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>🏆 Podio: ¿Dónde te conviene comprar?</span>
                </h2>
                <button
                  onClick={() => setShowExclusionsExplainer(!showExclusionsExplainer)}
                  className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                >
                  <Info size={13} />
                  <span>¿Cómo se calculan los topes y exclusiones?</span>
                </button>
              </div>

              {showExclusionsExplainer && (
                <div className="mb-4 p-4 rounded-xl bg-blue-950/40 border border-blue-800/50 text-xs text-blue-200 leading-relaxed animate-in fade-in duration-200">
                  <p className="font-bold mb-1 text-white">Reglas aplicadas al centavo en este comparador:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li>
                      <strong className="text-white">Tope de reintegro:</strong> Si tu 20% supera los ${selectedBank.capAmount.toLocaleString('es-AR')}, el descuento se corta estrictamente en el tope legal de la entidad.
                    </li>
                    <li>
                      <strong className="text-white">Productos con marcas excluidas:</strong> Gaseosas de primera línea (Coca-Cola), carnes frescas y electrodomésticos no reciben descuento bancario por bases legales de las cadenas. El sistema los separa del subtotal elegible.
                    </li>
                    <li>
                      <strong className="text-white">Acumulación:</strong> Con billeteras como Cuenta DNI o MODO se acumula el reintegro posterior sobre las ofertas de góndola (2x1, 3x2, etc.).
                    </li>
                  </ul>
                </div>
              )}

              {/* Tarjetas del Podio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sortedMarkets.map((market, index) => {
                  const data = marketTotals[market]
                  const isWinner = market === winnerMarket
                  const diffFromWinner = data.finalTotal - winnerData.finalTotal
                  const info = MARKET_INFO[market]

                  return (
                    <div
                      key={market}
                      className={`rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                        isWinner
                          ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/60 shadow-xl shadow-emerald-950/30 ring-2 ring-emerald-500/20'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Badge de Ganador */}
                      {isWinner && (
                        <div className="absolute -top-3 left-4 bg-emerald-500 text-slate-950 font-black text-[11px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                          <span>🥇 Opción más barata</span>
                        </div>
                      )}

                      <div>
                        {/* Header del súper */}
                        <div className="flex items-center justify-between mb-3 mt-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${info.dot}`} />
                            <span className="font-black text-base text-white">{info.name}</span>
                          </div>
                          {!data.isComplete && (
                            <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                              Falta 1 producto
                            </span>
                          )}
                        </div>

                        {/* Precio Final Destacado */}
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-black ${isWinner ? 'text-emerald-400' : 'text-white'}`}>
                              ${Math.round(data.finalTotal).toLocaleString('es-AR')}
                            </span>
                            {!isWinner && diffFromWinner > 0 && (
                              <span className="text-xs font-bold text-rose-400">
                                (+${Math.round(diffFromWinner).toLocaleString('es-AR')})
                              </span>
                            )}
                          </div>
                          {data.totalList > data.finalTotal && (
                            <p className="text-xs text-slate-500 line-through">
                              Precio lista: ${Math.round(data.totalList).toLocaleString('es-AR')}
                            </p>
                          )}
                        </div>

                        {/* Desglose Matemático Limpio */}
                        <div className="space-y-1.5 py-3 border-y border-slate-800 text-xs">
                          <div className="flex justify-between text-slate-400">
                            <span>Total de góndola:</span>
                            <span className="text-slate-200">${Math.round(data.totalGondola).toLocaleString('es-AR')}</span>
                          </div>

                          {data.gondolaSavings > 0 && (
                            <div className="flex justify-between text-emerald-400 font-medium">
                              <span>Ofertas de góndola:</span>
                              <span>-${Math.round(data.gondolaSavings).toLocaleString('es-AR')}</span>
                            </div>
                          )}

                          {data.bankSavings > 0 ? (
                            <div className="flex justify-between text-amber-400 font-bold">
                              <span className="truncate pr-1">
                                {selectedBank.name} {data.capped ? '(Tope máx)' : `(${selectedBank.discountPct}%)`}:
                              </span>
                              <span>-${Math.round(data.bankSavings).toLocaleString('es-AR')}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-slate-500">
                              <span>Beneficio bancario:</span>
                              <span>$0</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botón de acción directo */}
                      <div className="mt-4 pt-2">
                        <button
                          onClick={() => setBuyAssistantMarket(market)}
                          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            isWinner
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <span>Ir a comprar en {market}</span>
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── VISTA WEB (Tabla Horizontal Despejada) ── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-white text-base flex items-center gap-2">
                    <span>Detalle de productos en tu changuito</span>
                    <span className="text-xs font-normal text-slate-400">({cart.length} productos)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Precios finales por unidad calculando promociones por cantidad aplicables.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase text-slate-400 font-black">
                      <th className="p-4 min-w-[260px]">Producto</th>
                      <th className="p-4 text-center min-w-[120px]">
                        <div className="flex flex-col items-center">
                          <span>Cant. Base</span>
                          <span className="text-[10px] font-normal text-slate-400 normal-case">(aplica a todos)</span>
                        </div>
                      </th>
                      {MARKETS.map(market => (
                        <th
                          key={market}
                          className={`p-4 text-center min-w-[170px] ${
                            market === winnerMarket ? 'text-emerald-400 bg-emerald-950/10' : 'text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${MARKET_INFO[market].dot}`} />
                            <span>{market}</span>
                            {market === winnerMarket && (
                              <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1 rounded">
                                ★
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="p-4 text-center w-12" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/60">
                    {cart.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Producto */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 rounded-xl object-cover bg-slate-800 shrink-0 border border-slate-700"
                            />
                            <div>
                              <p className="font-bold text-white text-sm leading-tight">{item.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] text-slate-400">{item.brand}</span>
                                <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                  {item.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Control de Cantidad Base (General) */}
                        <td className="p-4 text-center">
                          <div className="inline-flex items-center justify-center bg-slate-800 border border-slate-700 rounded-xl p-1 gap-1.5 mx-auto">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300"
                              title="Restar 1 en base para todos"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="font-black text-sm w-4 text-center text-white">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300"
                              title="Sumar 1 en base para todos"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <span className="block text-[9px] text-slate-500 mt-1">General</span>
                        </td>

                        {/* Precios y Cantidad Individual por Supermercado */}
                        {MARKETS.map(market => {
                          const calc = calculateItemPrice(item, market)
                          const isWinner = market === winnerMarket

                          if (!calc) {
                            return (
                              <td key={market} className="p-4 text-center">
                                <span className="text-[11px] text-slate-500 bg-slate-800/40 px-2.5 py-1.5 rounded-xl border border-slate-800">
                                  Sin stock
                                </span>
                              </td>
                            )
                          }

                          return (
                            <td
                              key={market}
                              className={`p-4 text-center ${isWinner ? 'bg-emerald-950/10' : ''}`}
                            >
                              {calc.listPriceUnit > calc.effectiveUnit && (
                                <p className="text-[10px] text-slate-500 line-through">
                                  ${Math.round(calc.listPriceTotal).toLocaleString('es-AR')} (${Math.round(calc.listPriceUnit).toLocaleString('es-AR')} c/u)
                                </p>
                              )}
                              <p className={`font-black text-base ${isWinner ? 'text-emerald-400' : 'text-white'}`}>
                                ${Math.round(calc.totalGondola).toLocaleString('es-AR')}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                (${Math.round(calc.effectiveUnit).toLocaleString('es-AR')} c/u)
                              </p>

                              {/* Promo de Góndola Clickeable */}
                              {calc.promoLabel && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => setPromoDetailModal({ item, market, calc })}
                                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                      calc.promoActive
                                        ? 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/40 text-orange-400 ring-1 ring-orange-500/20'
                                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
                                    }`}
                                    title="Hacé clic para ver el desglose de esta promo"
                                  >
                                    <span>🔥 {calc.promoLabel}</span>
                                    {!calc.promoActive && calc.unitsNeeded > 0 && <span>(+{calc.unitsNeeded})</span>}
                                    <Info size={11} className="opacity-70" />
                                  </button>
                                </div>
                              )}

                              {/* Control Individual de Cantidad por Supermercado */}
                              <div className="mt-2.5 flex items-center justify-center">
                                <div
                                  className={`inline-flex items-center rounded-lg p-0.5 border gap-1 transition-all ${
                                    calc.isOverridden
                                      ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/20'
                                      : 'bg-slate-800/80 border-slate-700/60 text-slate-400'
                                  }`}
                                >
                                  <button
                                    onClick={() => updateMarketQuantity(item.id, market, -1)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors"
                                    title={`Restar 1 en ${market}`}
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span
                                    className={`text-xs font-black w-4 text-center ${
                                      calc.isOverridden ? 'text-blue-300 font-extrabold' : 'text-white'
                                    }`}
                                    title={calc.isOverridden ? `Cantidad exclusiva para ${market} (Base: ${item.quantity})` : `Cantidad sincronizada (${item.quantity})`}
                                  >
                                    {calc.qty}
                                  </span>
                                  <button
                                    onClick={() => updateMarketQuantity(item.id, market, 1)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors"
                                    title={`Sumar 1 en ${market}`}
                                  >
                                    <Plus size={10} />
                                  </button>
                                  {calc.isOverridden && (
                                    <button
                                      onClick={() => resetMarketQuantity(item.id, market)}
                                      title={`Volver a cantidad base (${item.quantity})`}
                                      className="w-5 h-5 flex items-center justify-center text-blue-400 hover:text-blue-200 hover:bg-blue-500/20 rounded ml-0.5 transition-colors"
                                    >
                                      <RotateCcw size={10} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {calc.excludedFromBank && (
                                <div className="mt-1" title="Marca excluida de reintegros bancarios según bases legales">
                                  <span className="inline-block text-[9px] text-slate-500 bg-slate-800/60 border border-slate-700/50 px-1.5 py-0.5 rounded">
                                    🚫 Sin reintegro
                                  </span>
                                </div>
                              )}
                            </td>
                          )
                        })}

                        {/* Eliminar producto */}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar del changuito"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ── VISTA MOBILE (Simulador Smartphone 390px Completo) ── */
          <div className="flex flex-col items-center justify-center py-2 animate-in fade-in duration-300">
            {/* Helper informativo para desktop */}
            <div className="mb-4 inline-flex items-center gap-2 bg-slate-900/90 border border-blue-500/30 text-blue-200 text-xs px-4 py-2 rounded-full shadow-lg">
              <Smartphone size={15} className="text-[#D94F2B]" />
              <span className="font-bold">Simulador Mobile Activo (iPhone 390 x 844 px)</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400 font-bold">100% Interactivo</span>
            </div>

            {/* Marco de Smartphone (iPhone Frame) */}
            <div className="w-[390px] max-w-full bg-slate-950 rounded-[48px] border-[10px] border-slate-800/90 shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative ring-1 ring-white/10">
              {/* Dynamic Island / Barra de Estado Superior */}
              <div className="bg-black pt-3 pb-2 px-6 flex items-center justify-between z-30 select-none">
                <span className="text-[11px] font-bold text-white tracking-tight">9:41</span>
                <div className="w-24 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-black mr-3" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white">
                  <span>5G</span>
                  <div className="w-4 h-2 border border-white/70 rounded-xs p-0.5 flex items-center">
                    <div className="w-full h-full bg-white rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* Header In-App Mobile */}
              <div className="bg-[#1E3A5F] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/promoar_logo_transparent.png" alt="PromoAR" className="h-6 w-auto object-contain" />
                  <div>
                    <p className="text-xs font-black text-white leading-none">PromoAR</p>
                    <p className="text-[10px] text-blue-200 leading-none mt-0.5">Súper & Changuito</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black bg-[#D94F2B] text-white px-2.5 py-0.5 rounded-full shadow-xs">
                    {cart.length} productos
                  </span>
                </div>
              </div>

              {/* Área con Scroll Interno del Smartphone */}
              <div className="p-4 space-y-4 max-h-[640px] overflow-y-auto">
                {/* 1. Selector de Medios de Pago en Chips Horizontales */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                      <CreditCard size={13} className="text-amber-400" />
                      <span>1. Tu Medio de Pago</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Deslizá 👉</span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {BANK_OPTIONS.map(bank => {
                      const isSelected = selectedBank.id === bank.id
                      return (
                        <button
                          key={bank.id}
                          onClick={() => setSelectedBank(bank)}
                          className={`shrink-0 px-3 py-2 rounded-xl text-left border transition-all flex items-center gap-2.5 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-lg">{bank.icon}</span>
                          <div>
                            <p className="text-xs font-bold leading-tight">{bank.name}</p>
                            <p className={`text-[10px] leading-tight ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {bank.discountPct > 0 ? `${bank.discountPct}% (tope $${Math.round(bank.capAmount / 1000)}k)` : 'Sin reintegro'}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Podio Mobile: Tabs de Selección Rápida */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                      <Trophy size={13} className="text-amber-400" />
                      <span>2. Podio de Supermercados</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">🥇 {winnerMarket}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                    {sortedMarkets.map(market => {
                      const isActive = activeMobileMarket === market
                      const data = marketTotals[market]
                      const isWin = market === winnerMarket

                      return (
                        <button
                          key={market}
                          onClick={() => setActiveMobileMarket(market)}
                          className={`py-2 px-1 rounded-lg text-center transition-all ${
                            isActive
                              ? 'bg-slate-800 text-white font-black shadow border border-slate-700'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <p className="text-[10px] truncate leading-tight">{isWin ? '🥇 ' : ''}{market}</p>
                          <p className={`text-xs font-black mt-0.5 ${isWin ? 'text-emerald-400' : 'text-slate-200'}`}>
                            ${Math.round(data.finalTotal / 1000)}k
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Tarjeta Resumen del Súper Activo */}
                {(() => {
                  const data = marketTotals[activeMobileMarket]
                  const isWin = activeMobileMarket === winnerMarket
                  const diff = data.finalTotal - winnerData.finalTotal
                  const info = MARKET_INFO[activeMobileMarket]

                  return (
                    <div className={`p-4 rounded-2xl border transition-all ${
                      isWin
                        ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/50 shadow-lg'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${info.dot}`} />
                          <div>
                            <p className="text-sm font-black text-white">{info.name}</p>
                            <p className="text-[10px] text-slate-400">Total a pagar estimado</p>
                          </div>
                        </div>
                        {isWin ? (
                          <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            🥇 Más barato
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            +${Math.round(diff).toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>

                      <div className="mb-3">
                        <span className={`text-2xl font-black ${isWin ? 'text-emerald-400' : 'text-white'}`}>
                          ${Math.round(data.finalTotal).toLocaleString('es-AR')}
                        </span>
                      </div>

                      {/* Desglose Matemático Limpio */}
                      <div className="space-y-1.5 pt-2.5 border-t border-slate-800 text-[11px]">
                        <div className="flex justify-between text-slate-400">
                          <span>Subtotal góndola:</span>
                          <span className="text-slate-200">${Math.round(data.totalGondola).toLocaleString('es-AR')}</span>
                        </div>
                        {data.gondolaSavings > 0 && (
                          <div className="flex justify-between text-emerald-400 font-semibold">
                            <span>Ofertas de góndola:</span>
                            <span>-${Math.round(data.gondolaSavings).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                        {data.bankSavings > 0 ? (
                          <div className="flex justify-between text-amber-400 font-bold">
                            <span>{selectedBank.name} {data.capped ? '(Tope máx)' : ''}:</span>
                            <span>-${Math.round(data.bankSavings).toLocaleString('es-AR')}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-slate-500">
                            <span>Reintegro bancario:</span>
                            <span>$0</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setBuyAssistantMarket(activeMobileMarket)}
                        className={`w-full mt-3.5 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                          isWin
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                            : 'bg-slate-800 hover:bg-slate-700 text-white'
                        }`}
                      >
                        <span>Ir a comprar en {info.name}</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  )
                })()}

                {/* 4. Lista Vertical de Productos con Steppers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-slate-300">
                      3. Productos en {activeMobileMarket} ({cart.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {cart.map(item => {
                      const calc = calculateItemPrice(item, activeMobileMarket)

                      return (
                        <div key={item.id} className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between gap-2.5">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {calc?.promoLabel && (
                                <button
                                  onClick={() => calc && setPromoDetailModal({ item, market: activeMobileMarket, calc })}
                                  className={`inline-flex items-center gap-1 text-[9px] font-black border px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer ${
                                    calc.promoActive
                                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}
                                  title="Ver desglose de la promo"
                                >
                                  <span>🔥 {calc.promoLabel}</span>
                                  <Info size={10} className="opacity-70" />
                                </button>
                              )}
                              {calc?.excludedFromBank && (
                                <span className="text-[9px] text-slate-500">🚫 Sin reintegro</span>
                              )}
                            </div>
                          </div>

                          {/* Control de cantidad en mobile para este súper */}
                          <div
                            className={`flex items-center rounded-lg border px-1 py-0.5 gap-1 shrink-0 transition-all ${
                              calc?.isOverridden
                                ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/20'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            <button
                              onClick={() => updateMarketQuantity(item.id, activeMobileMarket, -1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                              title={`Restar 1 en ${activeMobileMarket}`}
                            >
                              <Minus size={11} />
                            </button>
                            <span
                              className={`text-xs font-black w-3.5 text-center ${
                                calc?.isOverridden ? 'text-blue-300 font-extrabold' : 'text-white'
                              }`}
                              title={calc?.isOverridden ? `Cantidad exclusiva en ${activeMobileMarket}` : `Cantidad base`}
                            >
                              {calc?.qty ?? item.quantity}
                            </span>
                            <button
                              onClick={() => updateMarketQuantity(item.id, activeMobileMarket, 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                              title={`Sumar 1 en ${activeMobileMarket}`}
                            >
                              <Plus size={11} />
                            </button>
                            {calc?.isOverridden && (
                              <button
                                onClick={() => resetMarketQuantity(item.id, activeMobileMarket)}
                                title={`Volver a cantidad base (${item.quantity})`}
                                className="w-4 h-4 flex items-center justify-center text-blue-400 hover:text-blue-200 ml-0.5 transition-colors"
                              >
                                <RotateCcw size={9} />
                              </button>
                            )}
                          </div>

                          <div className="text-right shrink-0 min-w-[55px]">
                            {calc ? (
                              <>
                                {calc.listPriceUnit > calc.effectiveUnit && (
                                  <p className="text-[9px] text-slate-500 line-through leading-none mb-0.5">
                                    ${Math.round(calc.listPriceUnit).toLocaleString('es-AR')} u.
                                  </p>
                                )}
                                <p className="text-xs font-black text-white leading-tight">
                                  ${Math.round(calc.totalGondola).toLocaleString('es-AR')}
                                </p>
                                <p className={`text-[9px] font-bold leading-none mt-0.5 ${calc.listPriceUnit > calc.effectiveUnit ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  ${Math.round(calc.effectiveUnit).toLocaleString('es-AR')} u.
                                </p>
                              </>
                            ) : (
                              <span className="text-[9px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                Sin stock
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile Bottom Navigation Bar Inside Smartphone Frame */}
              <div className="bg-[#1E3A5F] border-t border-white/10 px-3 py-2 flex justify-around items-center text-[9px] font-bold text-blue-200 mt-auto select-none">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">🔥</span>
                  <span>Promos</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-[#D94F2B] font-black">
                  <span className="text-sm">🛒</span>
                  <span>Ahorro</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">📈</span>
                  <span>Tasas</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">👤</span>
                  <span>Perfil</span>
                </div>
              </div>

              {/* Barra de inicio (Home Bar de iPhone) */}
              <div className="bg-black py-1.5 flex justify-center select-none">
                <div className="w-28 h-1 bg-white/40 rounded-full" />
              </div>
            </div>
          </div>
        )}

        </div>
      </main>

      {/* ── FOOTER OFICIAL PROMOAR ── */}
      <footer className="bg-[#1E3A5F] border-t border-white/10 text-white py-12 px-4 mt-auto">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/promoar_logo_transparent.png" alt="PromoAR" className="h-8 w-auto object-contain" />
              <p className="font-black text-lg">PromoAR</p>
            </div>
            <p className="text-xs text-blue-200 leading-relaxed">
              El agregador de beneficios y comparador de ahorro inteligente más completo de Argentina.
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <a
                href="https://www.instagram.com/promoar.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                title="Instagram"
              >
                📷
              </a>
              <a
                href="https://x.com/promoarok"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                title="X (Twitter)"
              >
                𝕏
              </a>
              <a
                href="https://wa.me/541173691613"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                title="WhatsApp"
              >
                💬
              </a>
            </div>
          </div>

          <div>
            <p className="font-bold text-xs uppercase tracking-widest text-blue-300 mb-3">Simuladores</p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li>
                <Link href="/ahorro-interactivo" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>⚡ Hub de Ahorro</span>
                  <span className="text-[9px] bg-[#D94F2B] text-white font-black px-1.5 py-0.2 rounded-full">Nuevo</span>
                </Link>
              </li>
              <li><Link href="/precios/super" className="hover:text-white transition-colors">🛒 Supermercados</Link></li>
              <li><Link href="/ahorro-interactivo/combustible" className="hover:text-white transition-colors">⛽ Combustibles</Link></li>
              <li><Link href="/ahorro-interactivo/farmacias" className="hover:text-white transition-colors">💊 Farmacias</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-xs uppercase tracking-widest text-blue-300 mb-3">Plataforma</p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li><Link href="/promos/explorar" className="hover:text-white transition-colors">Catálogo de Promos</Link></li>
              <li><Link href="/finanzas" className="hover:text-white transition-colors">Tasas y FCI</Link></li>
              <li><Link href="/perfil" className="hover:text-white transition-colors">Mi Perfil Financiero</Link></li>
              <li><Link href="/comunidad" className="hover:text-white transition-colors">Comunidad PromoAR</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-xs uppercase tracking-widest text-blue-300 mb-3">Institucional</p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li><Link href="/quienes-somos" className="hover:text-white transition-colors">Quiénes somos</Link></li>
              <li><Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link></li>
              <li><Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-white transition-colors">Términos y condiciones</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-white/10 text-center text-xs text-blue-300/80">
          © {new Date().getFullYear()} PromoAR. Todos los derechos reservados. Las promociones y topes son verificados diariamente con cada entidad emisora.
        </div>
      </footer>

      {/* ── BOTTOM NAV MOBILE (Fijo abajo en celulares) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#1E3A5F]/95 backdrop-blur-xl border-t border-white/10 z-40 px-3 py-2 flex justify-around items-center text-[10px] font-bold text-blue-200">
        <Link href="/promos/explorar" className="flex flex-col items-center gap-0.5 hover:text-white">
          <span className="text-base">🔥</span>
          <span>Promos</span>
        </Link>
        <Link href="/ahorro-interactivo" className="flex flex-col items-center gap-0.5 text-[#D94F2B] font-black">
          <span className="text-base">🛒</span>
          <span>Ahorro</span>
        </Link>
        <Link href="/finanzas" className="flex flex-col items-center gap-0.5 hover:text-white">
          <span className="text-base">📈</span>
          <span>Tasas</span>
        </Link>
        <Link href="/comunidad" className="flex flex-col items-center gap-0.5 hover:text-white">
          <span className="text-base">👥</span>
          <span>Comunidad</span>
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-0.5 hover:text-white">
          <span className="text-base">👤</span>
          <span>Perfil</span>
        </Link>
      </nav>

      {/* ── MODAL POPUP: DETALLE Y DESGLOSE DE PROMOCIÓN ── */}
      {promoDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPromoDetailModal(null)}
          />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={promoDetailModal.item.imageUrl}
                  alt={promoDetailModal.item.name}
                  className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${MARKET_INFO[promoDetailModal.market].dot}`} />
                    <span className="text-xs font-bold text-slate-400">{MARKET_INFO[promoDetailModal.market].name}</span>
                  </div>
                  <h3 className="font-black text-sm text-white leading-tight">
                    {promoDetailModal.item.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPromoDetailModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del Desglose */}
            <div className="py-4 space-y-4">
              {/* Badge de la promo */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase text-orange-400 flex items-center gap-1.5">
                    <span>🔥 {promoDetailModal.calc.promoLabel}</span>
                    {promoDetailModal.calc.promoActive ? (
                      <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                        Activa
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded">
                        Faltan {promoDetailModal.calc.unitsNeeded} un.
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {promoDetailModal.calc.promoActive
                      ? `Aplicada sobre las ${promoDetailModal.calc.qty} unidades en tu changuito.`
                      : `Agregá ${promoDetailModal.calc.unitsNeeded} unidad más para activar el descuento.`}
                  </p>
                </div>
                <span className="text-2xl font-black text-orange-400">
                  {promoDetailModal.calc.promoActive && promoDetailModal.calc.promoSavings > 0
                    ? `-${Math.round((promoDetailModal.calc.promoSavings / promoDetailModal.calc.listPriceTotal) * 100)}%`
                    : '0%'}
                </span>
              </div>

              {/* Comparativa: Regular vs Con Descuento */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Precio de lista regular:</span>
                  <span className="font-bold text-slate-300">
                    ${Math.round(promoDetailModal.calc.listPriceUnit).toLocaleString('es-AR')} c/u
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Subtotal sin promo ({promoDetailModal.calc.qty} un.):</span>
                  <span className="text-slate-300">
                    ${Math.round(promoDetailModal.calc.listPriceTotal).toLocaleString('es-AR')}
                  </span>
                </div>
                {promoDetailModal.calc.promoSavings > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 font-bold">
                    <span>Bonificación de góndola:</span>
                    <span>-${Math.round(promoDetailModal.calc.promoSavings).toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <div>
                    <span className="font-black text-white text-sm">Total final góndola:</span>
                    <p className="text-[10px] text-slate-400">
                      Te queda a <strong className="text-emerald-400 font-black">${Math.round(promoDetailModal.calc.effectiveUnit).toLocaleString('es-AR')}</strong> cada una
                    </p>
                  </div>
                  <span className="font-black text-lg text-emerald-400">
                    ${Math.round(promoDetailModal.calc.totalGondola).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* Impacto con Medio de Pago Seleccionado */}
              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{selectedBank.icon}</span>
                  <strong className="text-white">{selectedBank.name} ({selectedBank.discountPct}% reintegro):</strong>
                </div>
                {promoDetailModal.calc.excludedFromBank ? (
                  <p className="text-[11px] text-amber-300/90 mt-0.5">
                    ⚠️ Este producto tiene marca excluida del reintegro bancario según bases legales, por lo que pagarás el total de góndola.
                  </p>
                ) : selectedBank.discountPct > 0 ? (
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    ¡Acumula! Sobre los ${Math.round(promoDetailModal.calc.totalGondola).toLocaleString('es-AR')} de góndola, recibís un reintegro posterior de{' '}
                    <strong className="text-emerald-300">
                      ${Math.round(promoDetailModal.calc.totalGondola * (selectedBank.discountPct / 100)).toLocaleString('es-AR')}
                    </strong>{' '}
                    (sujeto al tope de ${selectedBank.capAmount.toLocaleString('es-AR')}).
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No tenés reintegro bancario configurado para este cálculo.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setPromoDetailModal(null)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ASISTENTE DE COMPRA ORGANIZADA ── */}
      {buyAssistantMarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setBuyAssistantMarket(null)}
          />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl z-10 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full ${MARKET_INFO[buyAssistantMarket].dot}`} />
                  <h3 className="font-black text-lg text-white">
                    Comprar en {MARKET_INFO[buyAssistantMarket].name}
                  </h3>
                  {buyAssistantMarket === winnerMarket && (
                    <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      🥇 Más barato
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Total estimado:{' '}
                  <strong className="text-emerald-400 text-sm font-black">
                    ${Math.round(marketTotals[buyAssistantMarket].finalTotal).toLocaleString('es-AR')}
                  </strong>
                  {' '}(con {selectedBank.name})
                </p>
              </div>
              <button
                onClick={() => setBuyAssistantMarket(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Acciones Rápidas */}
            <div className="py-3 flex flex-col sm:flex-row gap-2 shrink-0 border-b border-slate-800/80">
              <a
                href={MARKET_INFO[buyAssistantMarket].storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <span>Abrir tienda oficial de {MARKET_INFO[buyAssistantMarket].name}</span>
                <ExternalLink size={13} />
              </a>
              <button
                onClick={() => {
                  const lines = [
                    `🛒 Mi changuito en ${MARKET_INFO[buyAssistantMarket].name} (PromoAR)`,
                    `Total estimado: $${Math.round(marketTotals[buyAssistantMarket].finalTotal).toLocaleString('es-AR')} (con ${selectedBank.name})`,
                    '',
                    ...cart
                      .filter(item => item.prices[buyAssistantMarket]?.available)
                      .map(item => {
                        const calc = calculateItemPrice(item, buyAssistantMarket)
                        const promoText = calc?.promoActive ? ` (${calc.promoLabel})` : ''
                        return `• ${calc?.qty ?? item.quantity}x ${item.name}${promoText} — $${Math.round(calc?.totalGondola ?? 0).toLocaleString('es-AR')}`
                      })
                  ].join('\n')
                  navigator.clipboard.writeText(lines)
                  setCopiedList(true)
                  setTimeout(() => setCopiedList(false), 2500)
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700 shrink-0"
                title="Copiar lista de productos al portapapeles"
              >
                {copiedList ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-slate-300" />
                    <span>Copiar lista</span>
                  </>
                )}
              </button>
            </div>

            {/* Lista checklist de productos */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Checklist de productos ({cart.filter(i => i.prices[buyAssistantMarket]?.available).length} disponibles):</span>
                <span>Marcá los que vas agregando 👇</span>
              </div>

              {cart.map(item => {
                const p = item.prices[buyAssistantMarket]
                if (!p || !p.available) return null
                const calc = calculateItemPrice(item, buyAssistantMarket)
                const isChecked = checkedItems[item.id] || false

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => setCheckedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                            : 'border-slate-700 hover:border-slate-500 text-transparent'
                        }`}
                        title={isChecked ? 'Desmarcar' : 'Marcar como agregado'}
                      >
                        <Check size={14} className={isChecked ? 'stroke-[3]' : ''} />
                      </button>

                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-800 shrink-0 border border-slate-700"
                      />

                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold text-white truncate ${isChecked ? 'line-through text-slate-400' : ''}`}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]">
                          <span className="font-extrabold text-blue-300 bg-blue-950/60 border border-blue-800/40 px-1.5 py-0.2 rounded">
                            Llevar {calc?.qty} un.
                          </span>
                          {calc?.promoLabel && (
                            <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/30 px-1.5 py-0.2 rounded">
                              🔥 {calc.promoLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs font-black text-white">
                        ${Math.round(calc?.totalGondola ?? 0).toLocaleString('es-AR')}
                      </p>
                      <a
                        href={MARKET_INFO[buyAssistantMarket].searchUrl(item.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-200 underline flex items-center gap-0.5"
                      >
                        <span>Buscar</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                {Object.values(checkedItems).filter(Boolean).length} de {cart.filter(i => i.prices[buyAssistantMarket]?.available).length} listos
              </span>
              <button
                onClick={() => setBuyAssistantMarket(null)}
                className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
