import { notFound, redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import BottomNav from '@/app/components/BottomNav'
import BackButton from '@/app/components/BackButton'
import DetailSidebar from './DetailSidebar'
import { schemaOffer } from '@/lib/schema'
import { PROMO_DETAIL_TAG } from '@/lib/cache/detailCache'
import { getPromoScope } from '@/lib/utils/promoScope'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export const revalidate = false

const getCachedPromoBySlug = unstable_cache(
  async (slug: string) => prisma.promo.findUnique({
    where: { slug },
    include: {
      commerce: true,
      category: true,
      requirements: {
        include: { bank: true, wallet: true, cardNetwork: true },
        orderBy: { discountValue: 'desc' },
      },
    },
  }),
  ['promo-detail-by-slug'],
  { tags: [PROMO_DETAIL_TAG], revalidate: false },
)

const getCachedCommerceBranchesCount = unstable_cache(
  async (commerceId: string) => prisma.commerceBranch.findMany({
    where: { commerceId },
    take: 1,
  }),
  ['promo-detail-commerce-branches'],
  { tags: [PROMO_DETAIL_TAG], revalidate: false },
)

// Otras promos activas del mismo comercio con bancos/billeteras distintos — alimenta
// el comparador del hero (principio tomado de Manguito: grid con condición real por
// opción, nunca solo el dato repetido). Se trae por comercio, no por promo individual,
// para que el comparador no dependa de la promo actual estar en el top del ranking.
const getCachedCommerceOtherPromos = unstable_cache(
  async (commerceId: string, excludePromoId: string) => prisma.promo.findMany({
    where: { commerceId, status: 'ACTIVE', id: { not: excludePromoId } },
    include: {
      requirements: {
        include: { bank: true, wallet: true },
        orderBy: { discountValue: 'desc' },
        take: 1,
      },
    },
    orderBy: { maxDiscountPct: 'desc' },
    take: 6,
  }),
  ['promo-detail-commerce-other-promos'],
  { tags: [PROMO_DETAIL_TAG], revalidate: false },
)

// Descubrimiento cruzado ("También te podría interesar"): otros comercios con
// promo activa, de categorías distintas a la actual, ordenados por popularidad
// (activePromoCount) — no es un comparador del mismo comercio, es variedad real.
const getCachedRelatedCommerces = unstable_cache(
  async (excludeCategoryId: string, excludeCommerceId: string) => prisma.commerce.findMany({
    where: {
      defaultCategoryId: { not: excludeCategoryId },
      id: { not: excludeCommerceId },
      activePromoCount: { gt: 0 },
    },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      defaultCategory: { select: { name: true, icon: true } },
      promos: {
        where: { status: 'ACTIVE' },
        select: { requirements: { orderBy: { discountValue: 'desc' }, take: 1, select: { discountValue: true, discountType: true } } },
        orderBy: { maxDiscountPct: 'desc' },
        take: 1,
      },
    },
    orderBy: { activePromoCount: 'desc' },
    take: 8,
  }),
  ['promo-detail-related-commerces'],
  { tags: [PROMO_DETAIL_TAG], revalidate: false },
)

// Slugs de promos borradas (expiradas y purgadas) son re-pedidos por bots una y
// otra vez sin que cambien nunca — cachear el intento de redirect evita repetir
// la query a Prisma en cada re-crawl del mismo slug muerto.
const getCachedGuessedCommerceSlug = unstable_cache(
  async (guessedSlug: string) => prisma.commerce.findFirst({
    where: { slug: guessedSlug },
    select: { slug: true },
  }),
  ['promo-detail-guessed-commerce'],
  { tags: [PROMO_DETAIL_TAG], revalidate: false },
)

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

