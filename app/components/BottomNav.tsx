'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Sun, Search, SlidersHorizontal, Users, TrendingUp, UserCircle } from 'lucide-react'

function CategorySearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <circle cx="17.5" cy="17.5" r="3" />
      <line x1="19.6" y1="19.6" x2="22" y2="22" />
    </svg>
  )
}

type Props = {
  onSearch?: () => void
  onFilter?: () => void
}

export default function BottomNav({ onSearch, onFilter }: Props) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const iniciales = (() => {
    const name = (session?.user as any)?.name || session?.user?.email || ''
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  })()

  const isHome = pathname === '/promos'

  const navItems = [
    { label: 'Promos',      icon: Sun,               href: '/promos',    action: undefined as (() => void) | undefined },
    { label: 'Comunidad',   icon: Users,             href: '/comunidad', action: undefined },
    { label: 'Filtros',     icon: SlidersHorizontal, href: undefined,    action: onFilter },
    { label: 'Categorías',  icon: undefined,         href: '/explorar',  action: undefined },
    { label: 'Buscar',      icon: Search,            href: undefined,    action: onSearch },
    { label: 'Inversiones', icon: TrendingUp,        href: '/finanzas',  action: undefined },
    { label: 'Perfil',      icon: UserCircle,        href: '/perfil',    action: undefined },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-slate-700 z-30 pb-safe">
      <div className="flex w-full justify-around items-center px-1 pt-1.5 pb-1">
        {navItems.map((item) => {
          const active = item.href ? (pathname === item.href || pathname?.startsWith(`${item.href}/`)) : false
          const Icon = item.icon
          const isPerfil = item.href === '/perfil'
          const isCategorias = item.label === 'Categorías'

          const content = (
            <>
              <div className={`flex items-center justify-center transition-all duration-200 ${active ? 'text-green-600' : 'text-gray-400 dark:text-slate-500'}`}>
                {isCategorias
                  ? <CategorySearchIcon active={active} />
                  : isPerfil && status === 'authenticated' && iniciales
                  ? <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${active ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>{iniciales}</div>
                  : Icon && <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                }
              </div>
              <span className={`text-[9px] font-semibold mt-0.5 transition-colors ${active ? 'text-green-700' : 'text-gray-400 dark:text-slate-500'}`}>
                {item.label}
              </span>
            </>
          )

          if (item.action || !item.href) {
            return (
              <button key={item.label}
                type="button"
                onClick={item.action}
                className="flex flex-col items-center gap-0 py-1 px-1 min-w-0 flex-1 cursor-pointer">
                {content}
              </button>
            )
          }

          return (
            <Link key={item.label} href={item.href}
              className="flex flex-col items-center gap-0 py-1 px-1 min-w-0 flex-1">
              {content}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
