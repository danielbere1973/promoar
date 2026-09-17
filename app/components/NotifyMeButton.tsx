'use client'

import { useState } from 'react'
import { Bell, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

interface NotifyMeButtonProps {
  commerceId?: string
  promoId?: string
  commerceName?: string
}

export default function NotifyMeButton({ commerceId, promoId, commerceName }: NotifyMeButtonProps) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return

    setStatus('loading')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, commerceId, promoId }),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch (err) {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center p-4 bg-green-50 text-green-700 rounded-2xl border border-green-200">
        <CheckCircle2 className="w-5 h-5 mr-2" />
        <p className="text-sm font-semibold">¡Listo! Te avisaremos al correo.</p>
      </div>
    )
  }

  return (
    <div className={`transition-all duration-300 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white shadow-md ${expanded ? 'p-4' : 'p-0'}`}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-yellow-400" />
            <p className="text-sm font-black text-left leading-tight">
              Avisarme si sale un mejor descuento {commerceName ? `en ${commerceName}` : ''}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 opacity-70 shrink-0 ml-2" />
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-semibold">
            Déjanos tu correo y serás el primero en enterarte:
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="flex-1 rounded-xl px-4 py-2.5 text-slate-900 bg-white border-0 focus:ring-2 focus:ring-yellow-400 outline-none text-sm placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-[#D94F2B] hover:bg-[#c74523] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-70 min-w-[100px]"
            >
              {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Suscribirme'}
            </button>
          </div>
          {status === 'error' && (
            <p className="text-xs text-red-200 mt-1">Hubo un error. Por favor, intenta nuevamente.</p>
          )}
        </form>
      )}
    </div>
  )
}
