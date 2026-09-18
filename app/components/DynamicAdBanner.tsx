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
}

interface CssSlide extends BaseSlide {
  type: 'css'
  title: string
  subtitle: string
  brandName: string
  gradientClasses: string
  logoUrl?: string
  icon?: React.ReactNode
}

type Slide = ImageSlide | CssSlide

const SLIDES: Slide[] = [
  // 1 Banner original de Estación Mascotera
  { 
    type: 'image', 
    src: '/EM/carousel/envios-gratis.webp',       
    alt: 'Envío gratis a partir de $25.000 en CABA — Estación Mascotera',        
    href: 'https://www.estacionmascotera.com.ar/marcas' 
  },
  // Banners Dinámicos CSS (Relevantes para PromoAR)
  {
    type: 'css',
    title: 'Ahorrá en tu súper',
    subtitle: 'Mirá todas las promos vigentes de Coto.',
    brandName: 'Coto',
    href: '/comercios/coto',
    gradientClasses: 'bg-gradient-to-br from-blue-600 to-sky-400 text-white',
    logoUrl: 'https://beneficiosclub.personalpay.dev/partner/Logo_Supermercado_Coto.jpg',
  },
  {
    type: 'css',
    title: 'Multiplicá tus ahorros',
    subtitle: 'Pagá con MODO y sumá reintegros en el acto.',
    brandName: 'MODO',
    href: '/bancos/modo',
    gradientClasses: 'bg-gradient-to-br from-emerald-500 to-teal-400 text-white',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=modo.com.ar',
  },
  {
    type: 'css',
    title: 'Descubrí tus promos',
    subtitle: 'Exprimí al máximo tus tarjetas Galicia.',
    brandName: 'Galicia',
    href: '/bancos/galicia',
    gradientClasses: 'bg-gradient-to-br from-orange-500 to-amber-400 text-white',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=galicia.ar',
  },
  {
    type: 'css',
    title: 'Descuentos exclusivos',
    subtitle: 'Llená el changuito en Carrefour y pagá menos.',
    brandName: 'Carrefour',
    href: '/comercios/carrefour',
    gradientClasses: 'bg-gradient-to-br from-blue-800 to-red-600 text-white',
    logoUrl: 'https://backwebclub-media.glanacion.com/Club.LN-Strapi/A768333_57b63bd572.jpg',
  },
  {
    type: 'css',
    title: 'Ahorrá todos los días',
    subtitle: 'Conocé los beneficios que Santander tiene para vos.',
    brandName: 'Santander',
    href: '/bancos/santander',
    gradientClasses: 'bg-gradient-to-br from-red-600 to-rose-400 text-white',
    logoUrl: 'https://th.bing.com/th/id/OIP.OORn3fPcgxkyv5tmoGvPFgHaG5?w=148&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
  }
]

const DESKTOP_GROUP_SIZE = 3
const DESKTOP_GROUPS = Array.from({ length: Math.ceil(SLIDES.length / DESKTOP_GROUP_SIZE) }, (_, g) =>
  SLIDES.slice(g * DESKTOP_GROUP_SIZE, g * DESKTOP_GROUP_SIZE + DESKTOP_GROUP_SIZE)
)

const AUTOPLAY_MS = 5000

function trackClick(slide: Slide) {
  const slideId = slide.type === 'image' ? 'estacion_mascotera' : slide.brandName.toLowerCase().replace(/\s+/g, '_')
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
        className="object-cover sm:object-contain bg-[#f9eed2]"
        sizes="(min-width: 1024px) 340px, 100vw"
        priority={priority}
      />
    )
  }

  // CSS Banner
  return (
    <div className={`w-full h-full p-4 sm:p-5 flex flex-col justify-between ${slide.gradientClasses}`}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-70 mb-1">
            {slide.brandName}
          </span>
          <h3 className="text-sm sm:text-base font-bold leading-tight drop-shadow-sm max-w-[80%]">
            {slide.title}
          </h3>
        </div>
        <div className="shrink-0 drop-shadow-sm">
          {slide.logoUrl ? (
            <div className="bg-white rounded-full p-1 shadow-sm flex items-center justify-center">
              <img src={slide.logoUrl} alt={slide.brandName} className="w-6 h-6 sm:w-8 sm:h-8 object-contain rounded-full" />
            </div>
          ) : (
            slide.icon
          )}
        </div>
      </div>
      <div className="flex items-end justify-between mt-2">
        <p className="text-xs sm:text-sm font-medium opacity-90 leading-tight max-w-[75%]">
          {slide.subtitle}
        </p>
        <div className="bg-white/20 p-1.5 sm:p-2 rounded-full shrink-0 backdrop-blur-sm">
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
        </div>
        </div>
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
          entityName: slide.type === 'css' ? slide.brandName : null
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
