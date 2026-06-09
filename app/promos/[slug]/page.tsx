import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import BottomNav from '@/app/components/BottomNav'
import BackButton from '@/app/components/BackButton'

// ─── Helpers ────────────────────────────────────────────────────────────────

function discountLabel(req: any): string {
  if (!req) return ''
  const v = req.discountValue
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return `${v}% reintegro`
    case 'PERCENTAGE_DESCUENTO': return `${v}% descuento`
    case 'CUOTAS_SIN_INTERES':   return `${v} cuotas sin interés`
    case 'BONIFICACION':         return `${v}% bonificación`
    case 'FIXED_AMOUNT':         return `$${v} de descuento`
    default: return `${v}%`
  }
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

const CARD_NETWORK_LOGOS: Record<string, string> = {
  'visa':                   'https://www.visa.com/favicon.ico',
  'mastercard':             'https://www.google.com/s2/favicons?sz=128&domain=mastercard.com',
  'amex':                   'https://www.americanexpress.com/favicon.ico',
  'american-express-banco': 'https://www.americanexpress.com/favicon.ico',
  'naranja-x':              'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com',
  'cabal':                  'https://www.google.com/s2/favicons?sz=128&domain=cabal.com.ar',
}

// ─── Metadata dinámica ────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const promo = await prisma.promo.findUnique({
    where: { slug: params.slug },
    include: {
      commerce: true,
      category: true,
      requirements: { include: { bank: true, wallet: true }, take: 1, orderBy: { discountValue: 'desc' } },
    },
  })
  if (!promo) return { title: 'Promoción no encontrada — PromoAR' }
  const bestReq = promo.requirements[0]
  const discount = bestReq ? discountLabel(bestReq) : ''
  const bankWallet = bestReq?.bank?.name || bestReq?.wallet?.name || ''
  const title = `${discount} en ${promo.commerce.name}${bankWallet ? ` con ${bankWallet}` : ''} — PromoAR`
  const description = promo.description || `Aprovechá ${discount} en ${promo.commerce.name}.`
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', locale: 'es_AR' },
    twitter: { card: 'summary', title, description },
  }
}

