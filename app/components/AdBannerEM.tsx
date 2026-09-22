'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

interface SponsorSlide {
  src: string
  alt: string
  href: string
}

const SLIDES: SponsorSlide[] = [
  { src: '/EM/carousel/envios-gratis.webp',       alt: 'Envío gratis a partir de $25.000 en CABA — Estación Mascotera',        href: 'https://www.estacionmascotera.com.ar/marcas' },
  { src: '/EM/carousel/ofertas-lanzamiento.webp', alt: 'Ofertas de lanzamiento, hasta 50% off — Estación Mascotera',           href: 'https://www.estacionmascotera.com.ar/ofertas' },
  { src: '/EM/carousel/royal-canin-10off.webp',   alt: '10% off en pouchs Royal Canin — Estación Mascotera',                  href: 'https://www.estacionmascotera.com.ar/promopouchs' },
  { src: '/EM/carousel/monami.webp',              alt: 'Ya están disponibles los productos Mon Ami — Estación Mascotera',    href: 'https://www.estacionmascotera.com.ar/marcas/mon-ami' },
  { src: '/EM/carousel/fawna.webp',               alt: 'Llegó FAWNA a Estación Mascotera',                                   href: 'https://www.estacionmascotera.com.ar/marcas/fawna' },
  { src: '/EM/carousel/ayuda-refugios.webp',      alt: 'Tu compra ayuda a los refugios — Estación Mascotera',                href: 'https://www.estacionmascotera.com.ar/refugios' },
]

// Desktop: 2 tandas de 3 banners en fila, rotando. Mobile: 1 banner a la vez.
const DESKTOP_GROUP_SIZE = 3
const DESKTOP_GROUPS = Array.from({ length: Math.ceil(SLIDES.length / DESKTOP_GROUP_SIZE) }, (_, g) =>
  SLIDES.slice(g * DESKTOP_GROUP_SIZE, g * DESKTOP_GROUP_SIZE + DESKTOP_GROUP_SIZE)
)

const AUTOPLAY_MS = 5000

function trackClick(slideIdx: number) {
  fetch('/api/track/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bannerId: 'em', slide: slideIdx }),
  }).catch(() => {})
}

function SponsorCard({ slide, slideIdx, priority }: { slide: SponsorSlide; slideIdx: number; priority: boolean }) {
  return (
    <a
      href={slide.href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => trackClick(slideIdx)}
      className="relative flex-1 min-w-0 h-full rounded-2xl overflow-hidden bg-[#f9eed2]"
    >
      <Image
        src={slide.src}
        alt={slide.alt}
        fill
        className="object-contain"
        sizes="(min-width: 1024px) 340px, 100vw"
        priority={priority}
      />
    </a>
  )
}

export function AdBannerEM() {
  const [groupIdx, setGroupIdx] = useState(0)
  const [mobileIdx, setMobileIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

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
      className="relative mb-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── MOBILE: 1 banner a la vez ── */}
      <div
        className="relative sm:hidden h-[110px] rounded-2xl overflow-hidden bg-[#f9eed2]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {SLIDES.map((slide, i) => (
          <a
            key={slide.src}
            href={slide.href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => trackClick(i)}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === mobileIdx ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={i !== mobileIdx}
            tabIndex={i === mobileIdx ? 0 : -1}
          >
            <Image src={slide.src} alt={slide.alt} fill className="object-contain" sizes="100vw" priority={i === 0} />
          </a>
        ))}
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5 z-20">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver anuncio ${i + 1}`}
              onClick={() => goToMobile(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === mobileIdx ? 14 : 5,
                background: i === mobileIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: '0 0 2px rgba(0,0,0,0.4)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── DESKTOP: fila de 3, rotando entre 2 tandas ── */}
      <div className="hidden sm:block relative h-[172px]">
        {DESKTOP_GROUPS.map((group, g) => (
          <div
            key={g}
            className={`absolute inset-0 flex gap-3 transition-opacity duration-700 ease-out ${g === groupIdx ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={g !== groupIdx}
          >
            {group.map((slide) => (
              <SponsorCard key={slide.src} slide={slide} slideIdx={SLIDES.indexOf(slide)} priority={g === 0} />
            ))}
          </div>
        ))}
      </div>
      {DESKTOP_GROUPS.length > 1 && (
        <div className="hidden sm:flex justify-center gap-1.5 mt-2">
          {DESKTOP_GROUPS.map((_, g) => (
            <button
              key={g}
              type="button"
              aria-label={`Ver tanda de anuncios ${g + 1}`}
              onClick={() => setGroupIdx(g)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: g === groupIdx ? 18 : 6,
                background: g === groupIdx ? '#94a3b8' : '#e2e8f0',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
