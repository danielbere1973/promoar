'use client'

import { useRouter } from 'next/navigation'
import BottomNav from './BottomNav'
import BackButton from './BackButton'
import DetailSidebar from '../promos/[slug]/DetailSidebar'
import DetailCTA from '../promos/[slug]/DetailCTA'
import PromoCard from './PromoCard'

type Props = {
  reason: 'expired' | 'not_found'
  commerceName?: string | null
  commerceSlug?: string | null
  entityName?: string | null
  entitySlug?: string | null
  promos: any[]
}

const COPY = {
  expired: {
    badge: '⏰',
    title: (commerceName?: string | null) =>
      commerceName ? `La promo de ${commerceName} ya venció` : 'Esta promo ya venció',
    subtitle: 'Pero tenés un montón de promos vigentes esperándote.',
  },
  not_found: {
    badge: '🔍',
    title: () => 'Esta promo ya no está disponible',
    subtitle: 'Venció o fue reemplazada por otra — mirá las mejores de hoy.',
  },
} as const

export default function PromoUnavailable({ reason, commerceName, commerceSlug, entityName, entitySlug, promos }: Props) {
  const router = useRouter()
  const copy = COPY[reason]
  const headerLabel = reason === 'expired' && commerceName ? commerceName : 'Promo no disponible'

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0 lg:flex">
      <DetailSidebar />

      <div className="flex-1 min-w-0 lg:overflow-y-auto">
        <div className="lg:hidden">
          <BackButton label={headerLabel} />
        </div>

        <div className="max-w-lg lg:max-w-xl mx-auto px-4 lg:px-10 pt-4 lg:pt-10 space-y-4">

          {/* ── HERO — mismo lenguaje visual que la página de promo real ── */}
          <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2a4f82] rounded-3xl overflow-hidden shadow-lg px-6 py-7 text-center text-white">
            <p className="text-3xl mb-2">{copy.badge}</p>
            <p className="text-lg font-black leading-tight mb-1.5">{copy.title(commerceName)}</p>
            <p className="text-[13px] text-blue-200">{copy.subtitle}</p>
          </div>

          {/* ── CTA unificado: mismo componente pulsante que invita a registrarse / completar perfil ── */}
          <DetailCTA />

          {/* ── Links secundarios al comercio / entidad ── */}
          {(entitySlug || commerceSlug) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {entitySlug && entityName && (
                <a
                  href={`/bancos/${entitySlug}`}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:bg-indigo-50 transition-colors"
                >
                  <div>
                    <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Ver promos vigentes</p>
                    <p className="text-sm font-black text-gray-800">{entityName} →</p>
                  </div>
                </a>
              )}
              {commerceSlug && commerceName && (
                <a
                  href={`/comercios/${commerceSlug}`}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:bg-indigo-50 transition-colors"
                >
                  <div>
                    <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Ver promos vigentes</p>
                    <p className="text-sm font-black text-gray-800">en {commerceName} →</p>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* ── Destacadas hoy ── */}
          {promos.length > 0 && (
            <div className="pt-2">
              <p className="text-[13px] font-black text-gray-900 px-1 mb-2.5">Destacadas hoy</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {promos.map(promo => (
                  <PromoCard
                    key={promo.id}
                    promo={promo}
                    onClick={() => router.push(`/promos/${promo.slug}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
