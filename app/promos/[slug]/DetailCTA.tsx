'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// CTA de la página de detalle — vive en un Client Component porque la página
// es estática (revalidate=false, generateStaticParams): si isLoggedIn/hasProfile
// se resolvieran en el Server Component, el HTML pre-generado congelaría el
// estado de sesión de quien sea que haya disparado el primer render de esa
// promo, mostrando el CTA incorrecto a otros usuarios indefinidamente.
export default function DetailCTA() {
  const { status } = useSession()
  const isLoggedIn = status === 'authenticated'
  // null = todavía no se sabe (loading). Nunca tratarlo como "sin perfil",
  // o un usuario logueado CON perfil ve el CTA de "completá tu perfil" en el
  // instante antes de que resuelva el fetch.
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/perfil')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setHasProfile(!!data?.profile))
      .catch(() => setHasProfile(false))
  }, [isLoggedIn])

  if (status === 'loading') return null
  if (isLoggedIn && hasProfile === null) return null

  const ctaHref = !isLoggedIn ? '/login?next=/promos' : hasProfile ? '/promos/explorar' : '/perfil'
  const ctaTitle = !isLoggedIn
    ? '¡Registrate!'
    : hasProfile
    ? 'Clickeá acá y no te pierdas otros beneficios que quizás no conocías'
    : 'Completá tu perfil financiero'
  const ctaSubtitle = !isLoggedIn
    ? 'Cargá tu perfil financiero y disfrutá de tener todos TUS beneficios en un solo lugar'
    : hasProfile
    ? 'Descubrí más promos hechas a tu medida'
    : 'Te mostramos todos tus beneficios según tus bancos y tarjetas'

  return (
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
  )
}
