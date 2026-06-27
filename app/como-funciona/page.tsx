import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '¿Cómo funciona? | PromoAR',
  description: 'Descubrí cómo usar PromoAR para encontrar las mejores promos bancarias de Argentina filtradas por tu tarjeta, banco o billetera.',
  robots: { index: true, follow: true },
}

const STEPS = [
  {
    number: '1',
    title: 'Cargá tu perfil financiero',
    description: 'Ingresá con tu cuenta y completá qué bancos, billeteras y tarjetas tenés. Podés agregar Banco Galicia, BBVA, Santander, MercadoPago, Personal Pay, Cuenta DNI, y muchos más.',
    icon: '👤',
  },
  {
    number: '2',
    title: 'Filtrá las promos que te aplican',
    description: 'PromoAR cruza tu perfil con todas las promociones activas y te muestra solo las que podés usar hoy. Podés filtrar además por categoría, día de la semana, canal de pago y más.',
    icon: '🎯',
  },
  {
    number: '3',
    title: 'Buscá productos',
    description: 'Con el buscador de productos encontrás en qué comercios con promos activas podés conseguir lo que necesitás. Escribís "zapatillas", "notebook" o "medicamentos" y te mostramos dónde conviene ir.',
    icon: '🔍',
  },
  {
    number: '4',
    title: 'Guardá tus favoritas',
    description: 'Marcá las promos que más te interesan para encontrarlas rápido. Las promos vencidas desaparecen solas del listado.',
    icon: '⭐',
  },
]

const FEATURES = [
  { icon: '🏦', label: '23+ fuentes', desc: 'Bancos, billeteras, supermercados y tarjetas' },
  { icon: '🔄', label: 'Actualización frecuente', desc: 'Los scrapers corren regularmente' },
  { icon: '📍', label: 'Sucursales', desc: 'Algunos comercios muestran sus locales adheridos' },
  { icon: '🆓', label: 'Gratis', desc: 'Sin costo, sin publicidad intrusiva' },
]

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>
          <h1 className="text-2xl font-black leading-tight">¿Cómo funciona PromoAR?</h1>
          <p className="text-blue-200 text-sm mt-2 leading-relaxed">
            Un agregador de promos bancarias argentinas que se adapta a tu perfil financiero.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step) => (
            <div key={step.number} className="bg-white rounded-2xl border border-gray-100 px-5 py-5 flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#1E3A5F] text-white flex items-center justify-center text-sm font-black shrink-0">
                {step.number}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{step.icon}</span>
                  <h2 className="text-sm font-black text-gray-900">{step.title}</h2>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <h2 className="text-sm font-black text-[#1E3A5F] mb-4">¿Qué tiene PromoAR?</h2>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="text-xl mb-1">{f.icon}</div>
                <p className="text-xs font-black text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>PromoAR no es una entidad financiera.</strong> Somos un agregador de información pública.
            Siempre verificá las condiciones finales de cada promo en el sitio oficial del banco o comercio antes de comprar.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/promos"
          className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-3xl px-5 py-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-0.5">¿Listo?</p>
            <p className="text-sm font-black">Ver todas las promos →</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">🎯</div>
        </Link>

        <p className="text-center text-xs text-gray-400 pb-4">
          ¿Tenés dudas? Revisá las{' '}
          <Link href="/faq" className="text-[#1E3A5F] font-semibold underline">preguntas frecuentes</Link>
          {' '}o{' '}
          <Link href="/contacto" className="text-[#1E3A5F] font-semibold underline">contactanos</Link>.
        </p>
      </div>
    </div>
  )
}
