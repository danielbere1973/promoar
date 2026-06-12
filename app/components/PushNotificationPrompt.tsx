'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { useTracking } from '@/lib/useTracking'

const DISMISS_KEY = 'pushPromptDismissed'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationPrompt() {
  const pathname = usePathname()
  const { track } = useTracking()
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISS_KEY)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {})

    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [pathname])

  if (pathname?.startsWith('/admin')) return null
  if (!show) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
    track({ type: 'PUSH_PROMPT_DISMISS' })
  }

  const enable = async () => {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        localStorage.setItem(DISMISS_KEY, '1')
        setShow(false)
        track({ type: 'PUSH_PERMISSION_DENIED' })
        return
      }

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey ? urlBase64ToUint8Array(vapidKey) : undefined,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })

      localStorage.setItem(DISMISS_KEY, '1')
      setShow(false)
      track({ type: 'PUSH_PERMISSION_GRANTED' })
    } catch (error) {
      console.error('Error al activar notificaciones:', error)
      setShow(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-40 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl shrink-0">
        <Bell size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Activá las notificaciones</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Te avisamos cuando aparezcan promos nuevas para vos. Podés desactivarlas cuando quieras.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={enable}
            disabled={loading}
            className="flex-1 text-xs font-bold bg-[#1E3A5F] text-white rounded-xl py-2 hover:bg-[#16314f] transition-colors disabled:opacity-50"
          >
            {loading ? 'Activando...' : 'Activar'}
          </button>
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
