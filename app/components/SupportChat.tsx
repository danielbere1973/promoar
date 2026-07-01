'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, X, ArrowLeft } from 'lucide-react'
import { useTracking } from '@/lib/useTracking'

type QA = { q: string; a: React.ReactNode }
type Category = { label: string; icon: string; questions: QA[] }

const CATEGORIES: Category[] = [
  {
    label: '¿Qué es PromoAR?',
    icon: '💡',
    questions: [
      {
        q: '¿Qué es PromoAR y para qué sirve?',
        a: 'PromoAR reúne todas las promos bancarias de Argentina en un solo lugar — descuentos, cuotas sin interés y reintegros de más de 20 bancos y billeteras. Podés filtrarlas por tus tarjetas, tu banco, el día de la semana o la categoría (supermercados, combustible, farmacias, etc.).',
      },
      {
        q: '¿Es gratis?',
        a: <>Sí, 100% gratis. Nunca te vamos a cobrar nada. <Link href="/registro" className="underline font-bold">Registrate acá</Link> sin costo.</>,
      },
      {
        q: '¿Qué bancos y billeteras tienen?',
        a: 'Galicia, BBVA, Santander, Nación, ICBC, Supervielle, Macro, Patagonia, Ciudad, Credicoop, Cabal, MODO, MercadoPago, CuentaDNI, Personal Pay, Naranja X, Uala, Brubank, Favacard y más. Se agregan entidades constantemente.',
      },
      {
        q: '¿Con qué frecuencia se actualizan las promos?',
        a: <>Corremos scrapers automáticos que actualizan las promos de cada banco regularmente. Si ves una promo desactualizada, <Link href="/contacto" className="underline font-bold">avisanos acá</Link> y la revisamos.</>,
      },
      {
        q: '¿Por qué conviene usarlo en vez de ir al sitio de cada banco?',
        a: 'Porque en lugar de entrar a 20 sitios distintos, acá las tenés todas juntas, filtradas para vos, por día y categoría. Te ahorra horas de búsqueda y no te perdés ninguna.',
      },
    ],
  },
  {
    label: 'Mi cuenta y perfil',
    icon: '👤',
    questions: [
      {
        q: '¿Para qué sirve registrarme?',
        a: <>Al <Link href="/registro" className="underline font-bold">registrarte</Link> podés cargar tu perfil financiero (bancos, billeteras y tarjetas) y activar "Para mí" — así solo ves las promos que te aplican a vos. También guardás favoritas y activás alertas personalizadas.</>,
      },
      {
        q: '¿Puedo usar la app sin registrarme?',
        a: <>Sí, podés <Link href="/promos" className="underline font-bold">ver todas las promos</Link> sin cuenta. Pero sin registro no podés filtrar "Para mí", guardar favoritas ni recibir alertas.</>,
      },
      {
        q: '¿Cómo cargo mi perfil financiero?',
        a: <>Entrá a <Link href="/perfil?tab=finance" className="underline font-bold">tu perfil → Financiero</Link>. Ahí agregás tu banco, billetera y las tarjetas que tenés. Es muy rápido y solo lo hacés una vez.</>,
      },
      {
        q: '¿Qué datos me piden para el perfil?',
        a: 'Solo el nombre del banco o billetera y el tipo de tarjeta (ej: Visa Gold del Galicia). Nunca pedimos contraseñas, claves bancarias, número de tarjeta ni nada parecido.',
      },
      {
        q: '¿Puedo cargar más de un banco o tarjeta?',
        a: 'Sí, podés cargar todos los que tenés. Cuantos más cargues, más preciso es el filtro "Para mí".',
      },
      {
        q: '¿Para qué sirve cargar mi provincia?',
        a: 'Para mostrarte promos disponibles en tu zona. Algunas promos aplican solo en ciertas provincias o en sucursales específicas. Con tu provincia filtramos lo que es relevante para donde estás.',
      },
      {
        q: '¿Cómo cambio o borro mis datos?',
        a: <>Desde <Link href="/perfil" className="underline font-bold">tu perfil</Link> podés editar o eliminar cualquier dato en cualquier momento. Para borrar tu cuenta completamente, <Link href="/contacto" className="underline font-bold">escribinos acá</Link>.</>,
      },
    ],
  },
  {
    label: 'Cómo funcionan las promos',
    icon: '🏷️',
    questions: [
      {
        q: '¿Qué significa "Para mí" vs "Todas"?',
        a: '"Todas" muestra todas las promos activas. "Para mí" filtra solo las que aplican a tus bancos, billeteras y tarjetas cargadas en tu perfil. Para usarlo tenés que estar registrado y tener el perfil financiero cargado.',
      },
      {
        q: '¿Qué significa el filtro "Hoy" y "Semana"?',
        a: '"Hoy" muestra solo las promos válidas para el día de hoy (algunas aplican solo lunes, martes, etc.). "Semana" muestra las de toda la semana para que puedas planificar tus compras.',
      },
      {
        q: '¿Qué son las promos destacadas?',
        a: 'Son las promos con mayor descuento del día dentro de las categorías más populares (supermercados, combustible, gastronomía, farmacias y transporte). Las mostramos primero para que no te las pierdas.',
      },
      {
        q: '¿Qué significa el tope de reintegro?',
        a: 'Es el máximo que te devuelven, sin importar cuánto gastes. Por ejemplo, "30% hasta $5.000" significa que si gastás $20.000 te devuelven $5.000 (no $6.000). Es por período (mes, quincena, semana, etc.).',
      },
      {
        q: '¿Qué son las cuotas sin interés?',
        a: 'Son cuotas donde el precio final es el mismo que pagar en una sola cuota — el banco absorbe el costo financiero. Por ejemplo, "12 cuotas sin interés" en un producto de $120.000 = 12 pagos de $10.000.',
      },
      {
        q: '¿Cómo sé si una promo aplica en el local que voy?',
        a: 'En la tarjeta de la promo se indica el comercio o comercios donde aplica. Algunas son para cadenas nacionales (aplica en todos los locales), otras son para sucursales específicas. Siempre conviene confirmar en el local antes de pagar.',
      },
      {
        q: '¿Cómo busco promos por categoría?',
        a: 'Tocá el botón de categorías (el ícono de grilla) en la pantalla principal. Podés elegir una o varias categorías: supermercados, combustible, gastronomía, farmacias, indumentaria, tecnología y más.',
      },
      {
        q: '¿Puedo guardar promos favoritas?',
        a: 'Sí, con el ícono de corazón en cada tarjeta de promo. Tus favoritas aparecen en tu perfil para encontrarlas rápido.',
      },
      {
        q: '¿Qué significa NxM (ej: 2x1)?',
        a: 'Que pagás N y llevás M. Por ejemplo, 2x1 = pagás 1 y llevás 2. 3x2 = pagás 2 y llevás 3. Muy común en gastronomía y entretenimiento.',
      },
    ],
  },
  {
    label: 'Buscador de productos',
    icon: '🔍',
    questions: [
      {
        q: '¿Puedo buscar un producto específico?',
        a: 'Sí. Tocá "Buscar producto" o "Productos" en la pantalla principal y escribí lo que querés comprar (ej: "zapatillas Nike", "notebook", "perfume"). Te mostramos en qué comercios con promo bancaria activa podés encontrarlo.',
      },
      {
        q: '¿Cómo funciona el buscador de productos?',
        a: 'Buscamos en nuestro catálogo de productos de comercios con promos activas. Si el comercio tiene descuento bancario y vende lo que buscás, aparece en los resultados. Ideal para planificar una compra grande.',
      },
      {
        q: '¿Puedo buscar por nombre de comercio?',
        a: 'Sí, en el buscador de la pantalla principal podés escribir el nombre del comercio (ej: "Coto", "Farmacity", "YPF") y ver todas sus promos activas.',
      },
      {
        q: '¿Por qué no aparece el producto que busco?',
        a: 'El catálogo cubre comercios con promos bancarias activas. Si el comercio no tiene promo o no está en el catálogo, no va a aparecer. Lo vamos ampliando constantemente.',
      },
    ],
  },
  {
    label: 'Alertas',
    icon: '🔔',
    questions: [
      {
        q: '¿Cómo activo las alertas de promos?',
        a: <>Entrá a <Link href="/perfil?tab=notif" className="underline font-bold">tu perfil → Notificaciones</Link>. Ahí activás las notificaciones push del navegador y elegís las categorías que te interesan. Te avisamos cuando aparezca una promo nueva relevante para vos.</>,
      },
      {
        q: '¿Qué tipo de alertas puedo configurar?',
        a: 'Podés configurar alertas por categoría (ej: solo supermercados y combustible). Estamos trabajando en alertas por comercio específico y por descuento mínimo para los próximos meses.',
      },
      {
        q: '¿Las alertas llegan al celular?',
        a: 'Sí, como notificaciones push del navegador. En Android funciona perfectamente. En iPhone (iOS Safari) tiene limitaciones — funciona si la app está abierta o recién usada.',
      },
      {
        q: '¿Por qué no me llegó una alerta?',
        a: 'Revisá que las notificaciones estén activadas en la configuración de tu navegador (no solo en PromoAR). En iOS también asegurate de haber agregado la app al inicio como PWA.',
      },
      {
        q: '¿Puedo desactivar las alertas?',
        a: <>Sí, desde <Link href="/perfil?tab=notif" className="underline font-bold">tu perfil → Notificaciones</Link> podés desactivarlas en cualquier momento, o eliminar categorías específicas.</>,
      },
    ],
  },
  {
    label: 'Newsletter',
    icon: '📩',
    questions: [
      {
        q: '¿Qué es el newsletter de PromoAR?',
        a: 'Un resumen semanal con las mejores promos de la semana, enviado a tu email. Sin spam, sin publicidad, solo las promos más relevantes.',
      },
      {
        q: '¿Cómo me suscribo al newsletter?',
        a: <>Podés suscribirte al <Link href="/registro" className="underline font-bold">registrarte</Link> (tildando el checkbox) o después desde <Link href="/perfil?tab=notif" className="underline font-bold">tu perfil → Notificaciones</Link> → activando el toggle "Resumen semanal de promos".</>,
      },
      {
        q: '¿Con qué frecuencia llega?',
        a: 'Una vez por semana. No te vamos a mandar mails todos los días.',
      },
      {
        q: '¿Cómo me doy de baja?',
        a: <>Desde el link "Cancelar suscripción" al pie de cualquier email que te mandemos, o desde <Link href="/perfil?tab=notif" className="underline font-bold">tu perfil → Notificaciones</Link> → desactivando el toggle del newsletter.</>,
      },
    ],
  },
  {
    label: 'Privacidad y seguridad',
    icon: '🔒',
    questions: [
      {
        q: '¿Mis datos están seguros?',
        a: 'Sí. Usamos autenticación segura (NextAuth), contraseñas encriptadas y conexión HTTPS. Tu información está alojada en servidores seguros.',
      },
      {
        q: '¿Guardan los datos de mis tarjetas?',
        a: 'Solo guardamos el banco y el tipo de tarjeta (ej: "Visa Gold"). Nunca pedimos ni guardamos el número de tarjeta, código de seguridad, fecha de vencimiento ni nada parecido.',
      },
      {
        q: '¿Pueden ver mis movimientos bancarios?',
        a: 'No. PromoAR no se conecta a tu banco ni tiene acceso a tu cuenta. Solo usamos la info que vos nos cargás manualmente en el perfil.',
      },
      {
        q: '¿Comparten mis datos con terceros?',
        a: <>No vendemos ni compartimos tus datos personales con terceros. Podés leer nuestra <Link href="/privacidad" className="underline font-bold">política de privacidad</Link> completa acá.</>,
      },
    ],
  },
  {
    label: 'Problemas y errores',
    icon: '⚠️',
    questions: [
      {
        q: 'Encontré una promo vencida o con error',
        a: (
          <>
            ¡Gracias por avisar! Ayudás a mejorar la app. Contanos qué pasó desde{' '}
            <Link href="/contacto" className="underline font-bold">nuestra página de contacto</Link>{' '}
            con el nombre de la promo y el banco. La revisamos lo antes posible.
          </>
        ),
      },
      {
        q: 'No me carga la app o no aparecen promos',
        a: <>Probá recargar la página. Si el problema persiste, limpiá la caché del navegador. Si seguís con problemas, <Link href="/contacto" className="underline font-bold">escribinos acá</Link> y te ayudamos.</>,
      },
      {
        q: 'El filtro "Para mí" no me muestra promos',
        a: <>Verificá que tengas el perfil financiero cargado (<Link href="/perfil?tab=finance" className="underline font-bold">perfil → Financiero</Link>). Si lo cargaste y aun así no ves nada, puede ser que no haya promos activas hoy para tus tarjetas. Probá con el filtro "Semana" o desactivá "Para mí" para ver todas.</>,
      },
      {
        q: 'El descuento en el local no coincide con el de la app',
        a: 'Las promos las publicamos tal como las informan los bancos. Si hay diferencia en el local, puede ser que la promo haya cambiado recientemente. Siempre conviene confirmar con el banco o el local antes de pagar.',
      },
      {
        q: 'No me llega el email de verificación',
        a: <>Revisá la carpeta de spam. Si no está ahí, desde la pantalla de verificación podés reenviar el código. Si el problema continúa, <Link href="/contacto" className="underline font-bold">escribinos acá</Link>.</>,
      },
    ],
  },
]

