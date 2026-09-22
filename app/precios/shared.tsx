'use client'

import React, { useState, useEffect } from 'react'
import { Search, Loader2, Plus, Minus, Trash2, X, ArrowRight } from 'lucide-react'

export interface MultiUnitPromo {
  label: string
  effectivePrice: number
  requiredQty: number
}

export interface MarketProduct {
  id: string
  supermarket: string
  name: string
  price: number
  finalPrice: number
  discountText: string
  url: string
  multiUnitPromo?: MultiUnitPromo
  primePromo?: MultiUnitPromo
  jumboCheck?: number
  vtexCategoryId?: string
  vtexCategory?: string
  excludedFromBankPromos?: boolean
}

export function extractCategory(vtexCategory?: string): string {
  if (!vtexCategory) return ''
  const segs = vtexCategory.replace(/\/$/, '').split('/').filter(Boolean)
  // Devolver el segundo nivel si hay 3+, sino el primero
  return segs.length >= 2 ? segs[1] : segs[0] || ''
}

export interface GroupedProduct {
  ean: string
  name: string
  brand: string
  imageUrl: string
  minPrice: number
  maxPrice: number
  bestMarket: string
  availableIn: number
  excludedFromBankPromos?: boolean
  markets: Record<string, MarketProduct>
}

export interface CartRow {
  ean: string
  name: string
  imageUrl: string
  quantity: number
  // Override de cantidad por super (ej. simular "2do al 50%" comprando 2 solo en
  // Carrefour sin afectar la cantidad de los demás supers de la misma fila). Un super
  // sin entrada acá sigue la `quantity` global de la fila; con entrada, usa la propia.
  marketQuantities?: Record<string, number>
  vtexCategoryId?: string
  vtexCategory?: string
  searchQuery?: string  // búsqueda original para encontrar similares
  markets: Record<string, {
    name?: string
    price: number
    finalPrice: number
    effectivePrice: number
    promoLabel?: string
    promoQty?: number
    jumboCheck?: number
    excludedFromBankPromos?: boolean
    url: string
  }>
}

export interface Toast {
  id: number
  message: string
}

export interface BankPromoInfo {
  label: string
  discountValue: number
  discountType: string
  stacking: 'ALWAYS' | 'NEVER' | 'UNKNOWN'
  matchingEntityNames: string[]
  betterDay?: {
    dayLabel: string
    discountValue: number
    discountType: string
    label: string
  }
}

export interface StoreVerdict {
  market: string
  itemsCovered: number
  itemsTotal: number
  gondolaTotal: number
  listTotal: number
  bankDiscount: {
    label: string
    amount: number
    confidence: 'confirmed' | 'unconfirmed'
    appliedStrategy: 'stacked' | 'best_of_two' | 'none'
  } | null
  finalTotal: number
  isCompleteBasket: boolean
}

export const formatPrice = (p: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p)

// Cantidad efectiva de una fila del carrito para un super puntual: usa el override de
// `marketQuantities` si ese super fue independizado del +/- global, si no cae a `quantity`.
export const getRowQuantity = (row: CartRow, market: string): number => row.marketQuantities?.[market] ?? row.quantity

export const ALL_SUPERMARKETS_SUPER = ['Jumbo', 'Disco', 'Vea', 'Coto', 'Carrefour', 'Más Online', 'Dia', 'Changomas', 'The Food Market', 'Cordiez', 'Cooperativa Obrera', 'Toledo Digital', 'Depot Express']
export const NATIONAL_STORES_SUPER = ['Coto', 'Carrefour', 'Jumbo', 'Disco', 'Vea', 'Changomas', 'Más Online', 'Dia']
export const REGIONAL_STORES_SUPER = ['The Food Market', 'Cordiez', 'Cooperativa Obrera', 'Toledo Digital', 'Depot Express']
export const ALL_SUPERMARKETS_FARMA = ['Farmacity', 'Farmaplus', 'OpenFarma']
export const ALL_SUPERMARKETS_ELECTRO = ['Megatone', 'Frávega', 'Naldo', 'Coppel', 'Rodo', 'Easy', 'Carrefour', 'Coto', 'Jumbo', 'Disco', 'Vea', 'Más Online', 'Changomas', 'Dia']

