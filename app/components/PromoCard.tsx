'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Share2, Copy, Check, Heart } from 'lucide-react'

const DAY_BITS = [
  { l: 'L', bit: 2 }, { l: 'M', bit: 4 }, { l: 'X', bit: 8 },
  { l: 'J', bit: 16 }, { l: 'V', bit: 32 }, { l: 'S', bit: 64 }, { l: 'D', bit: 1 },
]

function formatDays(mask: number): { text: string | null; bits: boolean[] } {
  if (!mask || mask === 127) return { text: 'Todos los días', bits: [] }
  const active = DAY_BITS.map(d => (mask & d.bit) !== 0)
  const count = active.filter(Boolean).length
  if (count === 5 && !active[5] && !active[6]) return { text: 'Lun – Vie', bits: [] }
  if (count === 2 && active[5] && active[6]) return { text: 'Fin de semana', bits: [] }
  return { text: null, bits: active }
}

type Req = {
  bank?: { name: string; slug?: string; logoUrl?: string | null } | null
  wallet?: { name: string; slug?: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
  cap?: number | null
  capUnlimited?: boolean | null
  cardSegment?: { name: string } | null
}

type Promo = {
  id: string
  title: string
  slug?: string | null
  validDays: number
  salesChannel?: string | null
  isSaved?: boolean
  category: { name: string; color: string; icon?: string }
  commerce: { id?: string; name: string; logoUrl?: string | null }
  requirements: Req[]
}

function bestDiscountReq(reqs: Req[]): Req | null {
  const pct = reqs.filter(r =>
    r.discountType === 'PERCENTAGE_REINTEGRO' ||
    r.discountType === 'PERCENTAGE_DESCUENTO' ||
    r.discountType === 'BONIFICACION'
  )
  if (pct.length) return pct.reduce((a, b) => (b.discountValue ?? 0) > (a.discountValue ?? 0) ? b : a)
  const fixed = reqs.filter(r => r.discountType === 'FIXED_AMOUNT')
  if (fixed.length) return fixed[0]
  return reqs[0] ?? null
}

function discountDisplay(req: Req | null): { num: string; unit: string; label: string } {
  if (!req) return { num: '', unit: '', label: '' }
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return { num: `${v}`, unit: '%', label: 'reintegro' }
    case 'PERCENTAGE_DESCUENTO': return { num: `${v}`, unit: '%', label: 'descuento' }
    case 'BONIFICACION':         return { num: `${v}`, unit: '%', label: 'bonif.' }
    case 'FIXED_AMOUNT':         return { num: `$${v.toLocaleString('es-AR')}`, unit: '', label: 'descuento' }
    case 'CUOTAS_SIN_INTERES':   return { num: `${v}`, unit: '', label: `cuota${v !== 1 ? 's' : ''} s/int.` }
    case 'NXM':                  return { num: `${req.nxmN ?? 2}x${req.nxmM ?? 1}`, unit: '', label: 'prom.' }
    default:                     return { num: `${v}`, unit: '%', label: '' }
  }
}

type Props = {
  promo: Promo
  nearbyCount?: number | null
  onClick: () => void
  onToggleSave?: (id: string, e: React.MouseEvent) => void
  fullWidth?: boolean
  priority?: boolean
}

