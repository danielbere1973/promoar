'use client'
import { X, MapPin, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'

const DAY_BITS = [
  { label: 'L', bit: 2 }, { label: 'M', bit: 4 }, { label: 'X', bit: 8 },
  { label: 'J', bit: 16 }, { label: 'V', bit: 32 }, { label: 'S', bit: 64 },
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
  'visa': 'https://www.visa.com/favicon.ico',
  'mastercard': 'https://www.google.com/s2/favicons?sz=64&domain=mastercard.com',
  'amex': 'https://www.americanexpress.com/favicon.ico',
  'american-express-banco': 'https://www.americanexpress.com/favicon.ico',
  'naranja-x': 'https://www.google.com/s2/favicons?sz=64&domain=naranjax.com',
  'cabal': 'https://www.google.com/s2/favicons?sz=64&domain=cabal.com.ar',
}

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  cardType?: string | null
  paymentChannel?: string | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
  cap?: number | null
  capUnlimited?: boolean | null
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
  salesChannel?: string | null
  commerceNote?: string | null
  category: { name: string; color: string; icon?: string }
  commerce: { name: string; logoUrl?: string | null; instagramUrl?: string | null }
  requirements: Req[]
}

function discountDisplay(req: Req): { num: string; unit: string; label: string } {
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return { num: `${v}`, unit: '%', label: 'reintegro' }
    case 'PERCENTAGE_DESCUENTO': return { num: `${v}`, unit: '%', label: 'descuento' }
    case 'BONIFICACION': return { num: `${v}`, unit: '%', label: 'bonificación' }
    case 'FIXED_AMOUNT': return { num: `$${v.toLocaleString('es-AR')}`, unit: '', label: 'descuento fijo' }
    case 'CUOTAS_SIN_INTERES': return { num: `${v}`, unit: 'CSI', label: 'cuotas sin interés' }
    case 'NXM': return { num: `${req.nxmN ?? 2}x${req.nxmM ?? 1}`, unit: '', label: 'promoción' }
    default: return { num: `${v}`, unit: '%', label: '' }
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Branch = { address: string | null; city: string | null; province: string | null; lat: number; lng: number; distanceKm: number }
type NearbyBranch = { count: number; minDistKm: number; branches: Branch[] }

function formatBranchAddress(b: Branch): string {
  return [b.address, b.city].filter(Boolean).join(', ') || b.province || 'Sucursal'
}

function formatDistance(km: number): string {
  return km < 0.1 ? '<100m' : `${km}km`
}

export default function PromoDetailSheet({ promo, nearbyBranch, onClose }: {
  promo: Promo
  nearbyBranch?: NearbyBranch
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

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
    .sort((a, b) => {
      const score = (r: Req) => {
        if (r.discountType === 'PERCENTAGE_REINTEGRO' || r.discountType === 'PERCENTAGE_DESCUENTO') return (r.discountValue ?? 0) + 1000
        if (r.discountType === 'CUOTAS_SIN_INTERES') return r.discountValue ?? 0
        return 0
      }
      return score(b) - score(a)
    })

  // Entidades únicas
  const banksMap = new Map<string, { name: string; logoUrl?: string | null }>()
  const walletsMap = new Map<string, { name: string; logoUrl?: string | null }>()
  const networksMap = new Map<string, { name: string; slug: string; types: Set<string> }>()
  const channelsSet = new Set<string>()
  const capReq = reqs.find(r => r.cap && r.cap > 0)
  const sinTope = reqs.some(r => r.capUnlimited)
  const minReq = reqs.find(r => r.minPurchase)
  const segments = [...new Set(reqs.map(r => r.segment).filter(Boolean))]

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

  const bestDiscount = discounts[0]
  const hero = bestDiscount ? discountDisplay(bestDiscount) : null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-[#0F2040] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(92vh, 720px)', animation: 'modalIn 0.2s ease-out' }}
      >
        {/* ─── Hero: gradient navy + logo + descuento ─── */}
        <div
          className="relative flex flex-col items-center px-6 pt-5 pb-8 shrink-0"
          style={{ background: 'linear-gradient(145deg, #1D3D6E 0%, #2A5298 100%)' }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <X size={15} className="text-white" />
          </button>

          {/* Canal */}
          {promo.salesChannel && (
            <div className={`absolute top-4 left-4 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-xl ${
              promo.salesChannel === 'ONLINE'
                ? 'bg-[#E8471C] text-white'
                : 'bg-amber-400 text-amber-900'
            }`}>
              {promo.salesChannel === 'ONLINE' ? 'Exclusivo Online' : 'Exclusivo Físico'}
            </div>
          )}

          {/* Logo */}
          <div className="w-[72px] h-[72px] rounded-2xl bg-white shadow-lg flex items-center justify-center mt-2 mb-3">
            {promo.commerce.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={promo.commerce.logoUrl}
                alt={promo.commerce.name}
                className="max-w-[80%] max-h-[80%] object-contain"
              />
            ) : (
              <span className="text-2xl">{promo.category.icon ?? '🏷️'}</span>
            )}
          </div>

          {/* Nombre comercio */}
          <p className="text-white font-black text-[17px] text-center leading-tight">
            {promo.commerce.name}
          </p>
          <p className="text-white/60 text-[11px] mt-0.5">
            {promo.category.icon} {promo.category.name}
          </p>

          {/* Descuento hero */}
          {hero && (
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[52px] font-black text-white leading-none tabular-nums" style={{ letterSpacing: '-2px' }}>
                {hero.num}
              </span>
              {hero.unit && (
                <span className="text-[28px] font-black leading-none" style={{ color: '#E8471C' }}>
                  {hero.unit}
                </span>
              )}
              {hero.label && (
                <span className="text-white/60 text-[13px] font-medium ml-1 self-end mb-2">
                  {hero.label}
                </span>
              )}
            </div>
          )}

          {/* Descuentos adicionales */}
          {discounts.length > 1 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {discounts.slice(1).map((d, i) => {
                const { num: n, unit: u, label: l } = discountDisplay(d)
                return (
                  <span key={i} className="text-[11px] font-bold text-white/80 bg-white/15 px-3 py-1 rounded-full">
                    {n}{u} {l}
                  </span>
                )
              })}
            </div>
          )}

          {/* Segmentos */}
          {segments.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {segments.map((s, i) => (
                <span key={i} className="text-[10px] font-bold text-purple-200 bg-purple-500/30 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
                  Exclusivo {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ─── Body scrollable ─── */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* Nota especial */}
          {promo.commerceNote && (
            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl px-4 py-3">
              <span className="text-base shrink-0">⚠️</span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{promo.commerceNote}</p>
            </div>
          )}

          {/* Vigencia */}
          <Section title="Vigencia">
            {specificDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {specificDates.map(d => {
                  const [y, m, day] = d.split('-')
                  return (
                    <span key={d} className="bg-[#1D3D6E] text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                      {day}/{m}/{y.slice(2)}
                    </span>
                  )
                })}
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  {DAY_BITS.map(({ label, bit }) => {
                    const active = !promo.validDays || promo.validDays === 127 || (promo.validDays & bit) !== 0
                    return (
                      <div key={label}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black ${
                          active
                            ? 'bg-[#1D3D6E] dark:bg-[#3A6BC4] text-white'
                            : 'bg-gray-100 dark:bg-[#1E3055] text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
                {(promo.validFrom || promo.validUntil) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                    {promo.validFrom && `Desde ${formatDate(promo.validFrom)}`}
                    {promo.validFrom && promo.validUntil && ' · '}
                    {promo.validUntil && `Vence ${formatDate(promo.validUntil)}`}
                  </p>
                )}
              </>
            )}

            {/* Tope / Sin tope / Mínimo */}
            {(capReq || sinTope || minReq) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {sinTope && (
                  <Pill color="emerald">✓ Sin tope</Pill>
                )}
                {capReq && (
                  <Pill color="red">
                    🔒 Tope ${capReq.cap!.toLocaleString('es-AR')}
                    {capReq.capPeriod && ` ${CAP_PERIOD[capReq.capPeriod] ?? ''}`}
                  </Pill>
                )}
                {minReq && (
                  <Pill color="amber">
                    🛒 Mín. ${minReq.minPurchase!.toLocaleString('es-AR')}
                  </Pill>
                )}
              </div>
            )}
          </Section>

          {/* Con qué pagás */}
          {(banks.length > 0 || wallets.length > 0 || networks.length > 0 || channels.length > 0) && (
            <Section title="Con qué pagás">
              {[...banks.map(e => ({ ...e, type: 'Banco' })), ...wallets.map(e => ({ ...e, type: 'Billetera' }))].map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  {e.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.logoUrl} alt={e.name}
                      className="w-8 h-8 rounded-xl object-contain border border-gray-100 dark:border-[#1E3055] bg-white dark:bg-[#0A1628] p-0.5 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ background: '#1D3D6E' }}>
                      {e.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[#0D1B2E] dark:text-white">{e.name}</p>
                    <p className="text-[10px] text-gray-400">{e.type}</p>
                  </div>
                </div>
              ))}

              {networks.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {networks.map(n => {
                    const types = Array.from(n.types)
                    const typeLabel = types.includes('CREDIT') && types.includes('DEBIT') ? 'Crédito y débito'
                      : types.includes('CREDIT') ? 'Crédito'
                      : types.includes('DEBIT') ? 'Débito'
                      : types[0] === 'PREPAID' ? 'Prepaga' : ''
                    return (
                      <div key={n.slug} className="flex items-center gap-2 bg-gray-50 dark:bg-[#1E3055] border border-gray-200 dark:border-[#2A4070] rounded-xl px-3 py-1.5">
                        {CARD_LOGOS[n.slug] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={CARD_LOGOS[n.slug]} alt={n.name} className="w-4 h-4 object-contain" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#1D3D6E] dark:text-white">{n.name}</p>
                          {typeLabel && <p className="text-[9px] text-gray-400">{typeLabel}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {channels.map(ch => (
                    <span key={ch} className="text-[11px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40 px-3 py-1.5 rounded-xl">
                      {CHANNEL_LABEL[ch] ?? ch}
                    </span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Sucursales */}
          {nearbyBranch && nearbyBranch.branches.length > 0 && (
            <Section title="Sucursales cercanas" icon={<MapPin size={13} className="text-emerald-600 shrink-0" />} accent="emerald">
              <div className="space-y-1.5">
                {nearbyBranch.branches.map((b, i) => (
                  <a key={i}
                    href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-900/15 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl px-3 py-2 transition-colors"
                  >
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 truncate">{formatBranchAddress(b)}</p>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">{formatDistance(b.distanceKm)}</span>
                  </a>
                ))}
              </div>
              {nearbyBranch.count > nearbyBranch.branches.length && (
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(promo.commerce.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline pt-1">
                  Ver las {nearbyBranch.count} sucursales en Google Maps →
                </a>
              )}
            </Section>
          )}

          {/* Instagram */}
          {promo.commerce.instagramUrl && (
            <a href={promo.commerce.instagramUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/15 dark:to-purple-900/15 border border-pink-100 dark:border-pink-800/30 rounded-2xl px-4 py-3 hover:opacity-90 transition-opacity">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-pink-500 shrink-0"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              <p className="text-sm font-semibold text-pink-700 dark:text-pink-400">Instagram</p>
              <span className="ml-auto text-pink-400 dark:text-pink-500"><ExternalLink size={14} /></span>
            </a>
          )}

          {/* Legales */}
          <Section title="Términos y condiciones">
            {promo.sourceText ? (
              <details>
                <summary className="text-xs font-semibold text-[#1D3D6E] dark:text-[#8AADD4] cursor-pointer select-none list-none flex items-center gap-1">
                  Ver texto completo <span className="text-gray-400">▾</span>
                </summary>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2 whitespace-pre-line">
                  {promo.sourceText.slice(0, 2000)}{promo.sourceText.length > 2000 ? '…' : ''}
                </p>
              </details>
            ) : (
              <p className="text-xs text-gray-400">No disponemos del texto legal.</p>
            )}
            {promo.sourceUrl && (
              <a href={promo.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#E8471C] hover:underline mt-2">
                <ExternalLink size={12} /> Ver fuente oficial
              </a>
            )}
          </Section>

          {/* Link página completa */}
          {promo.slug && (
            <a href={`/promos/${promo.slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs font-semibold text-[#1D3D6E] dark:text-[#8AADD4] bg-[#EEF2F8] dark:bg-[#1E3055] hover:bg-[#1D3D6E] hover:text-white dark:hover:bg-[#3A6BC4] px-4 py-3 rounded-2xl transition-colors">
              <ExternalLink size={13} /> Ver página completa · compartir
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

function Section({ title, icon, accent, children }: {
  title: string
  icon?: React.ReactNode
  accent?: 'emerald' | 'default'
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 dark:bg-[#0A1628] rounded-2xl px-4 py-3.5 space-y-2.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
        {icon}{title}
      </p>
      {children}
    </div>
  )
}

function Pill({ color, children }: { color: 'emerald' | 'red' | 'amber'; children: React.ReactNode }) {
  const cls = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/40',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-orange-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/40',
  }[color]
  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border ${cls}`}>
      {children}
    </div>
  )
}