export const STORE_LOGOS: Record<string, string> = {
  'Frávega': 'https://www.google.com/s2/favicons?domain=fravega.com&sz=64',
  'Naldo': 'https://www.google.com/s2/favicons?domain=naldo.com.ar&sz=64',
  'Coppel': 'https://www.google.com/s2/favicons?domain=coppel.com.ar&sz=64',
  'Rodo': 'https://www.google.com/s2/favicons?domain=rodo.com.ar&sz=64',
  'Easy': 'https://www.google.com/s2/favicons?domain=easy.com.ar&sz=64',
  'Megatone': 'https://www.google.com/s2/favicons?domain=megatone.net&sz=64',
  'Carrefour': 'https://www.google.com/s2/favicons?domain=carrefour.com.ar&sz=64',
  'Coto': 'https://www.google.com/s2/favicons?domain=cotodigital3.com.ar&sz=64',
  'Jumbo': 'https://www.google.com/s2/favicons?domain=jumbo.com.ar&sz=64',
  'Disco': 'https://www.google.com/s2/favicons?domain=disco.com.ar&sz=64',
  'Vea': 'https://www.google.com/s2/favicons?domain=vea.com.ar&sz=64',
  'Más Online': 'https://www.google.com/s2/favicons?domain=masonline.com.ar&sz=64',
  'Changomas': 'https://www.google.com/s2/favicons?domain=changomas.com.ar&sz=64',
  'Dia': 'https://www.google.com/s2/favicons?domain=supermercadosdia.com.ar&sz=64',
  'MercadoLibre': 'https://www.google.com/s2/favicons?domain=mercadolibre.com.ar&sz=64',
  'The Food Market': 'https://www.google.com/s2/favicons?domain=thefoodmarket.com.ar&sz=64',
  'Cordiez': 'https://www.google.com/s2/favicons?domain=cordiez.com.ar&sz=64',
  'Cooperativa Obrera': 'https://www.google.com/s2/favicons?domain=lacoopeencasa.coop&sz=64',
  'Toledo Digital': 'https://www.google.com/s2/favicons?domain=toledodigital.com.ar&sz=64',
  'Depot Express': 'https://www.google.com/s2/favicons?domain=depotexpress.com.ar&sz=64',
}

export const SUPERMARKET_COLORS: Record<string, string> = {
  'Coto': 'bg-red-500 text-white',
  'Carrefour': 'bg-blue-600 text-white',
  'Jumbo': 'bg-green-600 text-white',
  'Dia': 'bg-red-600 text-white',
  'Disco': 'bg-red-700 text-white',
  'Vea': 'bg-yellow-500 text-black',
  'Más Online': 'bg-blue-500 text-white',
  'Changomas': 'bg-orange-500 text-white',
  'Farmacity': 'bg-green-500 text-white',
  'Farmaplus': 'bg-teal-600 text-white',
  'OpenFarma': 'bg-purple-600 text-white',
  'Farmatodo': 'bg-red-500 text-white',
  'Central Oeste': 'bg-blue-700 text-white',
  'Megatone': 'bg-orange-600 text-white',
  'Frávega': 'bg-red-600 text-white',
  'Naldo': 'bg-blue-800 text-white',
  'Coppel': 'bg-yellow-600 text-white',
  'Rodo': 'bg-slate-700 text-white',
  'Easy': 'bg-yellow-400 text-black',
  'The Food Market': 'bg-emerald-700 text-white',
  'Cordiez': 'bg-red-800 text-white',
  'Cooperativa Obrera': 'bg-sky-700 text-white',
  'Toledo Digital': 'bg-violet-700 text-white',
  'Depot Express': 'bg-orange-700 text-white',
  'default': 'bg-gray-800 text-white'
}

