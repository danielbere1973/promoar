import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import BottomNav from '@/app/components/BottomNav'
import BackButton from '@/app/components/BackButton'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDays(mask: number): string {
  if (!mask || mask === 127) return 'Todos los días'
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const active = days.filter((_, i) => (mask & (1 << i)) !== 0)
  if (active.length === 2 && (mask & 1) && (mask & 64)) return 'Sábados y domingos'
  if (active.length === 5 && !(mask & 1) && !(mask & 64)) return 'Lunes a viernes'
  return active.join(', ')
}

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
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Metadata dinámica ────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const promo = await prisma.promo.findUnique({
    where: { slug: params.slug },
    include: {
      commerce: true,
      category: true,
      requirements: {
        include: { bank: true, wallet: true },
        take: 1,
        orderBy: { discountValue: 'desc' },
      },
    },
  })

  if (!promo) {
    return { title: 'Promoción no encontrada — PromoAR' }
  }

  const bestReq = promo.requirements[0]
  const discount = bestReq ? discountLabel(bestReq) : ''
  const bankWallet = bestReq?.bank?.name || bestReq?.wallet?.name || ''

  const title = `${discount} en ${promo.commerce.name}${bankWallet ? ` con ${bankWallet}` : ''} — PromoAR`
  const description = promo.description ||
    `Aprovechá ${discount} en ${promo.commerce.name}. ${formatDays(promo.validDays)}. ${promo.category.name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      locale: 'es_AR',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

// ─── generateStaticParams (ISR) ──────────────────────────────────────────────

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
        include: {
          bank: true,
          wallet: true,
          cardNetwork: true,
        },
        orderBy: { discountValue: 'desc' },
      },
    },
  })

  if (!promo || promo.status === 'EXPIRED') notFound()

  const bestDiscount = promo.requirements[0]
  const specificDates: string[] = promo.specificDates ? JSON.parse(promo.specificDates) : []

  const categoryColors: Record<string, string> = {
    'Supermercados': 'bg-green-50 text-green-700',
    'Gastronomía':   'bg-orange-50 text-orange-700',
    'Combustible':   'bg-blue-50 text-blue-700',
    'Farmacias':     'bg-red-50 text-red-700',
    'Petshops':      'bg-yellow-50 text-yellow-700',
    'Tecnología':    'bg-purple-50 text-purple-700',
    'Indumentaria':  'bg-pink-50 text-pink-700',
    'Transporte':    'bg-indigo-50 text-indigo-700',
  }
  const catColor = categoryColors[promo.category.name] ?? 'bg-gray-50 text-gray-700'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <BackButton label={promo.commerce.name} />

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* Hero card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-8 text-white text-center">
            <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full mb-3 ${catColor}`}>
              {promo.category.name}
            </span>
            <div className="text-5xl font-black tracking-tight">
              {bestDiscount ? discountLabel(bestDiscount) : '—'}
            </div>
            <p className="text-indigo-200 text-sm mt-2 font-medium">{promo.commerce.name}</p>
          </div>

          <div className="px-6 py-5 space-y-3">
            <h2 className="font-bold text-gray-900 text-base leading-snug">{promo.title}</h2>
            {promo.description && (
              <p className="text-sm text-gray-500 leading-relaxed">{promo.description}</p>
            )}
          </div>
        </div>

        {/* Vigencia */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vigencia</p>
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
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">{formatDays(promo.validDays)}</p>
              {(promo.validFrom || promo.validUntil) && (
                <p className="text-xs text-gray-400">
                  {promo.validFrom && `Desde ${formatDate(promo.validFrom)}`}
                  {promo.validFrom && promo.validUntil && ' · '}
                  {promo.validUntil && `Vence ${formatDate(promo.validUntil)}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Condiciones */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Condiciones</p>
          <div className="space-y-3">
            {promo.requirements.map((req, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-indigo-600">{discountLabel(req).split(' ')[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{discountLabel(req)}</p>
                  <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                    {req.bank && <p>Banco: {req.bank.name}</p>}
                    {req.wallet && <p>Billetera: {req.wallet.name}</p>}
                    {req.cardNetwork && (
                      <p>{req.cardNetwork.name}{req.cardType ? ` ${req.cardType === 'CREDIT' ? 'Crédito' : req.cardType === 'DEBIT' ? 'Débito' : 'Prepaga'}` : ''}</p>
                    )}
                    {req.paymentChannel && req.paymentChannel !== 'ANY' && (
                      <p>Canal: {req.paymentChannel === 'QR' ? 'QR' : req.paymentChannel === 'NFC' ? 'Sin contacto (NFC)' : req.paymentChannel}</p>
                    )}
                    {req.accountType && req.accountType !== 'ANY' && (
                      <p>{req.accountType === 'HABERES' ? 'Plan sueldo / haberes' : req.accountType === 'JUBILADO' ? 'Jubilados' : req.accountType}</p>
                    )}
                    {req.cap && (
                      <p>Tope: ${req.cap.toLocaleString('es-AR')}{req.capPeriod ? ` por ${req.capPeriod === 'MONTHLY' ? 'mes' : req.capPeriod === 'WEEKLY' ? 'semana' : 'día'}` : ''}</p>
                    )}
                    {req.minPurchase && (
                      <p>Mínimo de compra: ${req.minPurchase.toLocaleString('es-AR')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legales */}
        {promo.sourceText && (
          <details className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <summary className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer select-none">
              Legales completos
            </summary>
            <p className="text-[10px] text-gray-400 leading-relaxed mt-3 whitespace-pre-line">
              {promo.sourceText.slice(0, 2000)}{promo.sourceText.length > 2000 ? '...' : ''}
            </p>
          </details>
        )}

        {/* Fuente */}
        {promo.sourceUrl && (
          <div className="text-center">
            <a
              href={promo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
            >
              Ver fuente oficial
            </a>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
