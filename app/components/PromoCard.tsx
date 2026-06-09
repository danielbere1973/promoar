'use client'
import { useState, useRef, useEffect } from 'react'
import { Share2, Copy, Check } from 'lucide-react'

type Req = {
  bank?: { name: string } | null
  wallet?: { name: string } | null
  discountType?: string
  discountValue?: number
}

type Promo = {
  id: string
  title: string
  slug?: string | null
  validDays: number
  category: { name: string; color: string; icon?: string }
  commerce: { id?: string; name: string; logoUrl?: string | null }
  requirements: Req[]
}

function bestPercentageReq(p: Promo): Req | null {
  const pctReqs = p.requirements.filter(r =>
    r.discountType === 'PERCENTAGE_REINTEGRO' ||
    r.discountType === 'PERCENTAGE_DESCUENTO' ||
    r.discountType === 'BONIFICACION' ||
    r.discountType === 'FIXED_AMOUNT'
  )
  if (!pctReqs.length) return null
  return pctReqs.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), pctReqs[0])
}

function maxDiscountReq(p: Promo): Req | null {
  if (!p.requirements.length) return null
  return p.requirements.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), p.requirements[0])
}

function discountLabel(p: Promo): string {
  const req = bestPercentageReq(p) ?? maxDiscountReq(p)
  if (!req) return ''
  const val = req.discountValue ?? 0
  if (req.discountType === 'PERCENTAGE_REINTEGRO' || req.discountType === 'PERCENTAGE_DESCUENTO') return `Hasta ${val}%`
  if (req.discountType === 'BONIFICACION') return `Hasta ${val}% BONIF.`
  if (req.discountType === 'FIXED_AMOUNT') return `Hasta $${val}`
  if (req.discountType === 'CUOTAS_SIN_INTERES') return `${val} CSI`
  return `Hasta ${val}`
}

function formatValidDays(mask: number) {
  if (!mask || mask === 127) return 'Todos los días'
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const active = []
  for (let i = 0; i < 7; i++) {
    if ((mask & (1 << i)) !== 0) active.push(days[i])
  }
  if (active.length === 2 && (mask & (1 << 6)) && (mask & (1 << 0))) return 'Fin de semana'
  if (active.length === 5 && !(mask & (1 << 0)) && !(mask & (1 << 6))) return 'Lunes a Viernes'
  return active.join(', ')
}

type Props = {
  promo: Promo
  nearbyCount?: number | null
  onClick: () => void
  fullWidth?: boolean
}

export default function PromoCard({ promo, nearbyCount, onClick, fullWidth }: Props) {
  const pctReq = bestPercentageReq(promo)
  const label = discountLabel(promo)
  const banks = Array.from(new Map(promo.requirements.filter(r => r.bank?.name).map(r => [r.bank!.name, r.bank!])).values())
  const wallets = Array.from(new Map(promo.requirements.filter(r => r.wallet?.name).map(r => [r.wallet!.name, r.wallet!])).values())
  const entities = [...banks, ...wallets].slice(0, 2)
  const days = formatValidDays(promo.validDays)

  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showShare) return
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShare(false)
      }
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
    const discount = pctReq ? `${pctReq.discountValue}%` : label.replace('Hasta ', '')
    const entity = entities[0]?.name || ''
    const daysStr = days === 'Todos los días' ? 'todos los días' : days.toLowerCase()
    const text = `🔥 ${discount} en ${promo.commerce.name}${entity ? ` con ${entity}` : ''} — válido ${daysStr}\nVelo en PromoAR: ${getShareUrl()}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    setShowShare(false)
  }

  return (
    <div
      onClick={onClick}
      className={`group bg-white dark:bg-slate-800 border-2 border-[#EAECF0] dark:border-slate-700 rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.03] hover:border-[#1E3A5F] active:scale-[0.97] ${fullWidth ? 'w-full' : 'flex-shrink-0'}`}
      style={fullWidth ? undefined : { width: 'calc((100vw - 48px) / 2.1)', minWidth: 148, maxWidth: 175 }}
    >
      <div className="h-0.5 bg-[#1E3A5F] dark:bg-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Imagen/Logo */}
      <div className="relative bg-[#F8F9FB] dark:bg-slate-900 border-b border-[#F0F2F5] dark:border-slate-700 flex items-center justify-center" style={{ height: 80 }}>
        {promo.commerce.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="max-h-12 max-w-[80%] object-contain p-2" />
        ) : (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black" style={{ background: promo.category.color + '20', color: promo.category.color }}>
            {promo.category.icon ?? '🏷️'}
          </div>
        )}
        {(pctReq?.discountValue ?? 0) <= 100 && label && (
          <div className="absolute top-2 right-2 bg-[#D94F2B] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight">
            {pctReq ? `${pctReq.discountValue}%` : label.replace('Hasta ', '')}
          </div>
        )}
        {!!nearbyCount && (
          <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[9px] font-semibold px-2 py-0.5 text-center truncate">
            📍 {nearbyCount} {nearbyCount === 1 ? 'sucursal' : 'sucursales'}
          </div>
        )}

        {/* Share button */}
        {promo.slug && (
          <div ref={shareRef} className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={e => { e.stopPropagation(); setShowShare(s => !s) }}
              className="w-6 h-6 rounded-lg bg-white/80 dark:bg-slate-700/80 backdrop-blur flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
            >
              <Share2 size={12} />
            </button>

            {showShare && (
              <div className="absolute top-8 left-0 z-50 bg-gray-900 dark:bg-white rounded-2xl shadow-2xl overflow-hidden w-48">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-white dark:text-gray-900 hover:bg-white/10 dark:hover:bg-black/5 transition-colors border-b border-white/10 dark:border-black/10"
                >
                  {copied
                    ? <Check size={14} className="text-green-400 dark:text-green-600 shrink-0" />
                    : <Copy size={14} className="shrink-0 opacity-70" />}
                  {copied ? '¡Link copiado!' : 'Copiar link'}
                </button>
                <button
                  onClick={handleWhatsapp}
                  className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-white dark:text-gray-900 hover:bg-white/10 dark:hover:bg-black/5 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" className="shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Compartir por WhatsApp
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-2.5 pt-2 pb-3 space-y-1.5">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate leading-tight">{promo.commerce.name}</p>
        <p className="text-[11px] text-gray-700 dark:text-slate-400 leading-tight truncate">{promo.title !== promo.commerce.name ? promo.title : label}</p>

        {entities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entities.map((e, i) => (
              <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#EEF2F8] dark:bg-slate-700 text-[#3A5A7A] dark:text-slate-300 border border-[#C8D5E8] dark:border-slate-600">
                {e.name.split(' ').slice(-1)[0]}
              </span>
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-500 dark:text-slate-400">{days === 'Todos los días' ? 'Todos los días' : days.replace('Lunes a viernes', 'Lun–Vie')}</p>
      </div>
    </div>
  )
}
