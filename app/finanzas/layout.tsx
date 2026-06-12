import { TrendingUp } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import FinanzasNav from './FinanzasNav'

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-700/50">

      {/* Header + Pills */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100/60 dark:border-slate-800/60 sticky top-0 z-20 shadow-sm shadow-black/[0.02]">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Finanzas</h1>
          </div>

          <FinanzasNav />
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 py-5 pb-28 max-w-lg mx-auto">
        {children}
      </div>

      <BottomNav />
    </div>
  )
}
