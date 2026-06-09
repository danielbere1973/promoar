import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PromoAR — Todas las promos de tus tarjetas, en un lugar',
  description: 'Descubrí descuentos, cuotas sin interés y reintegros de tus bancos y billeteras. Galicia, BBVA, Santander, Nación, ICBC y más de 20 entidades. Gratis.',
  keywords: 'promociones bancarias, descuentos tarjetas, promos bancos argentina, cuotas sin interés',
  openGraph: {
    title: 'PromoAR — Todas las promos de tus tarjetas',
    description: 'Descubrí descuentos y cuotas sin interés de más de 20 bancos y billeteras. Filtrado por tu perfil financiero.',
    type: 'website',
  },
}

const BANKS = [
  { name: 'Galicia',    logo: 'https://www.google.com/s2/favicons?sz=128&domain=galicia.ar' },
  { name: 'BBVA',       logo: 'https://www.bbva.com.ar/favicon.ico' },
  { name: 'Santander',  logo: 'https://www.google.com/s2/favicons?sz=128&domain=santander.com.ar' },
  { name: 'Nación',     logo: 'https://www.google.com/s2/favicons?sz=128&domain=bna.com.ar' },
  { name: 'Macro',      logo: 'https://www.google.com/s2/favicons?sz=128&domain=macro.com.ar' },
  { name: 'ICBC',       logo: 'https://logo-teka.com/wp-content/uploads/2026/01/icbc-vertical-logo.svg' },
  { name: 'Naranja X',  logo: 'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com' },
  { name: 'Brubank',    logo: 'https://www.google.com/s2/favicons?sz=128&domain=brubank.com' },
  { name: 'Ciudad',     logo: 'https://www.bancociudad.com.ar/beneficios/assets/img/logo-banco-ciudad.svg' },
  { name: 'Uala',       logo: 'https://www.google.com/s2/favicons?sz=128&domain=ualabee.com' },
]

const FEATURES = [
  { icon: '🏷️', title: 'Promos personalizadas', desc: 'Solo ves las promos de tus bancos y tarjetas. Sin ruido, sin promos que no te aplican.' },
  { icon: '⭐', title: 'Favoritos y alertas', desc: 'Guardá tus categorías favoritas y comercios de cabecera para encontrarlos rápido.' },
  { icon: '🔍', title: 'Buscar por producto', desc: '"¿Dónde compro zapatillas con descuento?" La búsqueda inteligente conecta productos con promos.' },
  { icon: '📈', title: 'Tasas en tiempo real', desc: 'Plazos fijos, FCI y tasas de billeteras actualizados diariamente. El único comparador que une promos con finanzas.' },
  { icon: '📅', title: 'Promos de hoy y semana', desc: 'Filtrá por día para saber exactamente qué promos aplican hoy o este fin de semana.' },
  { icon: '🏦', title: 'Todos tus bancos', desc: 'Galicia, BBVA, Santander, Nación, ICBC, Supervielle y 15+ bancos y billeteras más.' },
]

const TESTIMONIALS = [
  { name: 'Martina R.', city: 'Buenos Aires', text: 'Antes perdía promos porque no me acordaba de revisar cada app. Ahora en 30 segundos sé qué descuentos tengo para el supermercado.', rating: 5 },
  { name: 'Diego L.', city: 'Córdoba', text: 'Lo uso todas las semanas para planificar las compras. Me ahorra fácil $20.000 por mes solo con las promos de combustible y supermercados.', rating: 5 },
  { name: 'Sol M.', city: 'Rosario', text: 'Me encanta que puedo buscar "heladera" y me dice en qué banco tengo descuento en tecnología. Es exactamente lo que necesitaba.', rating: 5 },
]