// Tag de condición real para el comparador (Variante E): tope > día > canal > "todos los días" por defecto.
// Nunca vacío — un tag vacío es lo que hace que un comparador se sienta decorativo en vez de útil.
function conditionTag(req: any, validDays: number | null): string {
  if (req?.cap) {
    const period = req.capPeriod === 'MONTHLY' ? 'por mes' : req.capPeriod === 'WEEKLY' ? 'por semana' : 'por día'
    return `Tope $${req.cap.toLocaleString('es-AR')} ${period}`
  }
  if (validDays && validDays !== 127) {
    const label = buildDaysLabel(validDays)
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  if (req?.paymentChannel && req.paymentChannel !== 'ANY') {
    return CHANNEL_LABEL[req.paymentChannel] ?? req.paymentChannel
  }
  return 'Todos los días'
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
  const promo = await getCachedPromoBySlug(params.slug)
  if (!promo) return { title: 'Promociones bancarias en Argentina | PromoAR' }
  const bestReq = promo.requirements[0]
  const discount = bestReq ? discountLabel(bestReq) : ''
  const bankWallet = bestReq?.bank?.name || bestReq?.wallet?.name || ''
  const networkNames = [...new Set(promo.requirements.flatMap(r => r.cardNetwork ? [r.cardNetwork.name] : []))]
  const title = `${discount} en ${promo.commerce.name}${bankWallet ? ` con ${bankWallet}` : ''}`
  const description = buildSeoDescription(promo, discount, bankWallet, networkNames)

  // Post mortem (0-7 días vencida): noindex para que Google la retire del índice
  // antes de que el día 8 pase a 404 real (ver PromoDetailPage)
  const validUntilDate = promo.validUntil ? new Date(promo.validUntil) : null
  const isExpiredNow = promo.status === 'EXPIRED' || (validUntilDate != null && validUntilDate < new Date())
  const robots = isExpiredNow ? { index: false, follow: true } : undefined

  return {
    title,
    description,
    robots,
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

// Pre-generar solo un top chico en build time (dynamicParams=true por default
// genera el resto on-demand en el primer request y lo cachea, gracias a
// revalidate=false más arriba). Con 2000 params, el build competía por el
// pool de Neon (connection_limit=3 en producción) contra si mismo y otras
// rutas con generateStaticParams (bancos, comercios) y tiraba P2024.
export async function generateStaticParams() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', slug: { not: null } },
    select: { slug: true },
    orderBy: { updatedAt: 'desc' },
    take: 150,
  })
  return promos.map(p => ({ slug: p.slug! }))
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PromoDetailPage({ params }: { params: { slug: string } }) {
  const [cachedPromo, session] = await Promise.all([
    getCachedPromoBySlug(params.slug),
    getServerSession(),
  ])
  // unstable_cache serializa el resultado como JSON: Date vuelve como string, hay que recomponerlo
  const promo = cachedPromo && {
    ...cachedPromo,
    validFrom: cachedPromo.validFrom ? new Date(cachedPromo.validFrom) : cachedPromo.validFrom,
    validUntil: cachedPromo.validUntil ? new Date(cachedPromo.validUntil) : cachedPromo.validUntil,
  }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  // Promo borrada de la DB (expirada y purgada por el scraper) → redirect 301
  // al comercio si se puede reconocer por el prefijo del slug, para que Google
  // actualice el índice y deje de re-pedir esta URL muerta en cada crawl
  // (evita 2 queries extra a Prisma en cada hit repetido de bots a URLs viejas).
  if (!promo) {
    const guessedSlug = params.slug.split('-')[0]
    const guessedCommerce = guessedSlug
      ? await getCachedGuessedCommerceSlug(guessedSlug)
      : null

    if (guessedCommerce) {
      redirect(`/comercios/${guessedCommerce.slug}`)
    }

    notFound()
  }

  const isExpired = promo.status === 'EXPIRED' || (promo.validUntil != null && promo.validUntil < startOfToday)

  // Post mortem: día 0-7 vencida → 200 + noindex (ver generateMetadata). Día 8+ →
  // 404 real, sin servir la página ni conservar la URL indexable. La fila de Promo
  // (y PromoUsageEvent/PromoUsage/SavedPromo/PromoReport que dependen de ella) no
  // se borra nunca — esto es puramente el estado público/SEO de la URL.
  if (isExpired && promo.validUntil != null) {
    const daysSinceExpiry = (startOfToday.getTime() - promo.validUntil.getTime()) / 86_400_000
    if (daysSinceExpiry > 7) {
      notFound()
    }
  }

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

  const isLoggedIn = !!session?.user?.email

  const [branches, otherPromosRaw, relatedCommercesRaw, userWithProfile] = await Promise.all([
    getCachedCommerceBranchesCount(promo.commerce.id),
    getCachedCommerceOtherPromos(promo.commerce.id, promo.id),
    getCachedRelatedCommerces(promo.category.id, promo.commerce.id),
    isLoggedIn
      ? prisma.user.findUnique({
          where: { email: session!.user!.email! },
          select: { financialProfile: { select: { id: true } } },
        })
      : null,
  ])

  const hasProfile = !!userWithProfile?.financialProfile

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
  const scope = getPromoScope(promo)

  // Comparador Variante E: otras promos activas del mismo comercio, con su propia
  // entidad + descuento + condición real. Si no hay ninguna, no se muestra el grid
  // (comercio con 1 sola promo activa es el caso más común — hero + CTA alcanza).
  const comparatorItems = otherPromosRaw.map((p: any) => {
    const req = p.requirements[0]
    const entityName = req?.bank?.name ?? req?.wallet?.name ?? 'Otro medio'
    return {
      slug: p.slug,
      entityName,
      initial: entityName[0]?.toUpperCase() ?? '?',
      discount: discountLabel(req),
      tag: conditionTag(req, p.validDays),
    }
  })

  const relatedCommerces = relatedCommercesRaw
    .filter((c: any) => c.promos[0]?.requirements[0])
    .map((c: any) => {
      const req = c.promos[0].requirements[0]
      return {
        slug: c.slug,
        name: c.name,
        logoUrl: c.logoUrl,
        categoryName: c.defaultCategory?.name ?? '',
        categoryIcon: c.defaultCategory?.icon ?? '🏪',
        discount: discountLabel(req),
      }
    })

  const bestEntityName = banks[0]?.name ?? wallets[0]?.name ?? ''
  const ctaHref = !isLoggedIn ? '/login?next=/promos' : hasProfile ? '/promos?for_me=true' : '/perfil'
  const ctaTitle = !isLoggedIn ? 'Decinos tus tarjetas' : hasProfile ? 'Ver mis promos' : 'Completá tu perfil'
  const ctaSubtitle = !isLoggedIn
    ? 'y te mostramos primero la que más te conviene'
    : hasProfile
    ? 'ordenadas según tus bancos y tarjetas'
    : 'y te mostramos primero la que más te conviene'

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
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0 lg:flex">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DetailSidebar />

      <div className="flex-1 min-w-0 lg:overflow-y-auto">
      <div className="lg:hidden">
        <BackButton label={promo.commerce.name} />
      </div>

      <div className="max-w-lg lg:max-w-none mx-auto px-4 lg:px-10 pt-4 lg:pt-7 space-y-3 lg:space-y-0">

        {/* ── BREADCRUMB DESKTOP ── */}
        <div className="hidden lg:flex items-center justify-between gap-2 mb-5">
          <div className="text-[13px] text-gray-400 font-semibold">
            <a href="/promos" className="text-gray-500 hover:text-gray-700">&larr; Promos</a>
            <span className="text-gray-300 mx-1.5">/</span>
            <a href={`/categorias/${promo.category.slug}`} className="text-gray-500 hover:text-gray-700">{promo.category.name}</a>
            <span className="text-gray-300 mx-1.5">/</span>
            <span className="text-[#1E3A5F]">{promo.commerce.name}</span>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[1.3fr_0.9fr] lg:gap-7 lg:items-start lg:max-w-[980px]">
        <div className="lg:flex lg:flex-col lg:gap-4 space-y-3 lg:space-y-0">

        {/* ── HEADER COMPACTO ── */}
        <div className="flex items-center gap-3 px-1 lg:hidden">
          {promo.commerce.logoUrl ? (
            <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="w-12 h-12 rounded-2xl object-contain border border-gray-100 bg-white p-1.5 shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-sm font-black text-gray-500 shrink-0">
              {promo.commerce.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-gray-900 leading-tight truncate">{promo.commerce.name}</p>
            <p className="text-[11px] text-gray-400">
              {promo.category.icon} {promo.category.name}
              {comparatorItems.length > 0 && ` · ${comparatorItems.length + 1} promos de ${comparatorItems.length + 1} bancos/billeteras`}
            </p>
          </div>
        </div>

        {/* ── HERO — único lugar con el dato destacado ── */}
        <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2a4f82] rounded-3xl overflow-hidden shadow-lg relative">
          {/* Header del hero en desktop: logo + nombre comercio dentro de la misma tarjeta */}
          <div className="hidden lg:flex items-center gap-3 px-6 pt-5">
            {promo.commerce.logoUrl ? (
              <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="w-11 h-11 rounded-xl object-contain border border-white/20 bg-white p-1.5 shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-sm font-black text-white shrink-0">
                {promo.commerce.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-white leading-tight truncate">{promo.commerce.name}</p>
              <p className="text-[11px] text-blue-200">
                {promo.category.icon} {promo.category.name}
                {comparatorItems.length > 0 && ` · ${comparatorItems.length + 1} promos de ${comparatorItems.length + 1} bancos/billeteras`}
              </p>
            </div>
          </div>
          {(promo.salesChannel === 'ONLINE' || promo.salesChannel === 'PHYSICAL') ? (
            <div className="absolute top-0 right-0 z-10 bg-yellow-400 text-red-600 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl">
              {promo.salesChannel === 'ONLINE' ? 'Exclusivo Online' : 'Exclusivo Físico'}
            </div>
          ) : !isExpired ? (
            <div className="absolute top-0 right-0 z-10 bg-[#D94F2B] text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl">
              Válido hoy
            </div>
          ) : null}
          <div className="px-6 pt-6 pb-5 text-white">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
              {comparatorItems.length > 0 ? `La mejor opción ahora: ${bestEntityName}` : bestEntityName}
            </span>

            <div className="mt-2 mb-1">
              {discounts.length === 1 ? (
                <p className="text-4xl font-black tracking-tight leading-none">
                  {discountLabel(bestDiscount)}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 items-end">
                  {discounts.map((d, i) => (
                    <span key={i} className={`font-black tracking-tight leading-none ${i === 0 ? 'text-4xl' : 'text-2xl text-blue-300'}`}>
                      {discountLabel(d)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Título de la promo */}
          {promo.title && promo.title !== promo.commerce.name && (
            <div className="bg-white/10 px-6 py-3 border-t border-white/10">
              <p className="text-white text-sm font-medium leading-snug">{promo.title}</p>
            </div>
          )}
        </div>

        {/* ── COMPARADOR: otras formas de pagar en el mismo comercio ── */}
        {comparatorItems.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[13px] font-black text-gray-900 px-1">Comparar formas de pagar</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border-2 border-[#1E3A5F] rounded-2xl px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">
                    {bestEntityName[0]?.toUpperCase() ?? '?'}
                  </div>
                  <p className="text-[11.5px] font-extrabold text-gray-900 truncate">{bestEntityName}</p>
                </div>
                <p className="text-xl font-black text-[#1E3A5F] leading-none mb-2">{discountLabel(bestDiscount)}</p>
                <span className="inline-block text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {conditionTag(reqs[0], promo.validDays)}
                </span>
              </div>
              {comparatorItems.map(item => (
                <a
                  key={item.slug}
                  href={`/promos/${item.slug}`}
                  className="bg-white border border-gray-200 rounded-2xl px-3.5 py-3 hover:border-[#1E3A5F]/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">
                      {item.initial}
                    </div>
                    <p className="text-[11.5px] font-extrabold text-gray-900 truncate">{item.entityName}</p>
                  </div>
                  <p className="text-xl font-black text-emerald-600 leading-none mb-2">{item.discount}</p>
                  <span className="inline-block text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                    {item.tag}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── PÁRRAFO SEO ── */}
        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed px-1 text-justify">
          {buildSeoDescription(
            { commerce: promo.commerce, category: promo.category, validDays: promo.validDays, validUntil: promo.validUntil },
            discountLabel(bestDiscount),
            banks[0]?.name ?? wallets[0]?.name ?? '',
            networks.map(n => n.name),
          )}
        </p>

        {/* ── CTA unificado: beneficio explícito, copy según estado de sesión ── */}
        <a
          href={ctaHref}
          className="pulse-loop flex items-center gap-3 bg-gray-900 rounded-2xl px-4 py-3.5 hover:bg-gray-800 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-[#D94F2B] flex items-center justify-center shrink-0 text-base">💳</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-white leading-tight">{ctaTitle}</p>
            <p className="text-[11px] text-gray-400">{ctaSubtitle}</p>
          </div>
          <span className="text-gray-500 text-lg shrink-0">→</span>
        </a>

        {/* ── ALERTA DE ALCANCE / CONDICIÓN RESTRINGIDA ── */}
        {scope && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40 rounded-2xl px-4 py-3.5 text-amber-900 dark:text-amber-200 shadow-sm">
            <span className="text-xl shrink-0 mt-0.5">{scope.badgeIcon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-tight uppercase text-amber-800 dark:text-amber-300">
                {scope.badgeText}
              </p>
              <p className="text-xs opacity-90 leading-relaxed mt-0.5">
                {scope.fullWarning}
              </p>
            </div>
          </div>
        )}

        {/* ── NOTA / CONDICIÓN ESPECIAL ADICIONAL ── */}
        {promo.commerceNote && (!scope || !scope.fullWarning.toLowerCase().includes(promo.commerceNote.toLowerCase())) && (
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
              href={`/api/r?url=${encodeURIComponent(promo.sourceUrl)}&promo=${promo.id}&src=promo_slug_page`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
            >
              <span>🔗</span> Ver fuente oficial
            </a>
          )}
        </div>

        </div>

        {/* ── TAMBIÉN TE PODRÍA INTERESAR — descubrimiento cruzado ── */}
        {relatedCommerces.length > 0 && (
          <div className="pt-1 lg:pt-0">
            <p className="text-[13px] font-black text-gray-900 px-1 lg:px-0 mb-2.5">También te podría interesar</p>

            {/* Mobile: scroll horizontal */}
            <div className="flex lg:hidden gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory">
              {relatedCommerces.map(c => (
                <a
                  key={c.slug}
                  href={`/promos/${c.slug}`}
                  className="shrink-0 w-[132px] snap-start bg-white border border-gray-100 rounded-2xl px-3 py-3"
                >
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="w-9 h-9 rounded-xl object-contain border border-gray-100 bg-white p-1 mb-2" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 mb-2">
                      {c.name[0]}
                    </div>
                  )}
                  <p className="text-[12px] font-extrabold text-gray-900 leading-tight truncate">{c.name}</p>
                  <p className="text-[10px] text-gray-400 mb-1">{c.categoryIcon} {c.categoryName}</p>
                  <p className="text-sm font-black text-emerald-600 leading-none">{c.discount}</p>
                </a>
              ))}
            </div>

            {/* Desktop: lista vertical en columna derecha */}
            <div className="hidden lg:flex flex-col gap-2">
              {relatedCommerces.map(c => (
                <a
                  key={c.slug}
                  href={`/promos/${c.slug}`}
                  className={`flex items-center gap-3 bg-white rounded-2xl px-3.5 py-3 border transition-colors hover:border-[#1E3A5F]/40 ${
                    c.name === 'Estación Mascotera' ? 'border-2 border-[#D94F2B]' : 'border-gray-100'
                  }`}
                >
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="w-10 h-10 rounded-xl object-contain border border-gray-100 bg-white p-1 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                      {c.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-extrabold text-gray-900 leading-tight truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-400">{c.categoryIcon} {c.categoryName}</p>
                  </div>
                  <p className="text-base font-black text-emerald-600 leading-none shrink-0">{c.discount}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        </div>

      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
      </div>
    </div>
  )
}
