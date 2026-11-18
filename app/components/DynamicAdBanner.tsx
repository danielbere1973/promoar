'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { ArrowRight, CreditCard, ShoppingBag, Zap, Wallet, Tag } from 'lucide-react'

type BannerType = 'image' | 'css'

interface BaseSlide {
  type: BannerType
  href: string
}

interface ImageSlide extends BaseSlide {
  type: 'image'
  src: string
  alt: string
  /** Nombre de marca mostrado en el título del modal de promos ("Promos en {entityName}") */
  entityName?: string
}

interface CssSlide extends BaseSlide {
  type: 'css'
  title: string
  subtitle: string
  brandName: string
  /** Color de marca (hex) usado para el halo y el CTA — reemplaza al gradiente plano anterior. */
  accent: string
  ctaLabel: string
  logoUrl?: string
  icon?: React.ReactNode
}

type Slide = ImageSlide | CssSlide

const SLIDES: Slide[] = [
  // 1 Banner original de Estación Mascotera
  { 
    type: 'image', 
    src: '/EM/carousel/envios-gratis.webp',       
    alt: 'Envío gratis a partir de $32.000 en CABA — Estación Mascotera',
    href: 'https://www.estacionmascotera.com.ar/marcas' 
  },
  // Banners con imagen real (reemplazan a las tarjetas CSS planas — ver banner-specs-sponsors.md)
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/coto.webp',
    alt: 'Ahorrá en tu súper — Mirá todas las promos vigentes de Coto',
    href: '/comercios/coto',
    entityName: 'Coto',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/modo.webp',
    alt: 'Multiplicá tus ahorros — Pagá con MODO y sumá reintegros en el acto',
    href: '/bancos/modo',
    entityName: 'MODO',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/galicia.webp',
    alt: 'Descubrí tus promos — Exprimí al máximo tus tarjetas Galicia',
    href: '/bancos/galicia',
    entityName: 'Galicia',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/carrefour.webp',
    alt: 'Descuentos exclusivos — Llená el changuito en Carrefour y pagá menos',
    href: '/comercios/carrefour',
    entityName: 'Carrefour',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/santander.webp',
    alt: 'Ahorrá todos los días — Conocé los beneficios que Santander tiene para vos',
    href: '/bancos/santander',
    entityName: 'Santander',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/luccianos.webp',
    alt: 'Endulzá tu día — Descubrí las promos vigentes de Lucciano\'s',
    href: '/comercios/lucciano-s',
    entityName: 'Lucciano\'s',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/freddo.webp',
    alt: 'Helado con descuento — Mirá las promos vigentes de Freddo',
    href: '/comercios/freddo',
    entityName: 'Freddo',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/mcdonalds.webp',
    alt: 'Comé y ahorrá — Mirá las promos vigentes de McDonald\'s',
    href: '/comercios/mcdonald-s',
    entityName: 'McDonald\'s',
  },
  {
    type: 'image',
    src: '/EM/carousel/banners-promoar/mostaza.webp',
    alt: 'Más sabor, menos precio — Descubrí las promos vigentes de Mostaza',
    href: '/comercios/mostaza',
    entityName: 'Mostaza',
  },
]

const DESKTOP_GROUP_SIZE = 3
const DESKTOP_GROUPS = Array.from({ length: Math.ceil(SLIDES.length / DESKTOP_GROUP_SIZE) }, (_, g) =>
  SLIDES.slice(g * DESKTOP_GROUP_SIZE, g * DESKTOP_GROUP_SIZE + DESKTOP_GROUP_SIZE)
)

const AUTOPLAY_MS = 5000

function trackClick(slide: Slide) {
  const slideId = slide.type === 'css'
    ? slide.brandName.toLowerCase().replace(/\s+/g, '_')
    : (slide.entityName ?? 'estacion_mascotera').toLowerCase().replace(/\s+/g, '_')
  fetch('/api/track/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bannerId: slideId }),
  }).catch(() => {})
}