export const SUPERMARKET_DOT: Record<string, string> = {
  'Coto': 'bg-red-500',
  'Carrefour': 'bg-blue-600',
  'Jumbo': 'bg-green-600',
  'Dia': 'bg-red-600',
  'Disco': 'bg-red-700',
  'Vea': 'bg-yellow-500',
  'Más Online': 'bg-blue-500',
  'Changomas': 'bg-orange-500',
  'Farmacity': 'bg-green-500',
  'Farmaplus': 'bg-teal-600',
  'OpenFarma': 'bg-purple-600',
  'Farmatodo': 'bg-red-500',
  'Central Oeste': 'bg-blue-700',
  'Megatone': 'bg-orange-600',
  'Frávega': 'bg-red-600',
  'Naldo': 'bg-blue-800',
  'Coppel': 'bg-yellow-600',
  'Rodo': 'bg-slate-600',
  'Easy': 'bg-yellow-400',
  'The Food Market': 'bg-emerald-700',
  'Cordiez': 'bg-red-800',
  'Cooperativa Obrera': 'bg-sky-700',
  'Toledo Digital': 'bg-violet-700',
  'Depot Express': 'bg-orange-700',
  'default': 'bg-gray-500'
}

export function getBestPromo(markets: Record<string, MarketProduct>, minRegularPrice: number): { market: string; promo: MultiUnitPromo; effectivePrice: number } | null {
  let best: { market: string; promo: MultiUnitPromo; effectivePrice: number } | null = null
  for (const [name, m] of Object.entries(markets)) {
    if (!m.multiUnitPromo) continue
    const effectivePrice = Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice)
    if (effectivePrice >= minRegularPrice) continue
    if (!best || effectivePrice < best.effectivePrice) {
      best = { market: name, promo: m.multiUnitPromo, effectivePrice }
    }
  }
  return best
}

// Precio unitario del mejor mercado (sin exigir la cantidad de la promo multi-unidad)
export function getUnitPrice(p: GroupedProduct): number {
  return p.minPrice
}

// Precio con la mejor promo activada (multi-unidad o no) — el que ya usa la tarjeta hoy
export function getPromoPrice(p: GroupedProduct): number {
  const best = getBestPromo(p.markets, p.minPrice)
  return best ? best.effectivePrice : p.minPrice
}

// Precio final "de góndola" de un producto: si hay promo multi-unidad activa, ese;
// si no, el mejor finalPrice regular entre mercados. Usado para el filtro de rango
// "desde/hasta" (final con descuento incluido) — siempre el mejor precio posible.
export function getFinalDiscountedPrice(p: GroupedProduct): number {
  const promo = getBestPromo(p.markets, p.minPrice)
  return promo ? promo.effectivePrice : p.minPrice
}

// Descuento efectivo de la promo completa (ej. 2x1=50%, 3x2=33%) tomando el mejor
// precio regular vs el mejor precio con promo entre todos los mercados.
export function getEffectiveDiscountPct(p: GroupedProduct): number {
  let regular = 0
  let withPromo = Infinity
  for (const m of Object.values(p.markets)) {
    if (m.price > regular) regular = m.price
    const eff = m.multiUnitPromo ? Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice) : m.finalPrice
    if (eff < withPromo) withPromo = eff
  }
  if (!regular || withPromo === Infinity || withPromo >= regular) return 0
  return ((regular - withPromo) / regular) * 100
}

export function getEffectiveDiscountAmount(p: GroupedProduct): number {
  let regular = 0
  let withPromo = Infinity
  for (const m of Object.values(p.markets)) {
    if (m.price > regular) regular = m.price
    const eff = m.multiUnitPromo ? Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice) : m.finalPrice
    if (eff < withPromo) withPromo = eff
  }
  if (!regular || withPromo === Infinity || withPromo >= regular) return 0
  return regular - withPromo
}