type Message = { from: 'bot' | 'user'; content: React.ReactNode }

export default function SupportChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const { track } = useTracking()

  if (pathname?.startsWith('/admin')) return null

  function handleQuestion(cat: number, qi: number) {
    const { q, a } = CATEGORIES[cat].questions[qi]
    setMessages(prev => [...prev, { from: 'user', content: q }, { from: 'bot', content: a }])
    track({ type: 'CHAT_QUESTION_CLICK', question: q })
  }

  function reset() {
    setMessages([])
    setActiveCat(null)
  }

  const showCategories = messages.length === 0 && activeCat === null
  const showQuestions = activeCat !== null && messages.length === 0

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
        <div className="fixed bottom-36 md:bottom-24 right-4 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm h-[65vh] max-h-[520px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-[#1E3A5F] text-white px-4 py-3 flex items-center gap-2 shrink-0">
            {(!showCategories) ? (
              <button onClick={reset} aria-label="Volver" className="hover:opacity-80">
                <ArrowLeft size={18} />
              </button>
            ) : (
              <MessageCircle size={18} />
            )}
            <div>
              <p className="text-sm font-black leading-none">Asistente PromoAR</p>
              <p className="text-[11px] text-blue-200 mt-0.5">
                {showCategories ? 'Elegí un tema' : showQuestions ? CATEGORIES[activeCat!].label : 'Respuestas rápidas'}
              </p>
            </div>
          </div>

          {/* Cuerpo — mensajes */}
          {messages.length > 0 && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] leading-relaxed ${
                    m.from === 'user'
                      ? 'bg-[#D94F2B] text-white rounded-tr-sm'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-100 rounded-tl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <button
                  onClick={reset}
                  className="text-xs text-[#1E3A5F] dark:text-blue-300 font-bold hover:underline"
                >
                  ← Ver más preguntas
                </button>
              </div>
            </div>
          )}

          {/* Categorías */}
          {showCategories && (
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 px-1">
                👋 ¡Hola! ¿Sobre qué tema tenés una pregunta?
              </p>
              <div className="space-y-1.5">
                {CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.label}
                    onClick={() => setActiveCat(i)}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="text-base shrink-0">{cat.icon}</span>
                    <span className="text-xs font-bold text-[#1E3A5F] dark:text-blue-300">{cat.label}</span>
                    <span className="ml-auto text-gray-300 dark:text-slate-600 text-xs">{cat.questions.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preguntas de la categoría elegida */}
          {showQuestions && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              {CATEGORIES[activeCat!].questions.map((item, qi) => (
                <button
                  key={item.q}
                  onClick={() => handleQuestion(activeCat!, qi)}
                  className="w-full text-left text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-[#1E3A5F] dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors leading-snug"
                >
                  {item.q}
                </button>
              ))}
            </div>
          )}

          {/* Footer — contacto */}
          <div className="border-t border-gray-100 dark:border-slate-700 px-3 py-2.5 shrink-0">
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
