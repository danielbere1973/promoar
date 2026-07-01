'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'

type Step = {
  targetId: string | null
  title: string
  body: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const STEPS_GUEST: Step[] = [
  {
    targetId: null,
    title: '¡Bienvenido a PromoAR!',
    body: 'Encontrá todas las promociones bancarias de Argentina en un solo lugar. Te mostramos en segundos dónde conviene pagar según tus tarjetas y billeteras.',
    position: 'center',
  },
  {
    targetId: '.promo-card',
    title: 'Las tarjetas de promo',
    body: 'Cada tarjeta muestra el comercio, el porcentaje de descuento o cuotas sin interés, el banco o billetera que la ofrece y el tope de reintegro.',
    position: 'bottom',
  },
  {
    targetId: '#tour-todas-parami, #tour-todas-parami-mobile',
    title: 'Todas vs Para Mí',
    body: '"Todas" muestra todas las promos disponibles. "Para Mí" las filtra según tu perfil financiero (tus tarjetas y billeteras). Al tocarlo te pedimos que completes tu perfil — ¡vale la pena!',
    position: 'bottom',
  },
  {
    targetId: '#tour-hoy-semana, #tour-hoy-semana-mobile',
    title: 'Hoy / Semana',
    body: '"Hoy" muestra solo las promos válidas en el día de hoy. "Semana" te muestra todas las del resto de la semana para que planifiques tus compras.',
    position: 'bottom',
  },
  {
    targetId: '#tour-filtros, #tour-nav-filtros',
    title: 'Filtros avanzados',
    body: 'Filtrá por banco, billetera, red de tarjeta, días, canales de pago, rango de descuento y más. Perfecto para encontrar exactamente lo que buscás.',
    position: 'bottom',
  },
  {
    targetId: '#tour-buscador, #tour-buscador-mobile',
    title: 'Buscador de comercios y productos',
    body: 'Buscá un comercio por nombre, o buscá un producto ("zapatillas", "carteras") y te mostramos en qué comercios con descuento podés encontrarlo.',
    position: 'bottom',
  },
  {
    targetId: '#tour-nav-comunidad',
    title: 'Comunidad 💬',
    body: '¡Esta sección es clave! Acá podés dejar avivadas ("en Coto los jueves con Galicia hay 40%"), reportar promos que faltan, avisar errores, compartir consejos de ahorro y sugerir mejoras. Entre todos hacemos PromoAR mejor.',
    position: 'top',
  },
  {
    targetId: '#tour-nav-inversiones',
    title: 'Finanzas',
    body: 'Información actualizada sobre los mercados financieros locales e internacionales: tasas de plazos fijos, cauciones, acciones, CEDEARs, bonos, letras y mucho más.',
    position: 'top',
  },
  {
    targetId: '#tour-nav-perfil',
    title: 'Tu perfil',
    body: 'Configurá tus tarjetas y billeteras para que "Para Mí" funcione. También podés registrarte gratis para guardar tu configuración.',
    position: 'top',
  },
  {
    targetId: '#tour-nav-promos',
    title: '¡Registrate para más!',
    body: 'Con una cuenta podés guardar tu perfil financiero, marcar favoritos y recibir alertas de promos que te interesan. ¡Es gratis!',
    position: 'top',
  },
]

const STEPS_USER: Step[] = [
  {
    targetId: null,
    title: '¡Bienvenido de nuevo!',
    body: 'Te mostramos un repaso rápido de las funciones principales de PromoAR.',
    position: 'center',
  },
  {
    targetId: '.promo-card',
    title: 'Las tarjetas de promo',
    body: 'Cada tarjeta muestra el comercio, el descuento o CSI, el banco o billetera requerida y el tope de reintegro.',
    position: 'bottom',
  },
  {
    targetId: '#tour-todas-parami, #tour-todas-parami-mobile',
    title: 'Todas vs Para Mí',
    body: '"Para Mí" filtra las promos según tu perfil financiero. Solo ves las que podés usar con tus tarjetas y billeteras.',
    position: 'bottom',
  },
  {
    targetId: '#tour-hoy-semana, #tour-hoy-semana-mobile',
    title: 'Hoy / Semana',
    body: 'Filtrá para ver promos válidas hoy, o de toda la semana para planificar tus compras.',
    position: 'bottom',
  },
  {
    targetId: '#tour-filtros, #tour-nav-filtros',
    title: 'Filtros avanzados',
    body: 'Filtrá por banco, billetera, red, días, canales y más.',
    position: 'bottom',
  },
  {
    targetId: '#tour-buscador, #tour-buscador-mobile',
    title: 'Buscador de comercios y productos',
    body: 'Buscá un comercio por nombre o un producto para ver dónde conseguirlo con descuento.',
    position: 'bottom',
  },
  {
    targetId: '#tour-favoritos',
    title: 'Mis Favoritos',
    body: 'Marcá hasta 3 categorías y 5 comercios como favoritos. Aparecerán primero en tu lista para que no pierdas tiempo buscando.',
    position: 'bottom',
  },
  {
    targetId: '#tour-nav-inversiones',
    title: 'Finanzas',
    body: 'Información actualizada sobre los mercados financieros locales e internacionales: tasas de plazos fijos, cauciones, acciones, CEDEARs, bonos, letras y mucho más.',
    position: 'top',
  },
  {
    targetId: '#tour-nav-comunidad',
    title: 'Comunidad 💬',
    body: '¡Esta sección es clave! Acá podés dejar avivadas ("en Coto los jueves con Galicia hay 40%"), reportar promos que faltan, avisar errores, compartir consejos de ahorro y sugerir mejoras. Entre todos hacemos PromoAR mejor.',
    position: 'top',
  },
  {
    targetId: '#tour-nav-perfil',
    title: 'Tu perfil',
    body: 'Configurá tus tarjetas, billeteras y preferencias para personalizar toda la experiencia.',
    position: 'top',
  },
]

type Rect = { top: number; left: number; width: number; height: number }

// Busca el primer selector visible (tamaño > 0). Acepta múltiples separados por coma.
function findVisibleEl(id: string): Element | null {
  for (const sel of id.split(',').map(s => s.trim())) {
    try {
      const el = document.querySelector(sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    } catch {}
  }
  return null
}

function getRect(id: string | null): Rect | null {
  if (!id) return null
  const el = findVisibleEl(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function Spotlight({ rect }: { rect: Rect }) {
  const pad = 8
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9998 }}>
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - pad}
            y={rect.top - pad}
            width={rect.width + pad * 2}
            height={rect.height + pad * 2}
            rx="12"
            fill="black"
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#spotlight-mask)" />
      <rect
        x={rect.left - pad}
        y={rect.top - pad}
        width={rect.width + pad * 2}
        height={rect.height + pad * 2}
        rx="12"
        fill="none"
        stroke="#D94F2B"
        strokeWidth="2"
      />
    </svg>
  )
}

