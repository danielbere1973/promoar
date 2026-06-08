'use client'
import { X, MapPin } from 'lucide-react'
import { useEffect } from 'react'

const DAYS_ROW = [
  { label: 'L', bit: 2 },
  { label: 'M', bit: 4 },
  { label: 'X', bit: 8 },
  { label: 'J', bit: 16 },
  { label: 'V', bit: 32 },
  { label: 'S', bit: 64 },
  { label: 'D', bit: 1 },
]

const CHANNEL_LABEL: Record<string, string> = {
  QR: 'QR / MODO',
  NFC: 'Sin contacto',
  TARJETA_FISICA: 'Tarjeta física',
  TRANSFERENCIA: 'Transferencia',
  DINERO_EN_CUENTA: 'Dinero en cuenta',
}

const CAP_PERIOD: Record<string, string> = {
  MONTHLY: 'por mes',
  WEEKLY: 'por semana',
  DAILY: 'por día',
  TOTAL: 'total',
}

const CARD_LOGOS: Record<string, string> = {
  'visa':                   'https://www.visa.com/favicon.ico',
  'mastercard':             'https://www.google.com/s2/favicons?sz=64&domain=mastercard.com',
  'amex':                   'https://www.americanexpress.com/favicon.ico',
  'american-express-banco': 'https://www.americanexpress.com/favicon.ico',
  'naranja-x':              'https://www.google.com/s2/favicons?sz=64&domain=naranjax.com',
  'cabal':                  'https://www.google.com/s2/favicons?sz=64&domain=cabal.com.ar',
}

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  cardType?: string | null
  paymentChannel?: string | null
  discountType?: string
  discountValue?: number
  cap?: number | null
  capPeriod?: string | null
  minPurchase?: number | null
  segment?: string | null
}

type Promo = {
  id: string
  slug?: string | null
  title: string
  description: string
  validDays: number
  validFrom?: string | null
  validUntil?: string | null
  specificDates?: string | null
  sourceText?: string | null
  sourceUrl?: string | null
  category: { name: string; color: string; icon?: string }
  commerce: { name: string; logoUrl?: string | null }
  requirements: Req[]
}

