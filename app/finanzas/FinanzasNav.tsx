'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, PiggyBank, DollarSign } from 'lucide-react'

export const SECTIONS: { slug: string; label: string; icon: React.ReactNode }[] = [
  { slug: 'plazo-fijo',   label: 'Plazo Fijo',  icon: <PiggyBank size={14} /> },
  { slug: 'divisas',      label: 'Divisas',      icon: <DollarSign size={14} /> },
  { slug: 'acciones-ar',  label: 'Acciones AR',  icon: <TrendingUp size={14} /> },
  { slug: 'acciones-usa', label: 'Acciones USA', icon: <TrendingUp size={14} /> },
  { slug: 'indices',      label: 'Índices',       icon: <TrendingUp size={14} /> },
  { slug: 'lecaps',       label: 'LECAPs',        icon: <TrendingUp size={14} /> },
  { slug: 'bonos',        label: 'Bonos',         icon: <TrendingUp size={14} /> },
  { slug: 'cedears',      label: 'CEDEARs',       icon: <TrendingUp size={14} /> },
  { slug: 'ons',          label: 'ONs',           icon: <TrendingUp size={14} /> },
  { slug: 'cauciones',    label: 'Cauciones',     icon: <TrendingUp size={14} /> },
]

export default function FinanzasNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
      {SECTIONS.map(s => {
        const href = `/finanzas/${s.slug}`
        const active = pathname === href
        return (
          <Link key={s.slug} href={href}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0
              ${active
                ? 'bg-gray-900 text-white shadow-sm shadow-black/10'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200'
              }`}>
            {s.icon}
            {s.label}
          </Link>
        )
      })}
    </div>
  )
}
