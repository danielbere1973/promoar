'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function VerificarPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reenvioLoading, setReenvioLoading] = useState(false)
  const [reenvioMsg, setReenvioMsg] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  const email = searchParams.get('email') || ''
  const password = searchParams.get('password') || ''
  const remember = searchParams.get('remember') === 'true'

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/registro/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, remember })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Código incorrecto')
        setLoading(false)
        return
      }

      // Guardar token de dispositivo si lo hay
      if (data.deviceToken) {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + 30)
        localStorage.setItem('device_token', data.deviceToken)
        localStorage.setItem('device_token_expiry', expiry.toISOString())
      }

      // Login automático
      const result = await signIn('credentials', {
        email,
        password,
        skipTwoFactor: 'true',
        redirect: false,
      })

      if (result?.ok) {
        router.push('/')
      } else {
        setError('Error al iniciar sesión. Ingresá manualmente.')
        router.push('/login')
      }
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  const handleReenviar = async () => {
    setReenvioLoading(true)
    setReenvioMsg('')
    setError('')

    try {
      const res = await fetch('/api/registro/reenviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (res.ok) {
        setReenvioMsg('Código reenviado. Revisá tu casilla de mail.')
      } else {
        setError('Error al reenviar el código')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setReenvioLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-sm p-6 bg-white rounded-2xl border border-gray-100">
        <h1 className="text-xl font-medium text-center mb-2 text-gray-900">Verificá tu identidad</h1>
        <p className="text-sm text-center text-gray-500 mb-6">
          Ingresá el código enviado a<br/>
          <span className="font-medium text-green-700">{email}</span>
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-center text-3xl tracking-[8px] focus:border-green-600 outline-none"
            maxLength={6}
            required
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>
          )}

          {reenvioMsg && (
            <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg text-center">{reenvioMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Confirmar código'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            ¿No te llegó el código?{' '}
            <button
              onClick={handleReenviar}
              disabled={reenvioLoading}
              className="text-green-700 font-medium disabled:opacity-50"
            >
              {reenvioLoading ? 'Enviando...' : 'Reenviar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}