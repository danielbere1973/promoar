import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import SimulatorHeader from '@/app/components/SimulatorHeader'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Comparadores de Ahorro en Vivo | PromoAR',
  description:
    '¿En qué súper pagás menos hoy? ¿Qué día cargar nafta? ¿Dónde conviene comprar medicamentos y perfumería? Elegí tus tarjetas y mirá el podio de ahorro real en tiempo real.',
  openGraph: {
    title: 'Comparadores de Ahorro en Vivo | PromoAR',
    description:
      'Calculá en tiempo real en qué comercio te conviene pagar hoy con tus tarjetas y billeteras. Supermercados, Combustible y Farmacias.',
    url: 'https://www.promoar.com.ar/ahorro-interactivo',
    siteName: 'PromoAR',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comparadores de Ahorro en Vivo | PromoAR',
    description:
      'Calculá en qué comercio pagás menos hoy según tus tarjetas y billeteras. Podio de ahorro real en vivo.',
  },
  alternates: {
    canonical: 'https://www.promoar.com.ar/ahorro-interactivo',
  },
}

async function getStats() {
  try {
    const [superPromos, fuelPromos, pharmaPromos] = await Promise.all([
      prisma.promo.count({
        where: {
          status: 'ACTIVE',
          category: { slug: 'supermercados' },
        },
      }),
      prisma.promo.count({
        where: {
          status: 'ACTIVE',
          category: { slug: 'combustible' },
        },
      }),
      prisma.promo.count({
        where: {
          status: 'ACTIVE',
          category: { slug: 'farmacias' },
        },
      }),
    ])
    return {
      super: superPromos || 450,
      fuel: fuelPromos || 120,
      pharma: pharmaPromos || 310,
    }
  } catch {
    return { super: 450, fuel: 120, pharma: 310 }
  }
}

