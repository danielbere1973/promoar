'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[PromoAR Error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900">
      <div className="max-w-lg w-full space-y-4">
        <h2 className="text-xl font-black text-red-600">Error de la aplicación</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm font-mono text-red-800 break-all">
          <p className="font-bold">{error.message || 'Error desconocido'}</p>
          {error.digest && <p className="mt-2 text-red-500 text-xs">digest: {error.digest}</p>}
          {error.stack && (
            <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-48 whitespace-pre-wrap">
              {error.stack}
            </pre>
          )}
        </div>
        <button
          onClick={reset}
          className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
