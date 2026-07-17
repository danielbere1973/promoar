'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'promoar_onboarding_dismissed'
const STEP_KEY = 'promoar_onboarding_step'

type Props = {
  isLoggedIn: boolean
  hasProfile: boolean
  profileReady: boolean
}

export default function OnboardingBanner({ isLoggedIn, hasProfile, profileReady }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const router = useRouter()

  const steps = [
    { icon: '🏦', label: 'Tus bancos y billeteras', desc: 'Decinos con qué banco operás y qué billeteras usás. Así filtramos solo las promos que te aplican a vos.', href: '/perfil?tab=finance' },
    { icon: '💳', label: 'Tus tarjetas', desc: 'Visa, Mastercard, AmEx, Naranja X... Cargalas una vez y las tenemos en cuenta en cada búsqueda.', href: '/perfil?tab=finance' },
    { icon: '📍', label: 'Tu provincia', desc: 'Para mostrarte promos disponibles en tu zona y sucursales cerca tuyo.', href: '/perfil?tab=personal' },
    { icon: '🔔', label: 'Alertas personalizadas', desc: 'Activá alertas y te avisamos cuando aparezca una promo de tu banco o billetera.', href: '/perfil?tab=notif' },
    { icon: '📩', label: 'Newsletter semanal', desc: 'Las mejores promos de la semana directamente en tu email. Sin spam, te das de baja cuando querés.', href: '/perfil?tab=notif' },
  ]

  useEffect(() => {
    if (!isLoggedIn) return
    if (!profileReady) return
    if (localStorage.getItem(STORAGE_KEY)) return
    if (hasProfile) return
    const saved = parseInt(localStorage.getItem(STEP_KEY) ?? '0', 10)
    setStep(isNaN(saved) ? 0 : Math.min(saved, steps.length - 1))
    setVisible(true)
  }, [profileReady, isLoggedIn, hasProfile])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function goTo(i: number) {
    const next = Math.max(0, Math.min(i, steps.length - 1))
    setStep(next)
    localStorage.setItem(STEP_KEY, String(next))
  }

  function handleCta() {
    const s = steps[step]
    // Avanzar al siguiente paso antes de navegar
    if (step < steps.length - 1) goTo(step + 1)
    router.push(s.href)
  }

  if (!visible) return null

  const s = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="mx-4 mb-5">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">

        {/* Barra superior naranja */}
        <div className="h-1 bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full bg-[#D94F2B] transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="px-5 pt-4 pb-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#D94F2B] uppercase tracking-widest">
                Completá tu perfil
              </span>
              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">
                {step + 1} / {steps.length}
              </span>
            </div>
            <button
              onClick={dismiss}
              className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 text-xl leading-none transition-colors -mt-0.5"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {/* Contenido del paso */}
          <div className="flex gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-[#1E3A5F]/8 dark:bg-[#1E3A5F]/30 flex items-center justify-center text-2xl shrink-0">
              {s.icon}
            </div>
            <div>
              <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white leading-tight mb-1">{s.label}</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          </div>

          {/* Dots de progreso */}
          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-5 h-2 bg-[#D94F2B]'
                    : i < step
                    ? 'w-2 h-2 bg-[#D94F2B]/40'
                    : 'w-2 h-2 bg-slate-200 dark:bg-slate-600'
                }`}
                aria-label={`Paso ${i + 1}`}
              />
            ))}
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={handleCta}
              className="flex-1 py-2.5 text-[13px] font-black text-white bg-[#D94F2B] rounded-xl hover:bg-[#c04426] transition-all"
            >
              {isLast ? 'Ir al perfil →' : 'Configurar →'}
            </button>
            {!isLast && (
              <button
                onClick={() => goTo(step + 1)}
                className="px-4 py-2.5 text-[13px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Saltear
              </button>
            )}
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                className="px-3 py-2.5 text-[13px] text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
                aria-label="Anterior"
              >
                ‹
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