export async function generateStaticParams() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', slug: { not: null } },
    select: { slug: true },
    take: 1000,
  })
  return promos.map(p => ({ slug: p.slug! }))
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PromoDetailPage({ params }: { params: { slug: string } }) {
  const promo = await prisma.promo.findUnique({
    where: { slug: params.slug },
    include: {
      commerce: true,
      category: true,
      requirements: {
        include: { bank: true, wallet: true, cardNetwork: true },
        orderBy: { discountValue: 'desc' },
      },
    },
  })

  if (!promo || promo.status === 'EXPIRED') notFound()

  const branches = await prisma.commerceBranch.findMany({
    where: { commerceId: promo.commerce.id },
    take: 1,
  })

  const specificDates: string[] = promo.specificDates ? JSON.parse(promo.specificDates) : []
  const reqs = promo.requirements

  // Descuentos únicos
  const discountMap = new Map<string, any>()
  for (const r of reqs) {
    const key = `${r.discountValue}-${r.discountType}`
    if (!discountMap.has(key)) discountMap.set(key, r)
  }
  const discounts = Array.from(discountMap.values())

  // Entidades únicas
  const banksMap = new Map<string, { name: string; logoUrl?: string | null }>()
  const walletsMap = new Map<string, { name: string; logoUrl?: string | null }>()
  const networksMap = new Map<string, { name: string; slug: string; types: Set<string> }>()
  const channelsSet = new Set<string>()

  for (const r of reqs) {
    if (r.bank?.name) banksMap.set(r.bank.name, r.bank)
    if (r.wallet?.name) walletsMap.set(r.wallet.name, r.wallet)
    if (r.cardNetwork?.slug) {
      if (!networksMap.has(r.cardNetwork.slug)) {
        networksMap.set(r.cardNetwork.slug, { ...r.cardNetwork, types: new Set() })
      }
      if (r.cardType) networksMap.get(r.cardNetwork.slug)!.types.add(r.cardType)
    }
    if (r.paymentChannel && r.paymentChannel !== 'ANY') channelsSet.add(r.paymentChannel)
  }

  const banks = Array.from(banksMap.values())
  const wallets = Array.from(walletsMap.values())
  const networks = Array.from(networksMap.values())
  const channels = Array.from(channelsSet)

  // Cap y mínimo del mejor requirement
  const capReq = reqs.find(r => r.cap)
  const minReq = reqs.find(r => r.minPurchase)

  const bestDiscount = discounts[0]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <BackButton label={promo.commerce.name} />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">

        {/* ── HERO ── */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl overflow-hidden shadow-lg">
          <div className="px-6 pt-6 pb-5 text-white">
            {/* Categoría */}
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
              {promo.category.icon} {promo.category.name}
            </span>

            {/* Beneficio principal — grande */}
            <div className="mt-2 mb-1">
              {discounts.length === 1 ? (
                <p className="text-5xl font-black tracking-tight leading-none">
                  {discountLabel(bestDiscount)}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 items-end">
                  {discounts.map((d, i) => (
                    <span key={i} className={`font-black tracking-tight leading-none ${i === 0 ? 'text-5xl' : 'text-3xl text-indigo-300'}`}>
                      {discountLabel(d)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comercio */}
            <p className="text-indigo-200 text-sm font-semibold mt-2">{promo.commerce.name}</p>
          </div>

          {/* Título de la promo */}
          {promo.title && promo.title !== promo.commerce.name && (
            <div className="bg-white/10 px-6 py-3 border-t border-white/10">
              <p className="text-white text-sm font-medium leading-snug">{promo.title}</p>
            </div>
          )}
        </div>

        {/* ── VIGENCIA ── */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vigencia</p>

          {/* Días de la semana */}
          {specificDates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {specificDates.map(d => {
                const [y, m, day] = d.split('-')
                return (
                  <span key={d} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl">
                    {day}/{m}/{y}
                  </span>
                )
              })}
            </div>
          ) : (
            <div className="flex gap-1.5">
              {DAYS_ROW.map(({ label, bit }) => {
                const active = !promo.validDays || promo.validDays === 127 || (promo.validDays & bit) !== 0
                return (
                  <div
                    key={label}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-300'
                    }`}
                  >
                    {label}
                  </div>
                )
              })}
            </div>
          )}

          {/* Rango de fechas */}
          {(promo.validFrom || promo.validUntil) && (
            <p className="text-xs text-gray-500">
              {promo.validFrom && `Desde ${formatDate(promo.validFrom)}`}
              {promo.validFrom && promo.validUntil && ' · '}
              {promo.validUntil && `Vence ${formatDate(promo.validUntil)}`}
            </p>
          )}

          {/* Tope y mínimo */}
          {(capReq || minReq) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {capReq && (
                <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-xl">
                  <span className="text-sm">🔒</span>
                  <div>
                    <p className="text-[11px] font-black">Tope ${capReq.cap!.toLocaleString('es-AR')}</p>
                    {capReq.capPeriod && (
                      <p className="text-[10px] font-medium opacity-70">
                        {capReq.capPeriod === 'MONTHLY' ? 'por mes' : capReq.capPeriod === 'WEEKLY' ? 'por semana' : 'por día'}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {minReq && (
                <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-xl">
                  <span className="text-sm">🛒</span>
                  <div>
                    <p className="text-[11px] font-black">Mín. ${minReq.minPurchase!.toLocaleString('es-AR')}</p>
                    <p className="text-[10px] font-medium opacity-70">de compra</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CON QUÉ PAGÁS ── */}
        {(banks.length > 0 || wallets.length > 0 || networks.length > 0 || channels.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Con qué pagás</p>

            {/* Bancos */}
            {banks.length > 0 && (
              <div className="space-y-2">
                {banks.map(b => (
                  <div key={b.name} className="flex items-center gap-3">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="w-8 h-8 rounded-lg object-contain border border-gray-100 p-0.5 bg-white shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                        {b.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                      <p className="text-[10px] text-gray-400">Banco</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Billeteras */}
            {wallets.length > 0 && (
              <div className="space-y-2">
                {wallets.map(w => (
                  <div key={w.name} className="flex items-center gap-3">
                    {w.logoUrl ? (
                      <img src={w.logoUrl} alt={w.name} className="w-8 h-8 rounded-lg object-contain border border-gray-100 p-0.5 bg-white shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                        {w.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                      <p className="text-[10px] text-gray-400">Billetera digital</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Redes de tarjeta */}
            {networks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {networks.map(n => {
                  const types = Array.from(n.types)
                  const typeLabel = types.includes('CREDIT') && types.includes('DEBIT') ? 'Crédito y débito'
                    : types.includes('CREDIT') ? 'Crédito'
                    : types.includes('DEBIT') ? 'Débito'
                    : types[0] === 'PREPAID' ? 'Prepaga' : ''
                  return (
                    <div key={n.slug} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                      {CARD_NETWORK_LOGOS[n.slug] && (
                        <img src={CARD_NETWORK_LOGOS[n.slug]} alt={n.name} className="w-5 h-5 object-contain" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-800">{n.name}</p>
                        {typeLabel && <p className="text-[10px] text-gray-400">{typeLabel}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Canal de pago */}
            {channels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {channels.map(ch => (
                  <span key={ch} className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl">
                    {CHANNEL_LABEL[ch] ?? ch}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SUCURSALES ── */}
        {branches.length > 0 && (
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(promo.commerce.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:bg-emerald-50 transition-colors"
          >
            <span className="text-2xl shrink-0">📍</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">Ver sucursales en Google Maps</p>
              <p className="text-xs text-gray-400">{promo.commerce.name}</p>
            </div>
            <span className="text-emerald-600 font-black text-sm shrink-0">→</span>
          </a>
        )}

        {/* ── LEGALES ── */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Legales</p>

          {promo.sourceText ? (
            <details>
              <summary className="text-xs font-semibold text-indigo-600 cursor-pointer select-none list-none flex items-center gap-1">
                <span>Ver términos y condiciones</span>
                <span className="text-gray-300">▾</span>
              </summary>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-3 whitespace-pre-line">
                {promo.sourceText.slice(0, 3000)}{promo.sourceText.length > 3000 ? '…' : ''}
              </p>
            </details>
          ) : (
            <p className="text-xs text-gray-400">No disponemos del texto legal de esta promoción.</p>
          )}

          {promo.sourceUrl && (
            <a
              href={promo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
            >
              <span>🔗</span> Ver fuente oficial
            </a>
          )}
        </div>

      </div>

      {/* ── CTA viral ── */}
      <div className="max-w-lg mx-auto px-4 pb-4 mt-3">
        <a
          href="/promos"
          className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-3xl px-5 py-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-0.5">¿Querés ver tus promos?</p>
            <p className="text-sm font-black">Ver todas las promos de mis tarjetas →</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">
            🎯
          </div>
        </a>
      </div>

      <BottomNav />
    </div>
  )
}
