import BottomNav from '@/app/components/BottomNav'
import BackButton from '@/app/components/BackButton'

const PRIORITY_CATS = [
  { label: 'Supermercados', slug: 'supermercados' },
  { label: 'Combustible', slug: 'combustible' },
  { label: 'Gastronomía', slug: 'gastronomia' },
  { label: 'Farmacias', slug: 'farmacias' },
  { label: 'Transporte', slug: 'transporte' },
]

export default function PromoNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <BackButton label="Promociones" />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="bg-gray-100 border border-gray-200 rounded-3xl px-6 py-8 text-center space-y-2">
          <p className="text-4xl">🔍</p>
          <p className="text-lg font-black text-gray-700">Esta promo ya no está disponible</p>
          <p className="text-sm text-gray-500">Puede haber vencido o haber sido reemplazada por una nueva.</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Explorá otras categorías</p>
          <div className="grid grid-cols-2 gap-3">
            {PRIORITY_CATS.map(c => (
              <a
                key={c.slug}
                href={`/promos?cats=${c.slug}`}
                className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-center hover:bg-indigo-50 transition-colors"
              >
                <p className="text-sm font-black text-gray-800">{c.label}</p>
              </a>
            ))}
          </div>
        </div>

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
