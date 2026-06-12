'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, X, ArrowLeft } from 'lucide-react'
import { useTracking } from '@/lib/useTracking'

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: '¿Es gratis?',
    a: 'Sí, 100% gratis. Nunca te vamos a cobrar por ver tus promos.',
  },
  {
    q: '¿Cómo veo las promos para mí?',
    a: 'Cargá tus tarjetas y cuentas en tu perfil (solo el nombre del banco y tipo de tarjeta) y activá "Para mí" en la pantalla de promos. Vas a ver solo las que aplican a vos.',
  },
  {
    q: '¿Puedo buscar un producto?',
    a: 'Sí. Tocá "Buscar producto" y escribí lo que querés comprar (ej: "zapatillas"). Te mostramos en qué comercios hay promo bancaria activa para eso.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Solo guardamos qué bancos y tarjetas tenés (tipo: "Visa Gold del Galicia"). Nunca pedimos contraseñas, claves de homebanking ni datos de tus tarjetas.',
  },
  {
    q: 'Encontré una promo vencida o con error',
    a: (
      <>
        ¡Gracias por avisar! Contanos qué pasó desde{' '}
        <Link href="/contacto" className="underline font-bold">nuestra página de contacto</Link>{' '}
        y la revisamos lo antes posible.
      </>
    ),
  },
  {
    q: '¿Qué bancos y billeteras tienen?',
    a: 'Galicia, BBVA, Santander, Nación, ICBC, Supervielle, Macro, Patagonia, Ciudad, Provincia, Brubank, Naranja X, MODO, MercadoPago, CuentaDNI, y más de 20 entidades.',
  },
]

type Message = { from: 'bot' | 'user'; content: React.ReactNode }

export default function SupportChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const { track } = useTracking()

  if (pathname?.startsWith('/admin')) return null

  const handleQuestion = (index: number) => {
    const { q, a } = QUESTIONS[index]
    setMessages(prev => [...prev, { from: 'user', content: q }, { from: 'bot', content: a }])
    track({ type: 'CHAT_QUESTION_CLICK', question: q })
  }

  const reset = () => setMessages([])

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Cerrar ayuda' : 'Abrir ayuda'}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-12 h-12 rounded-full bg-[#1E3A5F] text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-36 md:bottom-24 right-4 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm h-[60vh] max-h-[480px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1E3A5F] text-white px-4 py-3 flex items-center gap-2">
            {messages.length > 0 ? (
              <button onClick={reset} aria-label="Volver" className="hover:opacity-80">
                <ArrowLeft size={18} />
              </button>
            ) : (
              <MessageCircle size={18} />
            )}
            <div>
              <p className="text-sm font-black leading-none">Asistente PromoAR</p>
              <p className="text-[11px] text-blue-200 mt-0.5">Respuestas rápidas</p>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            <div className="flex">
              <div className="bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[85%]">
                ¡Hola! 👋 Elegí una pregunta o escribinos directo si no encontrás lo que buscás.
              </div>
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                  m.from === 'user'
                    ? 'bg-[#D94F2B] text-white rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-100 rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Preguntas / acciones */}
          <div className="border-t border-gray-100 dark:border-slate-700 px-3 py-3 space-y-1.5 max-h-44 overflow-y-auto shrink-0">
            {QUESTIONS.map((item, i) => (
              <button
                key={item.q}
                onClick={() => handleQuestion(i)}
                className="w-full text-left text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-[#1E3A5F] dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {item.q}
              </button>
            ))}
            <Link
              href="/contacto"
              onClick={() => track({ type: 'CHAT_CONTACT_FALLBACK' })}
              className="block text-center text-xs font-black px-3 py-2 rounded-xl bg-[#1E3A5F] text-white hover:bg-[#16314f] transition-colors"
            >
              No encontré mi respuesta — Contactar
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
