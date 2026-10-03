'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const NAV_ITEMS = [
  { label: 'Inicio', icon: '🏠', href: '/promos' },
  { label: 'Explorar', icon: '🔍', href: '/promos/explorar' },
  { label: 'Cerca mío', icon: '📍', href: '/promos/explorar' },
  { label: 'Favoritos', icon: '♡', href: '/perfil' },
  { label: 'Mi perfil', icon: '👤', href: '/perfil' },
]

// Sidebar desktop exclusivo de /promos/[slug] — el resto del sitio sigue
// con BottomNav en todos los tamaños de pantalla (tiene filtros/favoritos
// que este layout nuevo todavía no cubre).
export default function DetailSidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isLoggedIn = status === 'authenticated'

  const iniciales = (() => {
    const name = (session?.user as any)?.name || session?.user?.email || ''
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  })()

  return (
    <div className="hidden lg:flex flex-col w-60 shrink-0 bg-white dark:bg-[#0F2040] border-r border-gray-100 dark:border-slate-800 px-4 py-6 gap-7 sticky top-0 h-screen">
      <Link href="/promos" className="pulse-loop text-[19px] font-black text-[#1E3A5F] dark:text-white w-fit">
        Promo<span className="text-[#D94F2B]">AR</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 text-[13px] font-bold px-2.5 py-2 rounded-xl transition-colors ${
                active
                  ? 'text-[#D94F2B] bg-[#fdf1ec] dark:bg-[#D94F2B]/10'
                  : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-2.5 border-t border-gray-100 dark:border-slate-800">
        {isLoggedIn ? (
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div className="w-[30px] h-[30px] rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-[12px] font-black text-indigo-600 dark:text-indigo-300 shrink-0">
              {iniciales}
            </div>
            <div className="text-[12px] font-bold text-gray-700 dark:text-slate-300 truncate">
              {(session?.user as any)?.name || session?.user?.email}
            </div>
          </div>
        ) : (
          <>
            <Link
              href="/login?next=/promos"
              className="text-center bg-[#1E3A5F] text-white text-[12px] font-extrabold py-2.5 rounded-xl"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/login?next=/promos"
              className="text-center text-gray-500 dark:text-slate-400 text-[11.5px] font-bold py-1"
            >
              Registrarme gratis
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
