import Link from 'next/link'
import type { Metadata } from 'next'
import ContactForm from '../components/ContactForm'

export const metadata: Metadata = {
  title: 'Contacto | PromoAR',
  description: 'Contactate con el equipo de PromoAR por mail, WhatsApp o Instagram.',
  robots: { index: true, follow: true },
}

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>
          <h1 className="text-2xl font-black leading-tight">Contacto</h1>
          <p className="text-blue-200 text-sm mt-1">¿Tenés una consulta, sugerencia o encontraste un error? Escribinos.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
          <h2 className="text-sm font-black text-[#1E3A5F] mb-4">Envianos un mensaje</h2>
          <ContactForm />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-5">
            <h2 className="text-sm font-black text-[#1E3A5F] mb-4">Otros canales</h2>
            <div className="space-y-3">
              <a href="mailto:contacto@promoar.com.ar"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-[#1E3A5F] hover:bg-gray-50 transition-colors">
                <span className="w-10 h-10 rounded-xl bg-[#1E3A5F]/10 flex items-center justify-center text-lg shrink-0">✉️</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Email</p>
                  <p className="text-sm font-bold text-gray-900 truncate">contacto@promoar.com.ar</p>
                </div>
              </a>

              <a href="https://wa.me/541173691613" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-green-500 hover:bg-green-50 transition-colors">
                <span className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg shrink-0">💬</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">WhatsApp</p>
                  <p className="text-sm font-bold text-gray-900 truncate">+54 11 7369-1613</p>
                </div>
              </a>

              <a href="https://www.instagram.com/promoar.com.ar" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-pink-400 hover:bg-pink-50 transition-colors">
                <span className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-lg shrink-0">📷</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Instagram</p>
                  <p className="text-sm font-bold text-gray-900 truncate">@promoar.com.ar</p>
                </div>
              </a>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-2xl px-5 py-5">
            <p className="text-sm font-bold mb-1">¿Encontraste una promo vencida o con datos incorrectos?</p>
            <p className="text-xs text-blue-200 leading-relaxed">
              Contanos qué pasó y la fuente, y la revisamos lo antes posible. Tu reporte
              ayuda a que la información sea más confiable para todos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
