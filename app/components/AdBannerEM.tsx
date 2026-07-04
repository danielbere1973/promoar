'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

const PHOTOS = [
  { src: '/EM/gala_1.jpeg',    alt: 'Gala',    pos: '30% 52%' },
  { src: '/EM/gato_2.jpeg',    alt: 'Gato',    pos: '50% 20%' },
  { src: '/EM/merlina_1.jpeg', alt: 'Merlina', pos: '50% 50%' },
  { src: '/EM/firu_1.jpeg',    alt: 'Firu',    pos: '30% 8%'  },
  { src: '/EM/gato_1.jpeg',    alt: 'Gatito',  pos: '50% 8%'  },
  { src: '/EM/gato_3.jpeg',    alt: 'Gato 3',  pos: '50% 5%'  },
]

function IgIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  )
}

function TikTokIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.19 8.19 0 0 0 4.79 1.53V6.75a4.85 4.85 0 0 1-1.02-.06z"/>
    </svg>
  )
}

export function AdBannerEM() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PHOTOS.length), 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <>
    {/* ── MOBILE ── */}
    <a
      href="https://www.estacionmascotera.com.ar"
      target="_blank"
      rel="noopener noreferrer"
      className="mb-4 flex sm:hidden items-stretch rounded-2xl overflow-hidden"
      style={{ background: '#f9eed2', minHeight: 100 }}
    >
      {/* Logo */}
      <div className="relative shrink-0" style={{ width: 100, minHeight: 100, background: 'rgba(255,255,255,0.3)' }}>
        <Image src="/EM/logo-mundial-transparente.png" alt="Estación Mascotera" fill className="object-contain p-2" priority />
      </div>

      {/* Divisor */}
      <div className="w-px self-stretch my-3 shrink-0" style={{ background: '#ea912d', opacity: 0.4 }} />

      {/* Contenido */}
      <div className="flex-1 flex flex-col justify-between px-2 py-3 min-w-0">
        <div>
          <p className="font-black text-[16px] leading-tight" style={{ color: '#3d27c8' }}>Estación Mascotera</p>
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#ac620d' }}>Alimento y accesorios para mascotas</p>
        </div>
        <div>
          <p className="text-[11px] font-black" style={{ color: '#d74c35' }}>🚚 Envíos gratis a CABA desde $25.000</p>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <IgIcon size={12} />
              <span className="text-[10px] font-bold" style={{ color: '#000' }}>estacion_mascotera_pet_shop</span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <TikTokIcon size={12} />
            <span className="text-[10px] font-bold" style={{ color: '#000' }}>estacion.mascotera</span>
          </div>
        </div>
      </div>
    </a>

    {/* ── DESKTOP ── */}
    <a
      href="https://www.estacionmascotera.com.ar"
      target="_blank"
      rel="noopener noreferrer"
      className="mb-4 hidden sm:flex items-stretch rounded-2xl overflow-hidden h-[172px] group"
      style={{ background: '#f9eed2' }}
    >

      {/* ── 1. LOGO — columna izquierda, full height ── */}
      <div className="relative shrink-0 h-full aspect-square">
        <Image
          src="/EM/logo-mundial-transparente.png"
          alt="Estación Mascotera"
          fill
          className="object-contain p-1 sm:p-1.5"
          priority
        />
      </div>

      <div className="w-px self-stretch my-3 shrink-0" style={{ background: '#ea912d', opacity: 0.35 }} />

      {/* ── 2. FOTO CAROUSEL — círculo casi full height ── */}
      <div
        className="relative shrink-0 self-center rounded-full overflow-hidden mx-2 sm:mx-3 w-[116px] h-[116px] sm:w-[156px] sm:h-[156px]"
        style={{
          border: '3px solid #d74c35',
          boxShadow: '0 0 0 2px #f9eed2, 0 0 0 4px #ea912d',
        }}
      >
        {PHOTOS.map((p, i) => (
          <div
            key={p.src}
            className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image
              src={p.src}
              alt={p.alt}
              fill
              className="object-cover"
              style={{ objectPosition: p.pos }}
              sizes="(min-width: 640px) 156px, 116px"
              priority={i === 0}
            />
          </div>
        ))}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
          {PHOTOS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 12 : 4,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── 3. CONTENIDO ── */}
      <div className="flex-1 flex flex-col min-w-0 px-2 sm:px-4 pt-2.5 pb-2">

        {/* Nombre — grande, pegado arriba */}
        <p className="font-black text-[15px] sm:text-[20px] leading-tight" style={{ color: '#3d27c8' }}>
          Estación Mascotera
        </p>
        <p className="text-[9px] sm:text-[11px] font-semibold mt-0.5" style={{ color: '#ac620d' }}>
          Alimento y accesorios para mascotas
        </p>

        <div className="my-1.5 h-px" style={{ background: '#ea912d', opacity: 0.4 }} />

        <p className="text-[10px] sm:text-[12px] font-black leading-snug" style={{ color: '#d74c35' }}>
          🚚 Envíos gratis a CABA desde $25.000
        </p>

        {/* Redes — abajo, negras, grandes */}
        <div className="mt-auto flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <IgIcon size={13} />
            <span className="text-[10px] sm:text-[12px] font-bold leading-none" style={{ color: '#000' }}>
              @estacion_mascotera_pet_shop
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TikTokIcon size={13} />
            <span className="text-[10px] sm:text-[12px] font-bold leading-none" style={{ color: '#000' }}>
              estacion.mascotera
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. MARCAS — solo desktop grande ── */}
      <div className="hidden lg:flex items-center shrink-0 px-1">
        <div className="relative" style={{ width: 440, height: 160 }}>
          <Image
            src="/EM/marcas.png"
            alt="Nuestras marcas"
            fill
            className="object-contain object-center"
          />
        </div>
      </div>

      {/* ── 5. QR — columna derecha, full height ── */}
      <div
        className="hidden sm:block relative shrink-0 h-full"
        style={{ width: 140, background: 'rgba(255,255,255,0.4)' }}
      >
        <Image
          src="/EM/qr_estacion_mascotera.png"
          alt="QR Estación Mascotera"
          fill
          className="object-contain p-2.5"
        />
      </div>

    </a>
    </>
  )
}
