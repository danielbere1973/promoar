'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Share, X, SquarePlus } from 'lucide-react'
import { useTracking } from '@/lib/useTracking'

const DISMISS_KEY = 'installPromptDismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

function isIOS() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const pathname = usePathname()
  const { track } = useTracking()
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY)) return

    // Se muestra después del prompt de notificaciones (que aparece a los 3s y
    // se auto-resuelve o queda visible) para no superponer dos toasts.
    const INSTALL_DELAY = 9000

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setPlatform('android')
      setTimeout(() => setShow(true), INSTALL_DELAY)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    if (isIOS()) {
      const timer = setTimeout(() => {
        setPlatform('ios')
        setShow(true)
      }, INSTALL_DELAY)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [pathname])

  if (pathname?.startsWith('/admin')) return null
  if (!show || !platform) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
    track({ type: 'INSTALL_PROMPT_DISMISS', platform })
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
    track({ type: outcome === 'accepted' ? 'INSTALL_ACCEPTED' : 'INSTALL_DISMISSED', platform })
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-40 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <div className="bg-[#1D3D6E]/10 dark:bg-[#1D3D6E]/30 text-[#1D3D6E] dark:text-blue-300 p-2 rounded-xl shrink-0">
        {platform === 'ios' ? <Share size={18} /> : <Download size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Instalá PromoAR</p>
        {platform === 'ios' ? (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Tocá <Share size={12} className="inline -mt-0.5" /> en Safari y elegí{' '}
            <span className="font-semibold text-gray-700 dark:text-slate-300 inline-flex items-center gap-0.5">
              "Agregar a inicio" <SquarePlus size={12} />
            </span>{' '}
            para tenerla como una app.
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Agregala a tu pantalla de inicio y abrila como una app, sin pasar por el navegador.
          </p>
        )}
        <div className="flex gap-2 mt-3">
          {platform === 'android' && (
            <button
              onClick={install}
              className="flex-1 text-xs font-bold bg-[#1D3D6E] text-white rounded-xl py-2 hover:bg-[#16314f] transition-colors"
            >
              Instalar
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-xs font-bold text-gray-500 dark:text-slate-400 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Cerrar" className="text-gray-300 hover:text-gray-500 shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
