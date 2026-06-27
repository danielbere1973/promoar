import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes | PromoAR',
  description: 'Respondemos las dudas más comunes sobre PromoAR: cómo cargar tu perfil, qué bancos están disponibles, cómo funciona la búsqueda de productos y más.',
  robots: { index: true, follow: true },
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: '¿PromoAR es gratis?',
    a: 'Sí, completamente gratis. No tiene publicidad intrusiva ni costo de ningún tipo.',
  },
  {
    q: '¿Qué bancos y billeteras están disponibles?',
    a: 'Cubrimos más de 23 fuentes: Banco Galicia, BBVA, Santander, Macro, BNA, Ciudad, Supervielle, Patagonia, ICBC, Naranja X, MercadoPago, Personal Pay, Cuenta DNI, MODO, AmEx, VISA, Cabal/Credicoop, Carrefour, Coto, Jumbo, Disco, Vea, Favacard, Clarín 365, Club La Nación y más.',
  },
  {
    q: '¿Cómo cargo mi perfil financiero?',
    a: 'Entrá a tu perfil desde el menú, seleccioná los bancos y billeteras que usás, las redes de tarjeta (Visa, Mastercard, AmEx) y el segmento si aplica (Gold, Platinum, Black, etc.). Con eso, PromoAR filtra automáticamente las promos que te aplican.',
  },
  {
    q: '¿Qué es la búsqueda de productos?',
    a: 'Es una función que te permite escribir un producto (por ejemplo "zapatillas", "heladera" o "shampoo") y ver en qué comercios con promos activas podés conseguirlo. Así sabés no solo que hay descuento, sino también dónde comprarlo.',
  },
  {
    q: '¿Con qué frecuencia se actualizan las promos?',
    a: 'Los scrapers corren regularmente. Las promos vencidas se marcan automáticamente y dejan de aparecer en el listado.',
  },
  {
    q: '¿Las promos que muestra PromoAR son 100% confiables?',
    a: 'Hacemos todo lo posible para mantener la información actualizada, pero los bancos y comercios pueden cambiar o cancelar sus promos sin previo aviso. Siempre recomendamos verificar las condiciones finales en el sitio oficial del banco o comercio antes de comprar.',
  },
  {
    q: '¿PromoAR necesita mi contraseña del banco?',
    a: 'No. Nunca. PromoAR no tiene acceso a tus cuentas bancarias, movimientos ni datos financieros reales. Solo te preguntamos qué banco o tarjeta tenés para mostrarte las promos relevantes.',
  },
  {
    q: '¿Cómo funciona el filtro por día?',
    a: 'Muchas promos bancarias son válidas solo ciertos días (por ejemplo, martes y jueves en supermercados). Podés filtrar por el día de hoy o cualquier día de la semana para ver qué promos están activas ese día.',
  },
  {
    q: '¿Puedo usar PromoAR sin registrarme?',
    a: 'Sí. Podés ver todas las promos sin crear una cuenta. El registro es opcional y solo sirve para guardar tu perfil financiero y ver las promos personalizadas para vos.',
  },
  {
    q: '¿Qué es Favacard?',
    a: 'Favacard es una tarjeta de crédito regional muy popular en el interior de la provincia de Buenos Aires (Mar del Plata, Bahía Blanca, Necochea y zona). PromoAR cubre sus promos con más de 2700 comercios adheridos.',
  },
  {
    q: '¿Qué es la sección Comunidad?',
    a: 'Es un espacio donde los usuarios comparten avivadas, errores de precio, promos locales y combos de ahorro que encontraron. Podés publicar tu propio aporte, indicar el comercio y la ubicación, y darle "útil" a los aportes que te sirvieron. Para publicar necesitás una cuenta.',
  },
  {
    q: '¿Qué tipos de aportes puedo publicar en Comunidad?',
    a: 'Hay cinco tipos: Avivada (un tip de ahorro), Promo/Oferta (una oferta puntual que encontraste), Error de precio (precio equivocado en góndola o web), Combo (cómo combinar promos para maximizar el descuento) y Consulta (una duda para la comunidad).',
  },
  {
    q: '¿Qué tiene la sección Finanzas?',
    a: 'Una suite de herramientas financieras: calculadora de plazo fijo, cotizaciones de divisas, índices, CEDEARs, acciones argentinas y americanas, bonos, ONs, LECAPs y cauciones. Todo en un lugar, sin tener que ir a distintos sitios.',
  },
  {
    q: 'Encontré una promo incorrecta o vencida, ¿cómo lo reporto?',
    a: <>Podés escribirnos desde la <Link href="/contacto" className="text-[#1E3A5F] font-semibold underline">página de contacto</Link>. Lo revisamos y actualizamos lo antes posible.</>,
  },
  {
    q: '¿Puedo sugerir un banco o fuente que no está?',
    a: <>¡Sí! Estamos sumando fuentes constantemente. Mandanos tu sugerencia desde <Link href="/contacto" className="text-[#1E3A5F] font-semibold underline">contacto</Link>.</>,
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>
          <h1 className="text-2xl font-black leading-tight">Preguntas frecuentes</h1>
          <p className="text-blue-200 text-sm mt-2">Las dudas más comunes sobre PromoAR.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-3">
        {FAQS.map((faq, i) => (
          <details key={i} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 group">
            <summary className="text-sm font-black text-gray-900 cursor-pointer select-none list-none flex items-center justify-between gap-3">
              {faq.q}
              <span className="text-gray-300 shrink-0 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <p className="text-sm text-gray-600 leading-relaxed mt-3">{faq.a}</p>
          </details>
        ))}

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/como-funciona"
            className="flex-1 bg-white border border-gray-100 rounded-2xl px-5 py-4 text-center hover:bg-indigo-50 transition-colors"
          >
            <p className="text-sm font-black text-[#1E3A5F]">¿Cómo funciona? →</p>
            <p className="text-xs text-gray-400 mt-0.5">Guía paso a paso</p>
          </Link>
          <Link
            href="/contacto"
            className="flex-1 bg-white border border-gray-100 rounded-2xl px-5 py-4 text-center hover:bg-indigo-50 transition-colors"
          >
            <p className="text-sm font-black text-[#1E3A5F]">Contacto →</p>
            <p className="text-xs text-gray-400 mt-0.5">¿Quedó alguna duda?</p>
          </Link>
        </div>

        <Link
          href="/promos"
          className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-3xl px-5 py-4 shadow-lg"
        >
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-0.5">¿Todo claro?</p>
            <p className="text-sm font-black">Ver todas las promos →</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">🎯</div>
        </Link>
      </div>
    </div>
  )
}