const FAQS = [
  {
    q: '¿Es gratis?',
    a: 'Sí, 100% gratis. Nunca te vamos a cobrar por ver tus promos. El modelo es sostenible porque las entidades financieras nos actualizan sus promos directamente.',
  },
  {
    q: '¿Cómo funciona?',
    a: 'Te registrás, cargás tus tarjetas y cuentas bancarias (solo el nombre del banco y tipo de tarjeta — nunca credenciales), y el sistema filtra automáticamente las promos que aplican para vos.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Solo guardamos información sobre qué bancos y tarjetas tenés (tipo: "Visa Gold del Galicia"). Nunca pedimos claves, contraseñas ni acceso a tu homebanking.',
  },
  {
    q: '¿Qué bancos y billeteras incluye?',
    a: 'Galicia, BBVA, Santander, Nación, ICBC, Supervielle, Macro, Patagonia, Ciudad, Provincia, Brubank, Naranja X, MODO, MercadoPago, CuentaDNI, y más de 20 entidades. Se agregan nuevas regularmente.',
  },
  {
    q: '¿Funciona sin registrarme?',
    a: 'Sí. Podés explorar todas las promos disponibles sin cuenta. Si querés el filtrado personalizado ("solo mis bancos"), ahí sí necesitás registrarte — te lleva 2 minutos.',
  },
]