// Panel de fondo completo sin spotlight (para paso "center")
function DimOverlay() {
  return <div className="fixed inset-0 bg-black/65 z-[9998]" />
}

// Tooltip desktop (flotante cerca del elemento)
function DesktopTooltip({ step, rect, onNext, onPrev, onSkip, current, total }: {
  step: Step; rect: Rect | null; onNext: () => void; onPrev: () => void; onSkip: () => void; current: number; total: number
}) {
  const isCenter = step.position === 'center' || !rect || step.targetId === null
  const isLast = current === total - 1
  const pad = 16
  const tooltipW = 300
  let style: React.CSSProperties = {}

  if (!isCenter && rect) {
    if (step.position === 'right') {
      style = { top: rect.top + rect.height / 2, left: rect.left + rect.width + pad, transform: 'translateY(-50%)' }
    } else if (step.position === 'left') {
      style = { top: rect.top + rect.height / 2, left: rect.left - tooltipW - pad, transform: 'translateY(-50%)' }
    } else if (step.position === 'bottom') {
      style = { top: rect.top + rect.height + pad, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
    } else {
      style = { top: rect.top - pad, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
    }
  }

  return (
    <div
      className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-3"
      style={isCenter
        ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: tooltipW, maxWidth: 'calc(100vw - 32px)' }
        : { ...style, width: tooltipW, maxWidth: 'calc(100vw - 32px)' }
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-black text-gray-900 dark:text-white leading-tight">{step.title}</h3>
        <button onClick={onSkip} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{step.body}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400 font-medium">{current + 1} / {total}</span>
        <div className="flex gap-1.5">
          {current > 0 && (
            <button onClick={onPrev} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-bold">
              <ChevronLeft size={13} /> Atrás
            </button>
          )}
          <button onClick={onNext} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold">
            {isLast ? 'Finalizar' : 'Siguiente'} {!isLast && <ChevronRight size={13} />}
          </button>
        </div>
      </div>
      <div className="flex justify-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-[#D94F2B]' : 'w-1.5 bg-gray-200 dark:bg-slate-600'}`} />
        ))}
      </div>
    </div>
  )
}