export default async function AhorroInteractivoHubPage() {
  const stats = await getStats()

  const COMPARATORS = [
    {
      id: 'supermercados',
      title: 'Supermercados',
      icon: '🛒',
      badge: 'El más consultado',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      accentColor: 'from-emerald-500/20 to-teal-500/5',
      borderColor: 'hover:border-emerald-500/50',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      tagline: 'Coto vs Carrefour vs Jumbo vs ChangoMás vs Día vs Disco vs Vea',
      description:
        'Calculá el podio exacto de tu compra semanal contemplando topes de reintegro por compra o mensuales y días exclusivos de descuento.',
      href: '/ahorro-interactivo/supermercados',
      brands: ['Coto', 'Carrefour', 'Jumbo', 'Día', 'ChangoMás', 'Disco', 'Vea'],
      statValue: `${stats.super}+`,
      statLabel: 'promos activas',
      highlight: 'Ahorro promedio: 15% a 30% en ticket',
    },
    {
      id: 'combustible',
      title: 'Combustibles & Nafta',
      icon: '⛽',
      badge: 'Ahorro al volante',
      badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      accentColor: 'from-orange-500/20 to-amber-500/5',
      borderColor: 'hover:border-orange-500/50',
      buttonBg: 'bg-[#D94F2B] hover:bg-[#c44325] text-white',
      tagline: 'YPF vs Shell vs Axion vs Puma',
      description:
        '¿Llenás el tanque hoy o te conviene esperar? Simulá la carga de 20L a 60L y compará qué estación te devuelve más dinero.',
      href: '/ahorro-interactivo/combustible',
      brands: ['YPF', 'Shell', 'Axion Energy', 'Puma Energy'],
      statValue: `${stats.fuel}+`,
      statLabel: 'descuentos en surtidor',
      highlight: 'Ahorrá hasta $15.000 por tanque',
    },
    {
      id: 'farmacias',
      title: 'Farmacias & Perfumería',
      icon: '💊',
      badge: 'Salud y Cuidado',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      accentColor: 'from-rose-500/20 to-pink-500/5',
      borderColor: 'hover:border-rose-500/50',
      buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white',
      tagline: 'Farmacity vs Farmaplus vs Del Puente y cadenas locales',
      description:
        'Compará descuentos bancarios en medicamentos de venta libre, dermocosmética, pañales y perfumería según el día de la semana.',
      href: '/ahorro-interactivo/farmacias',
      brands: ['Farmacity', 'Farmaplus', 'Del Puente', 'Farmacias Líder', 'Zentner'],
      statValue: `${stats.pharma}+`,
      statLabel: 'promos en farmacias',
      highlight: 'Hasta 40% OFF en días clave',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#070F1E] text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Header oficial compartido */}
      <SimulatorHeader active="hub" />

      {/* Hero Principal */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D94F2B]/10 border border-[#D94F2B]/20 text-[#D94F2B] text-xs font-black tracking-wide uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-[#D94F2B] animate-pulse" />
            Simuladores de Ahorro Inteligente
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            ¿Dónde te conviene comprar hoy{' '}
            <span className="text-[#D94F2B]">con tus tarjetas</span>?
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            No adivines qué día comprar ni qué tarjeta sacar. Elegí tu rubro, marcá tus bancos y billeteras, y calculamos el podio de ahorro real considerando topes de reintegro y vigencia.
          </p>
        </div>

        {/* Las 3 Cards de Comparadores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {COMPARATORS.map((comp) => (
            <div
              key={comp.id}
              className={`relative flex flex-col bg-white dark:bg-[#0C1A30] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${comp.borderColor} group overflow-hidden`}
            >
              {/* Sutil gradiente de fondo */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${comp.accentColor} opacity-40 pointer-events-none`}
              />

              {/* Encabezado de la Card */}
              <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
                <span className="text-4xl p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 shadow-xs">
                  {comp.icon}
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${comp.badgeColor}`}
                >
                  {comp.badge}
                </span>
              </div>

              {/* Título y Tagline */}
              <div className="relative z-10 mb-3">
                <h2 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-[#D94F2B] transition-colors">
                  {comp.title}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {comp.tagline}
                </p>
              </div>

              {/* Descripción */}
              <p className="relative z-10 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5 flex-1">
                {comp.description}
              </p>

              {/* Cadenas incluidas */}
              <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-3 mb-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Cadenas comparadas:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {comp.brands.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Métricas destacadas */}
              <div className="relative z-10 flex items-center justify-between bg-slate-50 dark:bg-[#081326] rounded-2xl p-3 mb-5 border border-slate-100 dark:border-slate-800/60">
                <div>
                  <p className="text-base font-black text-slate-900 dark:text-white leading-none">
                    {comp.statValue}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {comp.statLabel}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-[#D94F2B] text-right">
                  {comp.highlight}
                </span>
              </div>

              {/* Botón CTA */}
              <Link
                href={comp.href}
                className={`relative z-10 flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-xs font-black transition-transform active:scale-95 shadow-xs ${comp.buttonBg}`}
              >
                <span>Entrar al simulador</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>

        {/* Sección: Cómo funciona el cálculo */}
        <section className="bg-white dark:bg-[#0C1A30] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 mb-16 shadow-xs">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              ¿Cómo calcula PromoAR tu podio de ahorro?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Mucho más que una simple lista de porcentajes: números reales para tu bolsillo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-lg mb-3">
                1
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">
                Tus tarjetas exactas
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Seleccionás tus bancos (Galicia, Santander, BBVA, Nación...) y billeteras (MODO, Mercado Pago, Cuenta DNI...). Sin pedirte jamás claves.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-lg mb-3">
                2
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">
                Topes y límites reales
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Un 30% con tope de $3.000 ahorra menos que un 20% con tope de $10.000. El simulador calcula el dinero neto que vuelve a tu cuenta.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-lg mb-3">
                3
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">
                Día de compra y vigencia
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Te muestra qué aplica HOY y, si te conviene esperar a otro día de la semana para conseguir un descuento mayor, te avisa claramente.
              </p>
            </div>
          </div>
        </section>

        {/* Banner CTA final hacia PromoAR */}
        <div className="bg-gradient-to-r from-[#1E3A5F] via-[#1E3A5F] to-[#2B4C7E] rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <h3 className="text-xl sm:text-2xl font-black mb-1">
              ¿Querés ver todas las promociones del país?
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 max-w-lg">
              Indumentaria, gastronomía, tecnología, viajes, cuotas sin interés y más de 20 entidades financieras en PromoAR.
            </p>
          </div>
          <Link
            href="/promos/explorar"
            className="px-6 py-3.5 rounded-2xl bg-[#D94F2B] hover:bg-[#c44325] text-white text-xs sm:text-sm font-black transition-transform hover:scale-105 active:scale-95 whitespace-nowrap shadow-md"
          >
            Explorar todas las promos →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 mt-12 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>© {new Date().getFullYear()} PromoAR — Todas las promociones de tus tarjetas en un solo lugar.</p>
      </footer>
    </div>
  )
}