export default function PromoCard({ promo, nearbyCount, onClick, onToggleSave, fullWidth, priority }: Props) {
  const bestReq = bestDiscountReq(promo.requirements)
  const { num, unit, label } = discountDisplay(bestReq)
  const isCsi = bestReq?.discountType === 'CUOTAS_SIN_INTERES'

  const banks = Array.from(new Map(
    promo.requirements.filter(r => r.bank?.name).map(r => [r.bank!.name, r.bank!])
  ).values())
  const wallets = Array.from(new Map(
    promo.requirements.filter(r => r.wallet?.name).map(r => [r.wallet!.name, r.wallet!])
  ).values())
  const entities = [...banks, ...wallets].slice(0, 3)

  const hasSinTope = promo.requirements.some(r => r.capUnlimited)
  const segments = promo.requirements.map(r => r.cardSegment?.name).filter(Boolean)
  const exclusiveSegment = segments.length > 0 && new Set(segments).size === 1 ? segments[0] : null

  const days = formatDays(promo.validDays)

  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showShare) return
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowShare(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showShare])

  const getShareUrl = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://promoar.com.ar'
    return promo.slug ? `${base}/promos/${promo.slug}` : `${base}/promos`
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(getShareUrl()).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false); setShowShare(false) }, 1500)
    })
  }

  const handleWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation()
    const entity = entities[0]?.name || ''
    const text = `🔥 ${num}${unit} en ${promo.commerce.name}${entity ? ` con ${entity}` : ''}\nVelo en PromoAR: ${getShareUrl()}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    setShowShare(false)
  }

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-[#0F2040] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(29,61,110,0.13)] hover:-translate-y-0.5 active:scale-[0.97] ${fullWidth ? 'w-full' : 'flex-shrink-0'}`}
      style={{
        ...(fullWidth ? undefined : { width: 'calc((100vw - 48px) / 2.1)', minWidth: 148, maxWidth: 175 }),
        boxShadow: '0 1px 4px rgba(29,61,110,0.08), 0 0 0 1px rgba(29,61,110,0.06)',
      }}
    >
      {/* ── Logo area ── */}
      <div className="relative bg-[#F8F9FB] dark:bg-[#0A1628] flex items-center justify-center" style={{ height: 88 }}>
        {promo.commerce.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={promo.commerce.logoUrl}
            alt={promo.commerce.name}
            className="max-h-[56px] max-w-[78%] object-contain"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{ background: promo.category.color + '18', color: promo.category.color }}>
            {promo.category.icon ?? '🏷️'}
          </div>
        )}

        {/* Canal exclusivo — top-left */}
        {promo.salesChannel && (
          <span className={`absolute top-0 left-0 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-br-xl ${
            promo.salesChannel === 'ONLINE' ? 'bg-[#E8471C] text-white' : 'bg-amber-400 text-amber-900'
          }`}>
            {promo.salesChannel === 'ONLINE' ? 'Online' : 'Físico'}
          </span>
        )}

        {/* Segmento — top-left si no hay canal */}
        {exclusiveSegment && !promo.salesChannel && (
          <span className="absolute top-0 left-0 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-br-xl bg-purple-600 text-white truncate max-w-[80%]">
            {exclusiveSegment}
          </span>
        )}

        {/* Sucursales — bottom-left */}
        {!!nearbyCount && (
          <span className="absolute bottom-2 left-2 text-[9px] font-semibold bg-emerald-600/90 text-white px-1.5 py-0.5 rounded-lg">
            📍 {nearbyCount}
          </span>
        )}

        {/* Share — top-right, solo al hover */}
        {promo.slug && (
          <div ref={shareRef} className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
            <button
              onClick={e => { e.stopPropagation(); setShowShare(s => !s) }}
              className="w-6 h-6 rounded-lg bg-white/90 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-[#1D3D6E] opacity-0 group-hover:opacity-100 transition-all shadow-sm"
            >
              <Share2 size={11} />
            </button>
            {showShare && (
              <div className="absolute top-8 right-0 z-50 bg-[#0D1B2E] rounded-2xl shadow-2xl overflow-hidden w-44">
                <button onClick={handleCopy} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-white hover:bg-white/10 transition-colors border-b border-white/10">
                  {copied ? <Check size={13} className="text-emerald-400 shrink-0" /> : <Copy size={13} className="shrink-0 opacity-60" />}
                  {copied ? '¡Copiado!' : 'Copiar link'}
                </button>
                <button onClick={handleWhatsapp} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-white hover:bg-white/10 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" className="shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Franja de descuento ── */}
      {num && (
        <div className={`flex items-center gap-1.5 px-3 py-2 border-t ${
          isCsi
            ? 'bg-[#F0F4FF] dark:bg-[#1A2F55] border-[#D8E2F8] dark:border-[#2A4070]'
            : 'bg-[#EEF2F8] dark:bg-[#162440] border-[#D8E2F0] dark:border-[#1E3055]'
        }`}>
          <span className={`text-[22px] font-black leading-none tabular-nums ${isCsi ? 'text-[#2A5298]' : 'text-[#1D3D6E]'} dark:text-white`}>
            {num}
          </span>
          {unit && (
            <span className="text-[13px] font-black leading-none text-[#E8471C]">{unit}</span>
          )}
          {label && (
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate">{label}</span>
          )}
          {hasSinTope && (
            <span className="ml-auto text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-1 py-0.5 rounded shrink-0">
              sin tope
            </span>
          )}
        </div>
      )}

      {/* ── Info ── */}
      <div className="px-3 pt-2 pb-3 space-y-1.5">
        {/* Nombre + favorito */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-[13px] font-bold text-[#0D1B2E] dark:text-white leading-tight truncate">{promo.commerce.name}</p>
          {onToggleSave && (
            <button onClick={e => onToggleSave(promo.id, e)} className="shrink-0 -mt-0.5 p-0.5 hover:scale-110 active:scale-90 transition-transform">
              <Heart size={14} className={promo.isSaved ? 'text-[#E8471C] fill-[#E8471C]' : 'text-gray-300 dark:text-slate-600'} />
            </button>
          )}
        </div>

        {/* Entidades */}
        {entities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {entities.map((e, i) => (
              e.slug ? (
                <a key={i} href={`/bancos/${e.slug}`} onClick={ev => ev.stopPropagation()}
                  className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-lg bg-[#EEF2F8] dark:bg-[#1E3055] text-[#1D3D6E] dark:text-[#8AADD4] border border-[#D0DBF0] dark:border-[#2A4070] hover:bg-[#1D3D6E] hover:text-white hover:border-[#1D3D6E] transition-colors">
                  {e.logoUrl && <img src={e.logoUrl} alt="" className="w-3 h-3 rounded object-contain" />}
                  {e.name.split(' ').slice(-1)[0].substring(0, 9)}
                </a>
              ) : (
                <span key={i} className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-lg bg-[#EEF2F8] dark:bg-[#1E3055] text-[#1D3D6E] dark:text-[#8AADD4] border border-[#D0DBF0] dark:border-[#2A4070]">
                  {e.logoUrl && <img src={e.logoUrl} alt="" className="w-3 h-3 rounded object-contain" />}
                  {e.name.split(' ').slice(-1)[0].substring(0, 9)}
                </span>
              )
            ))}
          </div>
        )}

        {/* Días — solo si NO es todos los días */}
        {!days.text && days.bits.length > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {DAY_BITS.filter((_, i) => days.bits[i]).map(d => d.l).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