export function hasAnyPromo(p: GroupedProduct): boolean {
  return Object.values(p.markets).some(m => m.multiUnitPromo || (m.discountText && m.discountText !== '-'))
}

export type SuperSortKey = 'price_asc' | 'price_desc' | 'alpha_asc' | 'alpha_desc' | 'discount_pct' | 'discount_amount' | 'availability'

export function stripAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Última carpeta no vacía de vtexCategory (ej. "/Gaseosas/Cola/" → "Cola").
// Solo lo trae VTEX (Jumbo/Disco/Vea/Carrefour/Dia/...), Coto no.
export function lastCategorySegment(vtexCategory?: string): string | null {
  if (!vtexCategory) return null
  const segs = vtexCategory.replace(/^\/|\/$/g, '').split('/').filter(Boolean)
  return segs.length ? segs[segs.length - 1] : null
}

export function mostCommonVtexCategory(p: GroupedProduct): string | null {
  const segs = Object.values(p.markets).map(m => lastCategorySegment(m.vtexCategory)).filter(Boolean) as string[]
  if (!segs.length) return null
  const counts = new Map<string, number>()
  for (const s of segs) counts.set(s, (counts.get(s) || 0) + 1)
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

// Palabras genéricas que no aportan como filtro de variante (unidades, tamaños, marcas
// comunes de envase, conectores). Todo lo demás que se repita entre varios productos de
// un mismo resultado de búsqueda es candidato a chip de variante (ej. "Zero", "Entera").
const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'sabor', 'x', 'un', 'una',
  'lt', 'lts', 'l', 'ml', 'g', 'gr', 'kg', 'cc', 'un.', 'unid', 'unidad', 'unidades',
  'pack', 'pet', 'lata', 'botella', 'bot', 'tetra', 'caja', 'combo',
])

// Deriva "chips" de variante a partir de palabras que se repiten en varios nombres de
// producto dentro del mismo resultado de búsqueda — sin listas hardcodeadas por rubro.
// Une esta señal con la categoría VTEX (cuando existe) para cubrir también el caso en
// que la variante real es la categoría del comercio (ej. "Cola" vs "Otras Gaseosas").
export function getSubcategoriesForQuery(query: string, products: GroupedProduct[]): { label: string; count: number; type: 'vtex' | 'keyword' }[] {
  if (!query.trim() || products.length < 2) return []

  const queryWords = new Set(stripAccents(query).split(/\s+/).filter(Boolean))

  // 1) Categorías VTEX (la última carpeta de cada producto)
  const vtexCounts = new Map<string, number>()
  for (const p of products) {
    const cat = mostCommonVtexCategory(p)
    if (cat) vtexCounts.set(cat, (vtexCounts.get(cat) || 0) + 1)
  }
  const vtexChips = Array.from(vtexCounts.entries())
    .filter(([, count]) => count >= 2 && count < products.length) // descarta si es 1 sola o todas iguales (no filtra nada)
    .map(([label, count]) => ({ label, count, type: 'vtex' as const }))

  // 2) Palabras clave repetidas en los nombres (variantes tipo Zero/Original/Entera)
  const wordCounts = new Map<string, number>()
  const wordDisplay = new Map<string, string>()
  for (const p of products) {
    const rawWords = p.name.split(/\s+/).filter(Boolean)
    const seenInThisProduct = new Set<string>()
    for (const raw of rawWords) {
      const clean = stripAccents(raw.replace(/[.,%()]/g, ''))
      if (!clean || clean.length < 3) continue
      if (STOPWORDS.has(clean)) continue
      if (queryWords.has(clean)) continue // no repetir la palabra ya buscada
      if (/^\d+([.,]\d+)?$/.test(clean)) continue // tamaños sueltos ("1", "2,25")
      if (seenInThisProduct.has(clean)) continue
      seenInThisProduct.add(clean)
      wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1)
      if (!wordDisplay.has(clean)) wordDisplay.set(clean, raw.replace(/[.,%()]/g, ''))
    }
  }
  const keywordChips = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2 && count < products.length)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // top 8 para no saturar la barra de chips
    .map(([word, count]) => ({ label: wordDisplay.get(word) || word, count, type: 'keyword' as const }))

  return [...vtexChips, ...keywordChips].sort((a, b) => b.count - a.count)
}

