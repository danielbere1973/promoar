'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { getPromosForBanner } from '@/app/actions/getPromosForBanner'
import PromoCard from './PromoCard'

interface AdPromoModalProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'bancos' | 'comercios' | null
  entitySlug: string | null
  entityName: string | null
}

export default function AdPromoModal({ isOpen, onClose, entityType, entitySlug, entityName }: AdPromoModalProps) {
  const router = useRouter()
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !entitySlug || !entityType) return
    let mounted = true
    setLoading(true)
    
    getPromosForBanner(entitySlug, entityType)
      .then(data => {
        if (mounted) {
          setPromos(data || [])
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Error fetching promos for modal', err)
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [isOpen, entitySlug, entityType])

  // Evitar scroll en el body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              {entityName ? `Promos en ${entityName}` : 'Promociones'}
            </h3>
            <p className="text-xs text-gray-500 font-medium">Las mejores oportunidades de ahorro</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3 opacity-70">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-gray-500">Buscando promos vigentes...</p>
            </div>
          ) : promos.length > 0 ? (
            <div className="space-y-3">
              {promos.map((p) => (
                <PromoCard 
                  key={p.id} 
                  promo={p} 
                  fullWidth 
                  onClick={() => {
                    if (window.innerWidth < 640) {
                      onClose()
                      router.push(`/promos/${p.slug}`)
                    } else {
                      window.open(`/promos/${p.slug}`, '_blank')
                    }
                  }} 
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <span className="text-4xl mb-3">😕</span>
              <p className="text-sm font-bold text-gray-700">No encontramos promos activas</p>
              <p className="text-xs text-gray-500 mt-1">Es posible que la promo ya no esté vigente hoy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
