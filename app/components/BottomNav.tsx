'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Flame, Compass, Users, UserCircle, TrendingUp } from 'lucide-react'

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

  const navItems = [
    {
      label: 'Promos',
      icon: Flame,
      href: '/promos',
      isActive: pathname === '/' || pathname === '/promos',
    },
    {
      label: 'Explorar',
      icon: Compass,
      href: '/promos/explorar',
      isActive: pathname?.startsWith('/promos/explorar') || pathname === '/explorar',
    },
    {
      label: 'Tasas',
      icon: TrendingUp,
      href: '/finanzas',
      isActive: pathname?.startsWith('/finanzas'),
    },
    {
      label: 'Comunidad',
      icon: Users,
      href: '/comunidad',
      isActive: pathname?.startsWith('/comunidad'),
    },
    {
      label: 'Mi Perfil',
      icon: UserCircle,
      href: '/perfil',
      isActive: pathname?.startsWith('/perfil'),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white/95 dark:bg-[#0A1428]/95 backdrop-blur-xl border-t border-gray-200 dark:border-slate-800 z-30 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <div className="flex w-full justify-around items-center px-3 py-2">
        {navItems.map((item) => {
          const active = item.isActive
          const Icon = item.icon
          const isPerfil = item.href === '/perfil'

          return (
            <Link
              key={item.label}
              href={item.href}
              id={`tour-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`flex flex-col items-center justify-center py-1 px-3 min-w-0 flex-1 transition-transform active:scale-95 ${
                active
                  ? 'text-[#D94F2B]'
                  : 'text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-center relative">
                {isPerfil && status === 'authenticated' && iniciales ? (
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                      active
                        ? 'bg-[#D94F2B] text-white ring-2 ring-[#D94F2B]/30'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    {iniciales}
                  </div>
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                )}
                {active && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#D94F2B]" />
                )}
              </div>
              <span
                className={`text-[11px] font-bold mt-1 tracking-tight transition-colors ${
                  active
                    ? 'text-[#D94F2B] font-extrabold'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

