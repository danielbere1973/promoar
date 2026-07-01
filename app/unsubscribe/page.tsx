'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function UnsubscribePage() {
  const params = useSearchParams()
  const ok = params.get('ok')
  const error = params.get('error')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-10 max-w-sm w-full text-center shadow-sm">
        <p className="text-3xl mb-4">{ok ? '✅' : '❌'}</p>
        <h1 className="text-xl font-black text-[#1E3A5F] mb-2">
          {ok ? 'Te diste de baja' : 'Link inválido'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {ok
            ? 'Ya no vas a recibir más emails de PromoAR. Podés volver a suscribirte desde tu perfil cuando quieras.'
            : 'El link de cancelación no es válido o ya expiró.'}
        </p>
        <a href="/promos" className="text-sm font-bold text-[#1E3A5F] hover:underline">
          Volver a PromoAR →
        </a>
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><UnsubscribePage /></Suspense>
}