// Panel mobile: barra fija arriba del navbar con flechita apuntando al elemento
function MobileBar({ step, rect, onNext, onPrev, onSkip, current, total }: {
  step: Step; rect: Rect | null; onNext: () => void; onPrev: () => void; onSkip: () => void; current: number; total: number
}) {
  const isLast = current === total - 1
  const isCenter = step.position === 'center' || !rect || step.targetId === null

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 390
  const panelMargin = 12
  const panelW = screenW - panelMargin * 2

  // Posición horizontal de la flecha: centrada sobre el elemento
  let arrowLeft = panelW / 2 - 10
  if (rect) {
    const elementCenterX = rect.left + rect.width / 2
    arrowLeft = Math.max(12, Math.min(elementCenterX - panelMargin - 10, panelW - 32))
  }

  // Si el elemento está en la mitad inferior, la flecha apunta hacia abajo (panel arriba)
  const elementInBottom = rect ? rect.top > (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.55 : false

  if (isCenter) {
    // Paso de bienvenida: centrado en pantalla
    return (
      <div
        className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-3"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 300, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-black text-gray-900 dark:text-white leading-tight">{step.title}</h3>
          <button onClick={onSkip} className="shrink-0 text-gray-400"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400 font-medium">{current + 1} / {total}</span>
          <button onClick={onNext} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold">
            Empezar <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex justify-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-[#D94F2B]' : 'w-1.5 bg-gray-200'}`} />
          ))}
        </div>
      </div>
    )
  }

  const panelContent = (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4">
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="text-sm font-black text-gray-900 dark:text-white leading-tight">{step.title}</h3>
        <button onClick={onSkip} className="shrink-0 text-gray-400 ml-2"><X size={15} /></button>
      </div>
      <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed mb-3">{step.body}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-medium">{current + 1} / {total}</span>
        <div className="flex gap-1.5">
          {current > 0 && (
            <button onClick={onPrev} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-bold">
              <ChevronLeft size={13} /> Atrás
            </button>
          )}
          <button onClick={onNext} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold">
            {isLast ? 'Finalizar' : 'Siguiente'} {!isLast && <ChevronRight size={13} />}
          </button>
        </div>
      </div>
      <div className="flex justify-center gap-1 mt-2.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-[#D94F2B]' : 'w-1.5 bg-gray-200'}`} />
        ))}
      </div>
    </div>
  )

  if (elementInBottom) {
    // Elemento en la parte inferior: panel arriba, flecha apunta hacia abajo
    return (
      <div className="fixed top-20 z-[9999]" style={{ left: panelMargin, right: panelMargin }}>
        {panelContent}
        {/* Flecha apuntando hacia abajo */}
        <div className="absolute -bottom-3 overflow-hidden" style={{ left: arrowLeft, width: 20, height: 12 }}>
          <div className="w-4 h-4 bg-white dark:bg-slate-800 rotate-45 mx-auto translate-y-[-8px] shadow border border-gray-100" />
        </div>
      </div>
    )
  }

  // Elemento en la parte superior: panel abajo, flecha apunta hacia arriba
  return (
    <div className="fixed z-[9999]" style={{ left: panelMargin, right: panelMargin, bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
      {/* Flecha apuntando hacia arriba */}
      <div className="absolute -top-3 overflow-hidden" style={{ left: arrowLeft, width: 20, height: 12 }}>
        <div className="w-4 h-4 bg-white dark:bg-slate-800 rotate-45 mx-auto translate-y-2 shadow border border-gray-100" />
      </div>
      {panelContent}
    </div>
  )
}

export default function TourOverlay({ isAuthenticated, blocked }: { isAuthenticated: boolean; blocked?: boolean }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const steps = isAuthenticated ? STEPS_USER : STEPS_GUEST

  const updateRect = useCallback((idx: number) => {
    const s = steps[idx]
    setRect(null)

    if (!s.targetId) return

    const el = findVisibleEl(s.targetId)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const delay = window.innerWidth < 1024 ? 650 : 350
    setTimeout(() => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }, delay)
  }, [steps])

  useEffect(() => {
    if (blocked) return
    const seen = localStorage.getItem('promoar_tour_done')
    if (!seen) {
      const t = setTimeout(() => { setActive(true); updateRect(0) }, 3500)
      return () => clearTimeout(t)
    }
  }, [updateRect, blocked])

  const finish = () => {
    localStorage.setItem('promoar_tour_done', '1')
    setActive(false)
  }

  const next = () => {
    if (step >= steps.length - 1) { finish(); return }
    const n = step + 1
    setStep(n)
    updateRect(n)
  }

  const prev = () => {
    if (step <= 0) return
    const p = step - 1
    setStep(p)
    updateRect(p)
  }

  const relaunch = () => {
    localStorage.removeItem('promoar_tour_done')
    setStep(0)
    setActive(true)
    updateRect(0)
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

  if (!active) {
    return (
      <button
        onClick={relaunch}
        title="Ver tour de funciones"
        className="fixed bottom-20 left-4 lg:bottom-6 lg:left-6 z-40 w-10 h-10 rounded-full bg-[#1E3A5F] text-white text-sm font-black shadow-lg hover:bg-[#162d4a] transition-colors flex items-center justify-center"
      >
        ?
      </button>
    )
  }

  const currentStep = steps[step]

  return (
    <>
      {rect ? <Spotlight rect={rect} /> : <DimOverlay />}

      {isMobile ? (
        <MobileBar
          step={currentStep}
          rect={rect}
          onNext={next}
          onPrev={prev}
          onSkip={finish}
          current={step}
          total={steps.length}
        />
      ) : (
        <DesktopTooltip
          step={currentStep}
          rect={rect}
          onNext={next}
          onPrev={prev}
          onSkip={finish}
          current={step}
          total={steps.length}
        />
      )}
    </>
  )
}
