'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react'

const IS_DEV = process.env.NODE_ENV === 'development'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const msg = searchParams.get('msg')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [tieneDispositivo, setTieneDispositivo] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [devPin, setDevPin] = useState('')
  const [devPinOk, setDevPinOk] = useState(false)
  const [devPinError, setDevPinError] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('device_token')
    const expiry = localStorage.getItem('device_token_expiry')
    if (token && expiry && new Date() < new Date(expiry)) {
      setTieneDispositivo(true)
    } else {
      localStorage.removeItem('device_token')
      localStorage.removeItem('device_token_expiry')
      setTieneDispositivo(false)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const deviceToken = localStorage.getItem('device_token') || ''

    const result = await signIn('credentials', {
      email: email.toLowerCase().trim(),
      password,
      deviceToken,
      redirect: false,
    })

    if (result?.error?.includes('2FA_REQUIRED')) {
      await fetch('/api/registro/reenviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      })
      router.push(`/verificar?email=${encodeURIComponent(email.toLowerCase().trim())}&password=${encodeURIComponent(password)}&remember=${remember}`)
      return
    }

    if (result?.error) {
      setError('Credenciales incorrectas. Verificá tu correo y contraseña.')
      setLoading(false)
    } else {
      router.push('/promos')
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="bg-gradient-to-br from-green-400 to-green-600 w-16 h-16 rounded-[20px] flex items-center justify-center text-white mb-4 shadow-lg shadow-green-200">
           <Zap size={32} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-gray-900">PromoAR</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium">Gestioná tus ahorros inteligentemente</p>
      </div>

      <div className="bg-white border text-left border-gray-100 rounded-[32px] p-7 shadow-sm shadow-black/[0.02]">
        {msg && (
          <div className="bg-green-50 border border-green-100 p-3.5 rounded-2xl mb-5 text-center flex items-center gap-2 justify-center">
            <ShieldCheck size={16} className="text-green-600" />
            <p className="text-xs text-green-700 font-semibold">{msg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Correo Electrónico</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-gray-50/50 focus:bg-white transition-colors"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-2xl pl-10 pr-10 py-3 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-gray-50/50 focus:bg-white transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!tieneDispositivo && (
            <div className="flex items-center gap-2 py-1 ml-1">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <label htmlFor="remember" className="text-xs font-medium text-gray-600 cursor-pointer">
                Mantener sesión iniciada
              </label>
            </div>
          )}

          {tieneDispositivo && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-100 px-3 py-2.5 rounded-xl">
              <ShieldCheck size={16} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-green-800 leading-relaxed">
                Este dispositivo ya está verificado, no te pediremos código.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
               <p className="text-xs font-medium text-red-600 text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-colors mt-2 shadow-sm shadow-gray-900/10"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Divisor */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs font-medium text-gray-400">o continuá con</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Botón Google */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/promos' })}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-3 rounded-2xl text-sm font-semibold transition-colors shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Continuar con Google
        </button>

        <div className="mt-5 text-center space-y-3">
          <a href="/recuperar" className="block text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors">
            ¿Olvidaste tu contraseña?
          </a>
          <p className="text-sm font-medium text-gray-600 border-t border-gray-100 pt-4">
            ¿No tenés cuenta?{' '}
            <a href="/registro" className="text-green-600 font-bold hover:text-green-700">Registrate gratis</a>
          </p>
        </div>
      </div>

      {/* ── Acceso rápido (solo en dev) ── */}
      {IS_DEV && (
        <div className="mt-6 border border-amber-200/60 rounded-[24px] p-5 bg-gradient-to-r from-amber-50 to-orange-50/50 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-3 text-center flex justify-center items-center gap-1">
             <Zap size={14} /> Modo DEV Activo
          </p>
          <div className="space-y-2">
            {devPinOk ? (
              <button
                type="button"
                onClick={async () => {
                  setLoading(true)
                  try {
                    const result = await signIn('credentials', {
                      email: 'admin@promoar.com.ar',
                      password: 'admin1234',
                      redirect: false,
                    })
                    if (result?.ok) {
                      const cb = searchParams.get('callbackUrl') || '/promos'
                      router.push(cb)
                      setTimeout(() => setLoading(false), 5000)
                    } else {
                      setError('No se pudo acceder. Verificá que el seed esté ejecutado.')
                      setLoading(false)
                    }
                  } catch {
                    setError('Ocurrió un error inesperado.')
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading ? 'Autenticando...' : 'Autenticar como Admin'}
              </button>
            ) : (
              <form onSubmit={e => {
                e.preventDefault()
                if (devPin === process.env.NEXT_PUBLIC_ADMIN_PIN) {
                  setDevPinOk(true)
                  setDevPinError(false)
                } else {
                  setDevPinError(true)
                  setDevPin('')
                }
              }} className="space-y-2">
                <input
                  type="password"
                  value={devPin}
                  onChange={e => { setDevPin(e.target.value); setDevPinError(false) }}
                  placeholder="PIN de acceso"
                  className={`w-full text-center font-bold tracking-widest border-2 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${devPinError ? 'border-red-300 bg-red-50' : 'border-amber-200 focus:border-amber-400 bg-white'}`}
                />
                {devPinError && <p className="text-[11px] text-red-500 text-center">PIN incorrecto</p>}
                <button type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors">
                  Verificar PIN
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50/80 flex items-center justify-center px-4 py-12" style={{ colorScheme: 'light' }}>
      <Suspense fallback={<div className="text-gray-400 text-sm">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}