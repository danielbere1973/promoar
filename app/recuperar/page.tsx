'use client'
import { useState } from 'react'

export default function Recuperar() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (res.ok) {
      setEnviado(true)
    } else {
      const data = await res.json()
      setError(data.error || 'Error al enviar el mail')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-gray-900">PromoAR</h1>
          <p className="text-sm text-gray-500 mt-1">Recuperá tu contraseña</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          {enviado ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="text-sm font-medium text-gray-900">Revisá tu mail</p>
              <p className="text-sm text-gray-500">
                Si el email existe en PromoAR, te enviamos un link para restablecer tu contraseña.
              </p>
              <a href="/login" className="block text-sm text-green-700 font-medium mt-4">
                Volver al login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-500"
                  required
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>

              <div className="text-center">
                <a href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                  Volver al login
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}