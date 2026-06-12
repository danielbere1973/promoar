import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quiénes somos | PromoAR',
  description: 'Conocé la historia y la misión de PromoAR, el agregador de promociones bancarias de Argentina.',
  robots: { index: true, follow: true },
}

export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>
          <h1 className="text-2xl font-black leading-tight">Quiénes somos</h1>
          <p className="text-blue-200 text-sm mt-1">La idea, la misión y por qué existe PromoAR</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <h2 className="text-sm font-black text-[#1E3A5F] mb-2">El problema</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            En Argentina, cada banco y cada billetera virtual publica sus propias promociones,
            descuentos y cuotas sin interés en su propia app, su propia web o sus redes
            sociales. El resultado: nadie tiene tiempo de revisar 10 apps distintas antes de
            ir a hacer las compras, cargar combustible o comprar algo en cuotas — y terminamos
            pagando de más por no saber qué descuento teníamos disponible.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <h2 className="text-sm font-black text-[#1E3A5F] mb-2">Qué hacemos</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            PromoAR junta en un solo lugar las promociones activas de bancos, billeteras y
            comercios de todo el país, y las ordena para vos: según tus tarjetas, tus
            categorías favoritas y lo que estás por comprar. Nada de buscar en 10 apps —
            entrás, filtrás por tu perfil y listo.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            Además, somos los únicos que te permiten buscar por <strong>producto</strong>{' '}
            (&quot;zapatillas&quot;, &quot;heladera&quot;, &quot;perfume&quot;) y te decimos en qué comercios hay
            promo bancaria activa para eso.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <h2 className="text-sm font-black text-[#1E3A5F] mb-2">Nuestra misión</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Que ninguna persona en Argentina se entere tarde de un descuento que ya tenía
            disponible. Información clara, gratuita y actualizada todos los días, sin
            letra chica escondida.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <h2 className="text-sm font-black text-[#1E3A5F] mb-2">Cómo nos sostenemos</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            PromoAR es y va a seguir siendo gratuito para los usuarios. La información de
            promociones la recopilamos de fuentes públicas y de las propias entidades.
            No tenemos acceso a tus cuentas bancarias ni pedimos tus credenciales: solo
            necesitamos saber qué tarjetas y billeteras tenés para mostrarte lo que te sirve.
          </p>
        </div>

        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-2xl px-5 py-6 text-center">
          <p className="text-sm font-bold mb-3">¿Tenés sugerencias o encontraste un error en una promo?</p>
          <Link href="/contacto"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D94F2B] text-white rounded-xl text-sm font-black hover:scale-105 transition-transform">
            Escribinos →
          </Link>
        </div>
      </div>
    </div>
  )
}
