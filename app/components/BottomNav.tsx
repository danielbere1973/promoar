'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Sun, Compass, Users, PieChart, UserCircle, LogOut } from 'lucide-react'

const navItems = [
  { label: 'Hoy',       icon: Sun,        href: '/' },
  { label: 'Explorar',  icon: Compass,    href: '/explorar' },
  { label: 'Comunidad', icon: Users,      href: '/comunidad' },
  { label: 'Finanzas',  icon: PieChart,   href: '/finanzas' },
  { label: 'Perfil',    icon: UserCircle, href: '/perfil' },
]

export default function BottomNav() {
  const pathname  = usePathname()
  const { status } = useSession()
  const loggedIn  = status === 'authenticated'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 flex py-2 px-2 z-30 pb-safe">
      <div className="flex w-full max-w-lg mx-auto justify-around items-center">
        {navItems.map((item) => {
          const active = pathname === item.href
          const Icon   = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center gap-1 p-2 w-16 relative"
            >
              <div className={`flex items-center justify-center transition-all duration-300 ${active ? '-translate-y-1' : 'hover:-translate-y-0.5'}`}>
                <Icon
                  size={24}
                  strokeWidth={active ? 2.5 : 2}
                  className={active ? 'text-green-600' : 'text-gray-400'}
                />
              </div>
              <span className={`text-[10px] font-semibold tracking-tight transition-all duration-300 ${active ? 'text-green-700 opacity-100 transform translate-y-0' : 'text-gray-400 opacity-0 absolute bottom-0 translate-y-2'}`}>
                {item.label}
              </span>
              <div className={`absolute bottom-0 w-1 h-1 rounded-full bg-green-600 transition-all duration-300 ${active ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
            </Link>
          )
        })}

        {/* Cerrar sesión — solo si está autenticado */}
        {loggedIn && (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex flex-col items-center gap-1 p-2 w-16 relative group"
            title="Cerrar sesión"
          >
            <div className="flex items-center justify-center transition-all duration-300 group-hover:-translate-y-0.5">
              <LogOut size={22} strokeWidth={2} className="text-gray-300 group-hover:text-red-400 transition-colors" />
            </div>
            <span className="text-[10px] font-semibold text-gray-300 group-hover:text-red-400 transition-colors">
              Salir
            </span>
          </button>
        )}
      </div>
    </nav>
  )
}
