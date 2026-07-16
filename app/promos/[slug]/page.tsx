import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import BottomNav from '@/app/components/BottomNav'
import BackButton from '@/app/components/BackButton'
import { schemaOffer } from '@/lib/schema'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export const revalidate = 3600

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

function buildDaysLabel(mask: number | null): string {
  if (!mask || mask === 127) return 'todos los días'
  if (mask === 62) return 'de lunes a viernes'
  if (mask === 65) return 'los fines de semana'
  if (mask === 97) return 'los viernes, sábados y domingos'
  if (mask === 96) return 'los viernes y sábados'
  if (mask === 126) return 'de lunes a sábado'
  if (mask === 63) return 'de domingo a viernes'
  const names = ['domingos','lunes','martes','miércoles','jueves','viernes','sábados']
  const active = Array.from({ length: 7 }, (_, i) => (mask & (1 << i)) ? names[i] : null).filter(Boolean) as string[]
  if (active.length === 1) return `los ${active[0]}`
  return `los ${active.slice(0, -1).join(', ')} y ${active[active.length - 1]}`
}

function buildSeoDescription(promo: { commerce: { name: string }; category: { name: string }; validDays: number | null; validUntil: Date | null }, discount: string, bankWallet: string, networkNames: string[]): string {
  const parts: string[] = []
  let lead = `${promo.commerce.name} ofrece ${discount}`
  if (bankWallet) lead += ` con ${bankWallet}`
  parts.push(lead + '.')
  if (networkNames.length > 0) parts.push(`Pagá con tarjeta ${networkNames.join(' o ')}.`)
  const days = buildDaysLabel(promo.validDays)
  if (days !== 'todos los días') parts.push(`Válido ${days}.`)
  if (promo.validUntil) parts.push(`Vigente hasta el ${formatDate(promo.validUntil)}.`)
  parts.push(`Categoría: ${promo.category.name}.`)
  return parts.join(' ')
}

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
      requirements: { include: { bank: true, wallet: true, cardNetwork: true }, orderBy: { discountValue: 'desc' } },
    },
  })
  if (!promo) return { title: 'Promociones bancarias en Argentina | PromoAR' }
  const bestReq = promo.requirements[0]
  const discount = bestReq ? discountLabel(bestReq) : ''
  const bankWallet = bestReq?.bank?.name || bestReq?.wallet?.name || ''
  const networkNames = [...new Set(promo.requirements.flatMap(r => r.cardNetwork ? [r.cardNetwork.name] : []))]
  const title = `${discount} en ${promo.commerce.name}${bankWallet ? ` con ${bankWallet}` : ''}`
  const description = buildSeoDescription(promo, discount, bankWallet, networkNames)
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      locale: 'es_AR',
      url: `${BASE_URL}/promos/${params.slug}`,
      images: promo.commerce.logoUrl ? [{ url: promo.commerce.logoUrl, alt: promo.commerce.name }] : undefined,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE_URL}/promos/${params.slug}` },
  }
}

export async function generateStaticParams() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', slug: { not: null } },
    select: { slug: true },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
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

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  // Promo borrada de la DB (expirada y purgada por el scraper) → redirect 301
  // al comercio si se puede reconocer por el prefijo del slug, para que Google
  // actualice el índice y deje de re-pedir esta URL muerta en cada crawl
  // (evita 2 queries extra a Prisma en cada hit repetido de bots a URLs viejas).
  if (!promo) {
    const guessedSlug = params.slug.split('-')[0]
    const guessedCommerce = guessedSlug
      ? await prisma.commerce.findFirst({ where: { slug: guessedSlug }, select: { slug: true } })
      : null

    if (guessedCommerce) {
      redirect(`/comercios/${guessedCommerce.slug}`)
    }

    notFound()
  }

  const isExpired = promo.status === 'EXPIRED' || (promo.validUntil != null && promo.validUntil < startOfToday)

  // Promo vencida — página 200 con link a promos vigentes del mismo comercio (sin query extra a Prisma)
  if (isExpired) {
    const firstReq = promo.requirements[0]
    const entityName = firstReq?.bank?.name ?? firstReq?.wallet?.name ?? null
    const entitySlug = firstReq?.bank?.slug ?? firstReq?.wallet?.slug ?? null
    const entityType = firstReq?.bank ? 'bancos' : firstReq?.wallet ? 'bancos' : null

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <BackButton label={promo.commerce.name} />
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

          {/* Banner vencida */}
          <div className="bg-gray-100 border border-gray-200 rounded-3xl px-6 py-8 text-center space-y-2">
            <p className="text-4xl">⏰</p>
            <p className="text-lg font-black text-gray-700">Esta promo ya venció</p>
            <p className="text-sm text-gray-500">
              La promoción de <span className="font-semibold">{promo.commerce.name}</span> ya no está vigente.
            </p>
          </div>

          {/* Link a entidad */}
          {entitySlug && entityType && (
            <a
              href={`/${entityType}/${entitySlug}`}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:bg-indigo-50 transition-colors"
            >
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Ver promos vigentes</p>
                <p className="text-sm font-black text-gray-800">{entityName} →</p>
              </div>
            </a>
          )}

          {/* Link a promos vigentes del mismo comercio (sin query extra a Prisma) */}
          {promo.commerce.slug && (
            <a
              href={`/comercios/${promo.commerce.slug}`}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:bg-indigo-50 transition-colors"
            >
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Ver promos vigentes</p>
                <p className="text-sm font-black text-gray-800">en {promo.commerce.name} →</p>
              </div>
            </a>
          )}

          {/* CTA general */}
          <a
            href="/promos"
            className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-3xl px-5 py-4 shadow-lg"
          >
            <div>
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-0.5">¿Querés ver tus promos?</p>
              <p className="text-sm font-black">Ver todas las promos →</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">🎯</div>
          </a>
        </div>
        <BottomNav />
      </div>
    )
  }

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
  const capUnlimited = !capReq && reqs.some(r => (r as any).capUnlimited)
  const minReq = reqs.find(r => r.minPurchase)

  const bestDiscount = discounts[0]

  const jsonLd = schemaOffer({
    name: `${discountLabel(bestDiscount)} en ${promo.commerce.name}`,
    description: promo.title !== promo.commerce.name ? promo.title : promo.description,
    url: `${BASE_URL}/promos/${promo.slug}`,
    sellerName: promo.commerce.name,
    validFrom: promo.validFrom,
    validThrough: promo.validUntil,
    image: promo.commerce.logoUrl,
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BackButton label={promo.commerce.name} />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">

        {/* ── HERO ── */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl overflow-hidden shadow-lg relative">
          {promo.salesChannel && (
            <div className="absolute top-0 left-0 z-10 bg-yellow-400 text-red-600 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-br-xl">
              {promo.salesChannel === 'ONLINE' ? 'Exclusivo Online' : 'Exclusivo Físico'}
            </div>
          )}
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

        {/* ── PÁRRAFO SEO ── */}
        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed px-1 text-justify">
          {buildSeoDescription(
            { commerce: promo.commerce, category: promo.category, validDays: promo.validDays, validUntil: promo.validUntil },
            discountLabel(bestDiscount),
            banks[0]?.name ?? wallets[0]?.name ?? '',
            networks.map(n => n.name),
          )}
        </p>

        {/* ── CTA temprano (arriba del fold, antes de vigencia/legales) ── */}
        <a
          href="/promos"
          className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-2xl px-5 py-3.5 shadow-md hover:shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <p className="text-sm font-black">Ver más promos como esta →</p>
          <div className="w-8 h-8 rounded-xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-sm">
            🎯
          </div>
        </a>

        {/* ── NOTA / CONDICIÓN ESPECIAL ── */}
        {promo.commerceNote && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <span className="text-base shrink-0">⚠️</span>
            <p className="text-xs text-amber-800 leading-relaxed">{promo.commerceNote}</p>
          </div>
        )}

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
          {(capReq || capUnlimited || minReq) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {capUnlimited && (
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <span className="text-sm">✅</span>
                  <p className="text-[11px] font-black">Sin tope de reintegro</p>
                </div>
              )}
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