function discountLabel(req: Req): string {
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return `${v}% reintegro`
    case 'PERCENTAGE_DESCUENTO': return `${v}% descuento`
    case 'CUOTAS_SIN_INTERES':   return `${v} cuotas sin interés`
    case 'BONIFICACION':         return `${v}% bonificación`
    case 'FIXED_AMOUNT':         return `$${v.toLocaleString('es-AR')} descuento`
    default: return `${v}%`
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

type NearbyBranch = { count: number; minDistKm: number }

export default function PromoDetailSheet({ promo, nearbyBranch, onClose }: { promo: Promo; nearbyBranch?: NearbyBranch; onClose: () => void }) {
  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const reqs = promo.requirements
  const specificDates: string[] = promo.specificDates ? JSON.parse(promo.specificDates) : []

  // Descuentos únicos
  const discountMap = new Map<string, Req>()
  for (const r of reqs) {
    const key = `${r.discountValue}-${r.discountType}`
    if (!discountMap.has(key)) discountMap.set(key, r)
  }
  const discounts = Array.from(discountMap.values())
    .sort((a, b) => (b.discountValue ?? 0) - (a.discountValue ?? 0))

  // Entidades únicas
  const banksMap = new Map<string, { name: string; logoUrl?: string | null }>()
  const walletsMap = new Map<string, { name: string; logoUrl?: string | null }>()
  const networksMap = new Map<string, { name: string; slug: string; types: Set<string> }>()
  const channelsSet = new Set<string>()
  for (const r of reqs) {
    if (r.bank?.name) banksMap.set(r.bank.name, r.bank)
    if (r.wallet?.name) walletsMap.set(r.wallet.name, r.wallet)
    if (r.cardNetwork?.slug) {
      if (!networksMap.has(r.cardNetwork.slug))
        networksMap.set(r.cardNetwork.slug, { ...r.cardNetwork, types: new Set() })
      if (r.cardType) networksMap.get(r.cardNetwork.slug)!.types.add(r.cardType)
    }
    if (r.paymentChannel && r.paymentChannel !== 'ANY') channelsSet.add(r.paymentChannel)
  }
  const banks = Array.from(banksMap.values())
  const wallets = Array.from(walletsMap.values())
  const networks = Array.from(networksMap.values())
  const channels = Array.from(channelsSet)
  const capReq = reqs.find(r => r.cap)
  const minReq = reqs.find(r => r.minPurchase)

  // Mejor descuento para el hero
  const bestDiscount = discounts[0]
  const bestLabel = bestDiscount ? discountLabel(bestDiscount) : ''

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            {promo.commerce.logoUrl ? (
              <img src={promo.commerce.logoUrl} alt={promo.commerce.name}
                className="w-10 h-10 rounded-xl object-contain border border-gray-100 bg-white p-1 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: promo.category.color + '20' }}>
                {promo.category.icon ?? '🏷️'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1E3A5F] truncate">{promo.commerce.name}</p>
              <p className="text-[10px] font-semibold truncate" style={{ color: promo.category.color }}>
                {promo.category.icon} {promo.category.name}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors ml-2">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Beneficio hero */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#1E3A5F' }}>
            <div className="px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-1">
                {discounts.length === 1 ? 'Beneficio' : 'Mejor beneficio'}
              </p>
              <p className="text-4xl font-black text-white leading-none tracking-tight">{bestLabel}</p>
              {promo.title && promo.title !== promo.commerce.name && (
                <p className="text-sm text-blue-200 mt-2 leading-snug">{promo.title}</p>
              )}
            </div>
            {discounts.length > 1 && (
              <div className="border-t border-white/10 px-5 py-3 flex flex-wrap gap-2">
                {discounts.slice(1).map((d, i) => (
                  <span key={i} className="text-xs font-semibold text-blue-200 bg-white/10 px-2.5 py-1 rounded-lg">
                    {discountLabel(d)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Vigencia */}
          <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-2.5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vigencia</p>

            {specificDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {specificDates.map(d => {
                  const [y, m, day] = d.split('-')
                  return (
                    <span key={d} className="bg-[#1E3A5F] text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                      {day}/{m}/{y}
                    </span>
                  )
                })}
              </div>
            ) : (
              <>
                {/* Días visuales */}
                <div className="flex gap-1.5">
                  {DAYS_ROW.map(({ label, bit }) => {
                    const active = !promo.validDays || promo.validDays === 127 || (promo.validDays & bit) !== 0
                    return (
                      <div key={label}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                          active ? 'text-white' : 'bg-white text-gray-300 border border-gray-200'
                        }`}
                        style={active ? { background: '#1E3A5F' } : {}}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
                {(promo.validFrom || promo.validUntil) && (
                  <p className="text-xs text-gray-500">
                    {promo.validFrom && `Desde ${formatDate(promo.validFrom)}`}
                    {promo.validFrom && promo.validUntil && ' · '}
                    {promo.validUntil && `Vence ${formatDate(promo.validUntil)}`}
                  </p>
                )}
              </>
            )}

            {/* Tope y mínimo */}
            {(capReq || minReq) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {capReq && (
                  <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-xl">
                    <span className="text-sm">🔒</span>
                    <div>
                      <p className="text-[11px] font-black">Tope ${capReq.cap!.toLocaleString('es-AR')}</p>
                      {capReq.capPeriod && <p className="text-[10px] opacity-70">{CAP_PERIOD[capReq.capPeriod] ?? ''}</p>}
                    </div>
                  </div>
                )}
                {minReq && (
                  <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-xl">
                    <span className="text-sm">🛒</span>
                    <div>
                      <p className="text-[11px] font-black">Mín. ${minReq.minPurchase!.toLocaleString('es-AR')}</p>
                      <p className="text-[10px] opacity-70">de compra</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Con qué pagás */}
          {(banks.length > 0 || wallets.length > 0 || networks.length > 0 || channels.length > 0) && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Con qué pagás</p>

              {banks.length > 0 && (
                <div className="space-y-2">
                  {banks.map(b => (
                    <div key={b.name} className="flex items-center gap-2.5">
                      {b.logoUrl ? (
                        <img src={b.logoUrl} alt={b.name} className="w-7 h-7 rounded-lg object-contain border border-gray-200 bg-white p-0.5 shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-[#1E3A5F] flex items-center justify-center text-[9px] font-black text-white shrink-0">
                          {b.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#1E3A5F]">{b.name}</p>
                        <p className="text-[10px] text-gray-400">Banco</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {wallets.length > 0 && (
                <div className="space-y-2">
                  {wallets.map(w => (
                    <div key={w.name} className="flex items-center gap-2.5">
                      {w.logoUrl ? (
                        <img src={w.logoUrl} alt={w.name} className="w-7 h-7 rounded-lg object-contain border border-gray-200 bg-white p-0.5 shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-[#D94F2B] flex items-center justify-center text-[9px] font-black text-white shrink-0">
                          {w.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#1E3A5F]">{w.name}</p>
                        <p className="text-[10px] text-gray-400">Billetera digital</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {networks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {networks.map(n => {
                    const types = Array.from(n.types)
                    const typeLabel = types.includes('CREDIT') && types.includes('DEBIT') ? 'Crédito y débito'
                      : types.includes('CREDIT') ? 'Crédito'
                      : types.includes('DEBIT') ? 'Débito'
                      : types[0] === 'PREPAID' ? 'Prepaga' : ''
                    return (
                      <div key={n.slug} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                        {CARD_LOGOS[n.slug] && (
                          <img src={CARD_LOGOS[n.slug]} alt={n.name} className="w-4 h-4 object-contain" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#1E3A5F]">{n.name}</p>
                          {typeLabel && <p className="text-[9px] text-gray-400">{typeLabel}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {channels.map(ch => (
                    <span key={ch} className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl">
                      {CHANNEL_LABEL[ch] ?? ch}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sucursales */}
          {nearbyBranch && (
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(promo.commerce.name)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 hover:bg-emerald-100 transition-colors"
            >
              <MapPin size={18} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800">Ver sucursales en Google Maps</p>
                <p className="text-xs text-emerald-600">
                  {nearbyBranch.count} {nearbyBranch.count === 1 ? 'sucursal' : 'sucursales'} · más cerca a {nearbyBranch.minDistKm < 0.1 ? 'menos de 100m' : `${nearbyBranch.minDistKm}km`}
                </p>
              </div>
              <span className="text-emerald-500 font-bold text-sm">→</span>
            </a>
          )}

          {/* Legales */}
          <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Legales</p>
            {promo.sourceText ? (
              <details>
                <summary className="text-xs font-semibold text-[#1E3A5F] cursor-pointer select-none list-none flex items-center gap-1">
                  Ver términos y condiciones <span className="text-gray-300">▾</span>
                </summary>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-2 whitespace-pre-line">
                  {promo.sourceText.slice(0, 2000)}{promo.sourceText.length > 2000 ? '…' : ''}
                </p>
              </details>
            ) : (
              <p className="text-xs text-gray-400">No disponemos del texto legal.</p>
            )}
            {promo.sourceUrl && (
              <a href={promo.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-[#D94F2B] hover:underline">
                🔗 Ver fuente oficial
              </a>
            )}
          </div>

          {/* Link compartir */}
          {promo.slug && (
            <a href={`/promos/${promo.slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs font-semibold text-[#1E3A5F] bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-2xl transition-colors">
              🔗 Ver página completa · compartir
            </a>
          )}

        </div>
      </div>
    </div>
  )
}