export function SimilarProductModal({ ean, market, catId, excludeEan, cartRow, onSelect, onClose }: {
  ean: string
  market: string
  catId: string
  excludeEan: string
  cartRow: CartRow
  onSelect: (market: string, item: { ean: string; name: string; price: number; imageUrl: string; url: string }) => void
  onClose: () => void
}) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')

  const doSearch = async (q: string) => {
    if (q.length < 3) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/precios/search?q=${encodeURIComponent(q)}&section=supermercados`)
      const data = await res.json()
      const filtered = (data.results || [])
        .filter((p: any) => p.markets?.[market] && p.ean !== excludeEan)
        .map((p: any) => ({
          ean: p.ean,
          name: p.name,
          brand: p.brand,
          price: p.markets[market].finalPrice,
          imageUrl: p.imageUrl,
          url: p.markets[market].url || '',
        }))
      setResults(filtered)
    } catch {}
    setLoading(false)
  }

  // No búsqueda automática al abrir — el usuario escribe lo que quiere

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const filtered = results

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Buscar similar en {market}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Reemplaza "{cartRow.name.slice(0, 40)}..."</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Ej: leche, jabón, galletitas..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Mostrando productos disponibles en {market}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : filtered.length === 0 && query.length >= 3 ? (
            <p className="text-center text-slate-500 py-10 text-sm">No hay "{query}" en {market} — probá con otro término</p>
          ) : query.length < 3 ? (
            <p className="text-center text-slate-500 py-10 text-sm">Escribí al menos 3 letras</p>
          ) : (
            filtered.map(item => (
              <button
                key={item.ean || item.itemId}
                onClick={() => onSelect(market, { ean: item.ean, name: item.name, price: item.price, imageUrl: item.imageUrl, url: '' })}
                className="w-full flex items-center gap-3 p-3 bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-indigo-500/30 rounded-xl transition-colors text-left"
              >
                <div className="w-12 h-12 bg-white rounded-lg p-1 shrink-0">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/48x48/eee/999?text=?' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-tight">{item.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{item.brand}</p>
                </div>
                <p className="text-sm font-black text-white shrink-0">{formatPrice(item.price)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Badge de ahorro bancario/billetera — reemplaza el texto de 9px por un bloque propio
// que "grita" el monto ahorrado, con popover de desglose por producto y aviso de
// "otro día tenés más %" (Alerta Inteligente de Oportunidad, ya calculada en el backend).
export function BankSavingsBadge({ market, bankPromo, bankDiscount, cart }: {
  market: string
  bankPromo: BankPromoInfo | null | undefined
  bankDiscount: StoreVerdict['bankDiscount']
  cart: CartRow[]
}) {
  const [open, setOpen] = useState(false)
  if (!bankPromo || !bankDiscount) return null

  // Solo los productos que realmente acumulan con la promo bancaria — un producto
  // marcado excludedFromBankPromos (ej. "No acumulable con otras promos bancarias"
  // en Coto) no entra en el desglose aunque esté en el carrito para ese súper.
  const coveredRows = cart.filter(row => !!row.markets[market] && !row.markets[market]?.excludedFromBankPromos)
  const pctLabel = bankPromo.discountType === 'CUOTAS_SIN_INTERES' ? `${bankPromo.discountValue} CSI` : `${bankPromo.discountValue}%`
  const isUnconfirmed = bankDiscount.confidence === 'unconfirmed'

  return (
    <div className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
          isUnconfirmed
            ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
            : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[13px] font-black leading-none ${isUnconfirmed ? 'text-amber-400' : 'text-emerald-400'}`}>
            -{formatPrice(bankDiscount.amount)}
          </span>
          <span className={`text-[9px] font-black uppercase rounded px-1 py-0.5 leading-none ${isUnconfirmed ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
            {pctLabel}
          </span>
        </div>
        <p className="text-[9px] text-slate-400 truncate mt-0.5">🏦 {bankPromo.label}</p>
        {bankDiscount.appliedStrategy === 'best_of_two' && (
          <p className="text-[8px] text-slate-500 leading-tight">no acumulable con promo de góndola</p>
        )}
        {isUnconfirmed && (
          <p className="text-[8px] text-amber-400/80 leading-tight">⚠️ no confirmado si acumula</p>
        )}
        {bankPromo.matchingEntityNames.length > 1 && (
          <p className="text-[8px] text-slate-500 leading-tight">toco para ver con qué bancos aplica</p>
        )}
      </button>

      {bankPromo.betterDay && (
        <p className="text-[8px] font-bold text-sky-400 mt-1 leading-tight">
          💡 {bankPromo.betterDay.dayLabel}: {bankPromo.betterDay.discountType === 'CUOTAS_SIN_INTERES' ? `${bankPromo.betterDay.discountValue} CSI` : `${bankPromo.betterDay.discountValue}%`} con {bankPromo.betterDay.label} (hoy {pctLabel})
        </p>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full left-0 mt-1 w-56 rounded-xl border border-white/10 bg-[#161616] shadow-2xl p-3">
            {bankPromo.matchingEntityNames.length > 1 && (
              <>
                <p className="text-[10px] font-black text-white uppercase tracking-wide mb-2">Aplica con estos bancos</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {bankPromo.matchingEntityNames.map(name => (
                    <span key={name} className="text-[9px] text-slate-300 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{name}</span>
                  ))}
                </div>
              </>
            )}
            <p className="text-[10px] font-black text-white uppercase tracking-wide mb-2">Aplica sobre estos productos</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {coveredRows.map(row => (
                <div key={row.ean} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-300 truncate">{row.name}</span>
                  <span className="text-slate-500 shrink-0">x{getRowQuantity(row, market)}</span>
                </div>
              ))}
              {!coveredRows.length && (
                <p className="text-[10px] text-slate-500">Sin productos de {market} en el carrito.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function MobileCart({ cart, allMarkets, cartTotals, lowestTotalMarket, storeVerdicts, winnerMarket, bankPromos, getEffectivePrice, updateQuantity, updateMarketQuantity, resetMarketQuantity, removeFromCart }: {
  cart: CartRow[]
  allMarkets: string[]
  cartTotals: Record<string, number>
  lowestTotalMarket: string
  storeVerdicts: Record<string, StoreVerdict>
  winnerMarket: string
  bankPromos: Record<string, BankPromoInfo | null>
  getEffectivePrice: (m: CartRow['markets'][string], qty: number) => number
  updateQuantity: (ean: string, delta: number) => void
  updateMarketQuantity: (ean: string, market: string, delta: number) => void
  resetMarketQuantity: (ean: string, market: string) => void
  removeFromCart: (ean: string) => void
}) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedTotals, setExpandedTotals] = useState(false)

  // Totales de precio de lista (sin descuentos)
  const listTotals = allMarkets.reduce((acc, market) => {
    acc[market] = cart.reduce((sum, row) => {
      const m = row.markets[market]
      return m ? sum + m.price * getRowQuantity(row, market) : sum
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const toggleProduct = (ean: string) => setExpandedProducts(prev => {
    const next = new Set(prev)
    next.has(ean) ? next.delete(ean) : next.add(ean)
    return next
  })

  const winnerVerdict = storeVerdicts[winnerMarket]

  return (
    <div className="md:hidden p-2 space-y-1.5">
      {/* Totales arriba */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
        <button className="w-full flex items-center justify-between px-3 py-2" onClick={() => setExpandedTotals(prev => !prev)}>
          <div>
            {winnerMarket ? (
              <>
                <p className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">🥇 Total más barato · {winnerMarket}</p>
                <p className="text-emerald-400 font-black text-base">{formatPrice(cartTotals[winnerMarket] || 0)}</p>
                <p className="text-[9px] text-emerald-700">
                  Ahorrás {formatPrice((listTotals[winnerMarket] || 0) - (cartTotals[winnerMarket] || 0))} vs precio de lista
                </p>
                {winnerVerdict?.bankDiscount && (
                  <p className={`text-[10px] font-black mt-0.5 ${winnerVerdict.bankDiscount.confidence === 'unconfirmed' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    🏦 -{formatPrice(winnerVerdict.bankDiscount.amount)} con {winnerVerdict.bankDiscount.label}
                    {winnerVerdict.bankDiscount.confidence === 'unconfirmed' && ' · ⚠️ no confirmado'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[9px] text-amber-400 uppercase tracking-wide font-bold">⚠️ Ningún súper cubre toda la lista</p>
            )}
          </div>
          <ArrowRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedTotals ? 'rotate-90' : ''}`} />
        </button>

        {expandedTotals && (
          <div className="border-t border-white/10">
            {allMarkets.map(market => {
              const verdict = storeVerdicts[market]
              const lista = listTotals[market] || 0
              const conDesc = cartTotals[market] || 0
              const ahorrado = lista - conDesc
              const isBest = market === winnerMarket
              const bp = bankPromos[market]
              return (
                <div key={market} className={`px-3 py-2 border-b border-white/5 ${isBest ? 'bg-emerald-500/5' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                      <p className={`text-[11px] font-bold ${isBest ? 'text-emerald-400' : 'text-slate-300'}`}>{market} {isBest && '★'}</p>
                    </div>
                    <p className={`text-sm font-black ${isBest ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(conDesc)}</p>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 pl-3">
                    <span>Lista: {formatPrice(lista)}</span>
                    {ahorrado > 0 && <span className="text-emerald-700">Ahorrás {formatPrice(ahorrado)}</span>}
                  </div>
                  <div className="pl-3">
                    <BankSavingsBadge market={market} bankPromo={bp} bankDiscount={verdict?.bankDiscount ?? null} cart={cart} />
                  </div>
                  {verdict && !verdict.isCompleteBasket && verdict.itemsTotal > 0 && (
                    <p className="text-[9px] font-bold text-amber-400 pl-3 mt-0.5">
                      ⚠️ Canasta incompleta (cotizados {verdict.itemsCovered}/{verdict.itemsTotal})
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Productos */}
      {cart.map(row => {
        const isExpanded = expandedProducts.has(row.ean)
        const bestPrice = Math.min(...allMarkets.filter(mk => row.markets[mk]).map(mk => getEffectivePrice(row.markets[mk], getRowQuantity(row, mk))))
        const bestMarketForRow = allMarkets.find(mk => row.markets[mk] && getEffectivePrice(row.markets[mk], getRowQuantity(row, mk)) === bestPrice) || ''
        const hasPromo = Object.values(row.markets).some(m => m.promoLabel)
        // Distintos súpers pueden resolver el ítem genérico con productos/marcas distintas
        // (ej. marca propia) — mostrar la sustitución explícita, decisión queda en el usuario.
        const hasSubstitution = Object.values(row.markets).some(m => m.name && m.name !== row.name)
        const canExpand = hasPromo || hasSubstitution

        return (
          <div key={row.ean} className="bg-[#1A1A1A] rounded-xl border border-white/10 overflow-hidden">
            {/* Fila compacta */}
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="w-8 h-8 bg-white rounded-lg p-0.5 shrink-0">
                <img src={row.imageUrl} alt={row.name} className="w-full h-full object-contain mix-blend-multiply" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-slate-200 line-clamp-1 leading-tight">{row.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SUPERMARKET_DOT[bestMarketForRow] || SUPERMARKET_DOT.default}`} />
                  <p className="text-emerald-400 font-black text-[11px]">{formatPrice(bestPrice)}</p>
                  {hasPromo && <span className="text-[9px] text-orange-400">🔥</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 rounded-lg px-1.5 py-1 border border-white/10 shrink-0">
                <button onClick={() => updateQuantity(row.ean, -1)} className="text-slate-400"><Minus className="w-3 h-3" /></button>
                <span className="text-[11px] font-medium w-3 text-center">{row.quantity}</span>
                <button onClick={() => updateQuantity(row.ean, 1)} className="text-slate-400"><Plus className="w-3 h-3" /></button>
              </div>
              <button onClick={() => removeFromCart(row.ean)} className="text-slate-600 hover:text-red-400 shrink-0 p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {canExpand && (
                <button onClick={() => toggleProduct(row.ean)} className="text-slate-500 shrink-0">
                  <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>

            {/* Detalle promos y sustitución por super (expandido) */}
            {isExpanded && (
              <div className="border-t border-white/10">
                {allMarkets.map(market => {
                  const m = row.markets[market]
                  const substituted = m?.name && m.name !== row.name
                  const isOverridden = row.marketQuantities?.[market] !== undefined
                  if (!m || (!m.promoLabel && !m.excludedFromBankPromos && !substituted && !isOverridden)) return null
                  const marketQty = getRowQuantity(row, market)
                  const promoActiva = m.promoQty ? marketQty >= m.promoQty : false
                  const faltanParaPromo = m.promoQty && !promoActiva ? m.promoQty - marketQty : 0
                  const precioUnit = getEffectivePrice(m, marketQty)
                  return (
                    <div key={market} className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                        <div>
                          <p className="text-[10px] font-bold text-slate-300">{market}</p>
                          {substituted && (
                            <p className="text-[9px] text-slate-400">🔁 {m.name}</p>
                          )}
                          {m.promoLabel && (
                            <p className={`text-[9px] font-bold ${promoActiva ? 'text-orange-400' : 'text-amber-500/60'}`}>
                              🔥 {m.promoLabel}{faltanParaPromo > 0 ? ` (agregá ${faltanParaPromo} más)` : ''}
                            </p>
                          )}
                          {m.excludedFromBankPromos && (
                            <p className="text-[9px] font-bold text-amber-400">⚠️ No acumulable con otras promos bancarias</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {m.price > precioUnit && <p className="text-[9px] text-slate-500 line-through">{formatPrice(m.price)}</p>}
                        <p className="text-[11px] font-bold text-white">{formatPrice(precioUnit)}</p>
                        <div className={`flex items-center justify-end gap-1 mt-0.5 rounded px-1 ${isOverridden ? 'bg-indigo-500/10 border border-indigo-500/30' : ''}`}>
                          <button onClick={() => updateMarketQuantity(row.ean, market, -1)} className="p-0.5 text-slate-500"><Minus className="w-2.5 h-2.5" /></button>
                          <span className={`text-[9px] w-3 text-center font-bold ${isOverridden ? 'text-indigo-400' : 'text-slate-500'}`}>{marketQty}</span>
                          <button onClick={() => updateMarketQuantity(row.ean, market, 1)} className="p-0.5 text-slate-500"><Plus className="w-2.5 h-2.5" /></button>
                          {isOverridden && (
                            <button onClick={() => resetMarketQuantity(row.ean, market)} title="Igualar a la cantidad de todos" className="text-[9px] text-indigo-400 ml-0.5">↺</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