function RenderSlide({ slide, priority }: { slide: Slide, priority: boolean }) {
  if (slide.type === 'image') {
    return (
      <Image
        src={slide.src}
        alt={slide.alt}
        fill
        className="object-cover sm:object-contain bg-gray-100"
        sizes="(min-width: 1024px) 340px, 100vw"
        priority={priority}
      />
    )
  }

  // CSS Banner — ficha tipo "credencial de beneficio": logo grande a la izquierda como
  // protagonista, bloque de texto compacto a la derecha, franja de acento vertical como
  // única firma de color (en vez de gradiente/halo ocupando toda la superficie).
  return (
    <div
      className="relative w-full h-full flex overflow-hidden bg-[#0F2040] text-white"
    >
      {/* Franja de acento: identifica la marca de un vistazo, no compite con el texto */}
      <div className="w-1.5 sm:w-2 shrink-0" style={{ background: slide.accent }} />

      {/* Textura de marca sutil: puntos del color de acento, muy baja opacidad, solo decorativa */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(${slide.accent} 1px, transparent 1px)`,
          backgroundSize: '14px 14px',
        }}
      />

      <div className="relative flex-1 min-w-0 flex items-center gap-3 px-3 sm:px-4 py-2.5">
        {(slide.logoUrl || slide.icon) && (
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
            {slide.logoUrl ? (
              <img src={slide.logoUrl} alt={slide.brandName} className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-full" />
            ) : (
              slide.icon
            )}
          </div>
        )}

        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span
            className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] leading-none"
            style={{ color: slide.accent }}
          >
            {slide.brandName}
          </span>
          <h3 className="text-xs sm:text-sm font-black leading-tight truncate">
            {slide.title}
          </h3>
          <p className="text-[11px] sm:text-xs font-medium text-white/65 leading-tight truncate">
            {slide.subtitle}
          </p>
          <span
            className="ad-cta inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold w-fit mt-0.5"
            style={{ color: slide.accent }}
          >
            {slide.ctaLabel}
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>

      <style jsx>{`
        .ad-cta {
          background-image: linear-gradient(currentColor, currentColor);
          background-size: 0% 1.5px;
          background-position: 0 100%;
          background-repeat: no-repeat;
          padding-bottom: 1px;
          transition: background-size 0.25s ease-out;
        }
        :global(.group:hover) .ad-cta {
          background-size: 100% 1.5px;
        }
      `}</style>
    </div>
  )
}

import AdPromoModal from './AdPromoModal'

function SponsorCard({ slide, slideIdx, priority, onClick }: { slide: Slide; slideIdx: number; priority: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <a
      href={slide.href}
      target={slide.href.startsWith('/') ? undefined : "_blank"}
      rel={slide.href.startsWith('/') ? undefined : "noopener noreferrer sponsored"}
      onClick={onClick}
      className="relative flex-1 min-w-0 h-full rounded-2xl overflow-hidden group shadow-sm hover:shadow-md transition-shadow cursor-pointer block"
    >
      <RenderSlide slide={slide} priority={priority} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
    </a>
  )
}

export function DynamicAdBanner() {
  const [groupIdx, setGroupIdx] = useState(0)
  const [mobileIdx, setMobileIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [modalConfig, setModalConfig] = useState<{ entityType: 'bancos' | 'comercios' | null, entitySlug: string | null, entityName: string | null }>({ entityType: null, entitySlug: null, entityName: null })
  const touchStartX = useRef<number | null>(null)

  const handleBannerClick = (e: React.MouseEvent, slide: Slide, slideIdx: number) => {
    trackClick(slide)
    if (slide.href.startsWith('/bancos/') || slide.href.startsWith('/comercios/')) {
      e.preventDefault()
      const parts = slide.href.split('/')
      if (parts.length >= 3) {
        setModalConfig({
          entityType: parts[1] as 'bancos' | 'comercios',
          entitySlug: parts[2],
          entityName: slide.type === 'css' ? slide.brandName : slide.entityName ?? null
        })
      }
    }
  }

  const goToMobile = useCallback((i: number) => {
    setMobileIdx(((i % SLIDES.length) + SLIDES.length) % SLIDES.length)
  }, [])

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setGroupIdx(g => (g + 1) % DESKTOP_GROUPS.length)
      setMobileIdx(i => (i + 1) % SLIDES.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [paused])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 40) {
      delta < 0 ? goToMobile(mobileIdx + 1) : goToMobile(mobileIdx - 1)
    }
    touchStartX.current = null
  }

  return (
    <div
      className="relative mb-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── MOBILE: 1 banner a la vez ── */}
      <div
        className="relative sm:hidden h-[130px] rounded-2xl overflow-hidden bg-gray-100 shadow-inner"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {SLIDES.map((slide, i) => (
          <a
            key={i}
            href={slide.href}
            target={slide.href.startsWith('/') ? undefined : "_blank"}
            rel={slide.href.startsWith('/') ? undefined : "noopener noreferrer sponsored"}
            onClick={(e) => handleBannerClick(e, slide, i)}
            className={`absolute inset-0 transition-all duration-700 ease-out transform ${
              i === mobileIdx ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-8 pointer-events-none'
            }`}
            aria-hidden={i !== mobileIdx}
            tabIndex={i === mobileIdx ? 0 : -1}
          >
            <RenderSlide slide={slide} priority={i === 0} />
          </a>
        ))}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-20">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver anuncio ${i + 1}`}
              onClick={() => goToMobile(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === mobileIdx ? 16 : 6,
                background: i === mobileIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                boxShadow: '0 0 4px rgba(0,0,0,0.3)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── DESKTOP: fila de 3, rotando entre 2 tandas ── */}
      <div className="hidden sm:block relative h-[140px]">
        {DESKTOP_GROUPS.map((group, g) => (
          <div
            key={g}
            className={`absolute inset-0 flex gap-4 transition-all duration-700 ease-out transform ${
              g === groupIdx ? 'opacity-100 translate-y-0 z-10' : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
            aria-hidden={g !== groupIdx}
          >
            {group.map((slide, i) => (
              <SponsorCard 
              key={i} 
              slide={slide} 
              slideIdx={g * DESKTOP_GROUP_SIZE + i} 
              priority={g === 0} 
              onClick={(e) => handleBannerClick(e, slide, g * DESKTOP_GROUP_SIZE + i)}
            />
          ))}
          </div>
        ))}
      </div>
      {DESKTOP_GROUPS.length > 1 && (
        <div className="hidden sm:flex justify-center gap-2 mt-3">
          {DESKTOP_GROUPS.map((_, g) => (
            <button
              key={g}
              type="button"
              aria-label={`Ver tanda de anuncios ${g + 1}`}
              onClick={() => setGroupIdx(g)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: g === groupIdx ? 24 : 8,
                background: g === groupIdx ? '#64748b' : '#cbd5e1',
              }}
            />
          ))}
        </div>
      )}

      <AdPromoModal 
        isOpen={modalConfig.entityType !== null} 
        onClose={() => setModalConfig({ entityType: null, entitySlug: null, entityName: null })} 
        entityType={modalConfig.entityType as 'bancos' | 'comercios' | null}
        entitySlug={modalConfig.entitySlug}
        entityName={modalConfig.entityName}
      />
    </div>
  )
}
