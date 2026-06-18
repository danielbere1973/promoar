'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff, Plus, Trash2, Lock, CheckCircle2, XCircle } from 'lucide-react'

type Category = { id: string; name: string; slug: string; icon: string }
type NotifPref = {
  id: string
  type: string
  active: boolean
  minDiscount: number | null
  maxPerWeek: number
  category: Category | null
  commerce: { id: string; name: string; slug: string; logoUrl: string | null } | null
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const out = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i)
  return out
}

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotifPref[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [pushStatus, setPushStatus] = useState<'unknown' | 'granted' | 'denied' | 'default' | 'unsupported'>('unknown')
  const [hasSubscription, setHasSubscription] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState('')
  const [saving, setSaving] = useState(false)

  // Detectar estado real: permiso del browser + suscripción activa en pushManager
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) { setPushStatus('unsupported'); return }
    setPushStatus(Notification.permission as any)

    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => setHasSubscription(!!sub))
      ).catch(() => {})
    }
  }, [])

  // Cargar preferencias y categorías
  useEffect(() => {
    Promise.all([
      fetch('/api/perfil/notificaciones').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([prefData, catData]) => {
      setPrefs(prefData.preferences ?? [])
      setCategories(catData.categories ?? catData ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      setPushStatus(permission as any)
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey ? urlBase64ToUint8Array(vapidKey) : undefined,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      })
      setHasSubscription(true)
    } catch (err) {
      console.error('[push] Error al suscribir:', err)
    } finally {
      setSubscribing(false)
    }
  }

  async function addCategoryPref() {
    if (!selectedCatId) return
    setSaving(true)
    try {
      const res = await fetch('/api/perfil/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CATEGORY', categoryId: selectedCatId }),
      })
      const data = await res.json()
      if (res.status === 403 && data.error === 'LIMIT_REACHED') {
        alert('Plan gratuito: solo podés tener 1 categoría favorita. Próximamente Premium.')
        return
      }
      if (!res.ok) { alert(data.message ?? 'Error al guardar'); return }
      setPrefs(p => [...p, data.preference])
      setAddingCategory(false)
      setSelectedCatId('')
    } finally {
      setSaving(false)
    }
  }

  async function togglePref(pref: NotifPref) {
    const res = await fetch(`/api/perfil/notificaciones/${pref.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !pref.active }),
    })
    if (res.ok) {
      const data = await res.json()
      setPrefs(p => p.map(x => x.id === pref.id ? data.preference : x))
    }
  }

  async function deletePref(id: string) {
    const res = await fetch(`/api/perfil/notificaciones/${id}`, { method: 'DELETE' })
    if (res.ok) setPrefs(p => p.filter(x => x.id !== id))
  }

  const categoryPrefs = prefs.filter(p => p.type === 'CATEGORY')
  const usedCatIds = new Set(categoryPrefs.map(p => p.category?.id).filter(Boolean))
  const availableCategories = categories.filter(c => !usedCatIds.has(c.id))
  const freeLimitReached = categoryPrefs.length >= 1

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 animate-pulse">
            <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/3 mb-3" />
            <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* Estado del permiso push */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
        <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">Permiso del dispositivo</h2>

        {pushStatus === 'unsupported' && (
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-2xl px-4 py-3">
            <BellOff size={18} />
            <p className="text-sm font-medium">Tu navegador no soporta notificaciones push.</p>
          </div>
        )}

        {pushStatus === 'denied' && (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 dark:bg-red-950/30 rounded-2xl px-4 py-3">
            <XCircle size={18} />
            <div>
              <p className="text-sm font-bold">Notificaciones bloqueadas</p>
              <p className="text-xs mt-0.5 opacity-80">Habilitá las notificaciones desde la configuración del navegador.</p>
            </div>
          </div>
        )}

        {pushStatus === 'granted' && hasSubscription && (
          <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl px-4 py-3">
            <CheckCircle2 size={18} />
            <p className="text-sm font-bold">Notificaciones activas en este dispositivo</p>
          </div>
        )}

        {pushStatus === 'granted' && !hasSubscription && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-slate-400">El permiso está concedido pero necesitás re-activar la suscripción.</p>
            <button
              onClick={enablePush}
              disabled={subscribing}
              className="flex items-center gap-2 px-5 py-3 bg-[#1E3A5F] text-white text-sm font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              <Bell size={16} />
              {subscribing ? 'Activando...' : 'Re-activar suscripción'}
            </button>
          </div>
        )}

        {(pushStatus === 'default' || pushStatus === 'unknown') && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-slate-400">Activá las notificaciones para recibir alertas de promos que te interesan.</p>
            <button
              onClick={enablePush}
              disabled={subscribing}
              className="flex items-center gap-2 px-5 py-3 bg-[#1E3A5F] text-white text-sm font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              <Bell size={16} />
              {subscribing ? 'Activando...' : 'Activar notificaciones'}
            </button>
          </div>
        )}
      </div>

      {/* Categorías favoritas */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Categorías favoritas</h2>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Te avisamos cuando aparezcan promos nuevas en estas categorías.</p>
          </div>
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 px-2 py-1 rounded-full">
            {categoryPrefs.length}/1 free
          </span>
        </div>

        <div className="space-y-2">
          {categoryPrefs.map(pref => (
            <div key={pref.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/80 rounded-2xl px-4 py-3">
              <span className="text-xl">{pref.category?.icon ?? '🔔'}</span>
              <span className="flex-1 text-sm font-bold text-gray-900 dark:text-white">{pref.category?.name ?? '—'}</span>
              <button
                onClick={() => togglePref(pref)}
                className={`relative w-10 h-5 rounded-full transition-all ${pref.active ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-600'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${pref.active ? 'left-5' : 'left-0.5'}`} />
              </button>
              <button onClick={() => deletePref(pref.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {categoryPrefs.length === 0 && !addingCategory && (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Todavía no elegiste ninguna categoría.</p>
          )}
        </div>

        {addingCategory ? (
          <div className="mt-3 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
            <select
              value={selectedCatId}
              onChange={e => setSelectedCatId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 text-sm font-medium text-gray-900 dark:text-white px-4 py-3 rounded-2xl outline-none"
            >
              <option value="">Elegí una categoría...</option>
              {availableCategories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={addCategoryPref}
                disabled={!selectedCatId || saving}
                className="flex-1 py-3 bg-gray-900 dark:bg-slate-600 text-white text-sm font-bold rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving ? 'Guardando...' : 'Agregar'}
              </button>
              <button
                onClick={() => { setAddingCategory(false); setSelectedCatId('') }}
                className="px-5 py-3 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-2xl text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCategory(true)}
            disabled={freeLimitReached}
            className="mt-3 flex items-center justify-center gap-2 text-sm w-full py-3.5 rounded-2xl bg-gray-50 dark:bg-slate-700 border-2 border-dashed border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> Agregar categoría
          </button>
        )}
      </div>

      {/* Premium teaser */}
      <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2d5a9e] rounded-3xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={16} className="opacity-70" />
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Próximamente · Premium</span>
        </div>
        <h3 className="font-bold text-base mb-1">Notificaciones sin límite</h3>
        <p className="text-sm opacity-75 leading-relaxed">
          Seguí comercios específicos, definí descuento mínimo, elegí días y recibí alertas cuando estés cerca de una sucursal con promo para tu tarjeta.
        </p>
      </div>

    </div>
  )
}