export default async function LandingPage() {
  const promoCount = await prisma.promo.count({ where: { status: 'ACTIVE' } }).catch(() => 11000)

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_promoar.jpeg" alt="PromoAR" className="h-10 w-auto max-w-[180px] object-contain rounded-lg" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              Ingresar
            </Link>
            <Link href="/promos" className="px-4 py-2 bg-[#D94F2B] text-white rounded-xl text-sm font-bold hover:bg-[#c44325] transition-colors">
              Ver promos gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1E3A5F] via-[#1E3A5F] to-[#2a4f82] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-[#D94F2B] rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {promoCount.toLocaleString('es-AR')} promos activas hoy
            </div>
            <h1 className="text-4xl lg:text-5xl font-black leading-tight mb-4">
              Todas las promos de tus tarjetas,{' '}
              <span className="text-[#D94F2B]">en un lugar</span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              Descubrí descuentos, cuotas sin interés y reintegros de tus bancos y billeteras.
              Filtrado para vos. Actualizado todos los días.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/promos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#D94F2B] hover:bg-[#c44325] text-white rounded-2xl font-black text-base transition-all hover:scale-105 active:scale-95 shadow-lg">
                Ver mis promos gratis →
              </Link>
              <Link href="/promos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl font-semibold text-base transition-all">
                Explorar sin cuenta
              </Link>
            </div>
            <p className="mt-4 text-xs text-blue-200">Sin tarjeta de crédito. Sin sorpresas. Siempre gratis.</p>
          </div>

          {/* Mockup visual */}
          <div className="hidden lg:block">
            <div className="bg-white/10 backdrop-blur rounded-3xl p-4 border border-white/20 shadow-2xl">
              <div className="bg-[#0f2540] rounded-2xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Para tu perfil</span>
                </div>
                <p className="text-white font-black text-xl">{promoCount.toLocaleString('es-AR')} promos</p>
                <p className="text-[#D94F2B] text-sm font-bold">· hasta 100%</p>
              </div>
              <div className="space-y-2">
                {[
                  { store: 'Jumbo', bank: 'Galicia', disc: '20%', cat: '🛒 Supermercados' },
                  { store: 'YPF', bank: 'BBVA', disc: '25%', cat: '⛽ Combustible' },
                  { store: 'Farmacity', bank: 'Nación', disc: '30%', cat: '💊 Farmacias' },
                  { store: 'Personal Pay', bank: 'Santander', disc: '15%', cat: '🍽️ Gastronomía' },
                ].map((p) => (
                  <div key={p.store} className="bg-white rounded-xl p-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-[10px] font-black text-gray-500 shrink-0">
                      {p.store.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-900 truncate">{p.store}</p>
                      <p className="text-[10px] text-gray-400 truncate">{p.cat}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="bg-[#D94F2B] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">{p.disc}</span>
                      <p className="text-[9px] text-gray-400 mt-0.5">{p.bank}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. LOGOS ── */}
      <section className="border-b border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
            Promos de las principales entidades del país
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
            {BANKS.map((bank) => (
              <div key={bank.name} className="flex flex-col items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bank.logo} alt={bank.name} className="h-8 w-8 object-contain rounded" />
                <span className="text-[10px] font-semibold text-gray-500">{bank.name}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5 opacity-50">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-[10px] font-black text-gray-500">+10</span>
              </div>
              <span className="text-[10px] font-semibold text-gray-400">y más</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. VALOR ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: '🏦', stat: '20+', label: 'Bancos y billeteras', sub: 'Galicia, BBVA, MODO, MercadoPago y más' },
              { icon: '🎯', stat: 'Para vos', label: 'Filtrado por tu perfil', sub: 'Solo las promos de tus tarjetas y cuentas' },
              { icon: '🔄', stat: 'Hoy', label: 'Actualizado a diario', sub: 'Scrapers automáticos que revisan las promos todos los días' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
                <div className="text-3xl mb-3">{item.icon}</div>
                <p className="text-2xl font-black text-[#1E3A5F] mb-1">{item.stat}</p>
                <p className="text-sm font-bold text-gray-800 mb-1">{item.label}</p>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. DEMO ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold text-[#D94F2B] uppercase tracking-widest">Cómo funciona</span>
            <h2 className="text-3xl font-black text-[#1E3A5F] mt-2 mb-4">
              En 30 segundos sabés qué promos tenés hoy
            </h2>
            <ul className="space-y-4">
              {[
                { n: '1', t: 'Cargá tus tarjetas', d: 'Decile al sistema qué banco y tipo de tarjeta tenés. Sin claves ni contraseñas.' },
                { n: '2', t: 'El sistema filtra por vos', d: 'Solo ves las promos que aplican a tus tarjetas y cuentas. Nada más.' },
                { n: '3', t: 'Filtrá por categoría o día', d: 'Supermercados, combustible, farmacias... o simplemente "qué hay para hoy".' },
              ].map((step) => (
                <li key={step.n} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D94F2B] text-white flex items-center justify-center text-sm font-black shrink-0 mt-0.5">
                    {step.n}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{step.t}</p>
                    <p className="text-sm text-gray-500">{step.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/promos"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#1E3A5F] text-white rounded-2xl font-bold hover:bg-[#142840] transition-colors">
              Probarlo ahora →
            </Link>
          </div>
          {/* Demo placeholder — reemplazar con GIF real */}
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-3">📱</div>
            <p className="text-sm font-bold text-gray-500">GIF demo del filtrado</p>
            <p className="text-xs text-gray-400 mt-1">Reemplazar con screenshot o GIF real</p>
          </div>
        </div>
      </section>

      {/* ── 5. FEATURES ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-[#D94F2B] uppercase tracking-widest">Features</span>
            <h2 className="text-3xl font-black text-[#1E3A5F] mt-2">Todo lo que necesitás, en una app</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#D94F2B]/30 hover:shadow-md transition-all">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-black text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. SOCIAL PROOF ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-green-700">
                {promoCount.toLocaleString('es-AR')} promos disponibles hoy
              </span>
            </div>
            <h2 className="text-3xl font-black text-[#1E3A5F]">Lo que dicen los usuarios</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex mb-3">
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i} className="text-amber-400 text-base">{s}</span>
                  ))}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-black">
                    {t.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{t.name}</p>
                    <p className="text-[10px] text-gray-400">{t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FINANZAS ── */}
      <section className="py-20 bg-gradient-to-br from-[#1E3A5F] to-[#2a4f82] text-white">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold text-[#D94F2B] uppercase tracking-widest">Diferenciador único</span>
            <h2 className="text-3xl font-black mt-2 mb-4">
              No solo promos. También tus <span className="text-[#D94F2B]">finanzas</span>.
            </h2>
            <p className="text-blue-100 leading-relaxed mb-6">
              PromoAR es el único comparador que combina las promos de tus tarjetas con las
              tasas de interés del mercado. Plazos fijos, FCI y billeteras digitales,
              actualizados diariamente.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Tasas de plazos fijos de todos los bancos',
                'Rendimientos de billeteras (Mercado Pago, Ualá, Personal Pay)',
                'Fondos de inversión de liquidez inmediata',
                'Comparativa para saber dónde conviene más',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-blue-100">
                  <span className="text-[#D94F2B] font-black mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/finanzas"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#D94F2B] text-white rounded-2xl font-bold hover:bg-[#c44325] transition-colors">
              Ver tasas de hoy →
            </Link>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20">
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-3">Tasas actuales</p>
            {[
              { name: 'Mercado Pago', type: 'Cuenta remunerada', rate: '~85% TNA' },
              { name: 'Ualá', type: 'Cuenta remunerada', rate: '~82% TNA' },
              { name: 'Banco Nación', type: 'Plazo fijo 30d', rate: '~78% TNA' },
              { name: 'Banco Galicia', type: 'Plazo fijo 30d', rate: '~76% TNA' },
            ].map((r) => (
              <div key={r.name} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                <div>
                  <p className="text-sm font-bold">{r.name}</p>
                  <p className="text-xs text-blue-200">{r.type}</p>
                </div>
                <span className="text-[#D94F2B] font-black text-sm">{r.rate}</span>
              </div>
            ))}
            <p className="text-[10px] text-blue-300 mt-3">* Tasas de referencia — verificar en PromoAR</p>
          </div>
        </div>
      </section>

      {/* ── 8. FAQ ── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-[#D94F2B] uppercase tracking-widest">FAQ</span>
            <h2 className="text-3xl font-black text-[#1E3A5F] mt-2">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer font-bold text-gray-900 hover:bg-gray-50 transition-colors list-none">
                  {faq.q}
                  <span className="text-[#D94F2B] text-xl font-black transition-transform group-open:rotate-45 shrink-0 ml-3">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. CTA FINAL ── */}
      <section className="py-24 bg-gradient-to-br from-[#D94F2B] to-[#e8612d]">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-4xl font-black mb-4">
            Empezá gratis hoy
          </h2>
          <p className="text-lg text-orange-100 mb-8">
            {promoCount.toLocaleString('es-AR')} promos disponibles ahora mismo.<br />
            Sin tarjeta de crédito. Sin sorpresas. Siempre gratis.
          </p>
          <Link href="/promos"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#D94F2B] rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl">
            Ver mis promos gratis →
          </Link>
          <p className="mt-4 text-sm text-orange-200">¿Ya tenés cuenta? <Link href="/login" className="underline font-bold">Ingresá acá</Link></p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#1E3A5F] text-white py-12">
        <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-3 gap-8">
          <div>
            <p className="font-black text-lg mb-3">PromoAR</p>
            <p className="text-sm text-blue-200 leading-relaxed">
              El agregador de promos bancarias más completo de Argentina.
            </p>
          </div>
          <div>
            <p className="font-bold text-sm uppercase tracking-widest text-blue-300 mb-3">App</p>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><Link href="/promos" className="hover:text-white transition-colors">Ver promos</Link></li>
              <li><Link href="/finanzas" className="hover:text-white transition-colors">Tasas</Link></li>
              <li><Link href="/perfil" className="hover:text-white transition-colors">Mi perfil</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-sm uppercase tracking-widest text-blue-300 mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-white transition-colors">Términos</Link></li>
              <li><Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-white/10 text-xs text-blue-300 text-center">
          © {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera. Verificá vigencia y condiciones antes de usar.
        </div>
      </footer>

    </div>
  )
}
