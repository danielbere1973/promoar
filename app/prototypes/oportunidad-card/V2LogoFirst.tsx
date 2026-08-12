'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'

// Axis: bloque de imagen/color arriba (como las fotos de Galicia), texto plano abajo — el layout más cercano a la referencia de Galicia.
export default function V2LogoFirst() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const o = OPORTUNIDAD

  return (
    <div
      style={{
        background: '#fdf3ec',
        border: '1px solid #f3e4d6',
        borderRadius: 20,
        overflow: 'hidden',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 220ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div style={{ padding: '18px 18px 0' }}>
        <div
          style={{
            height: 130,
            borderRadius: 14,
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${o.logoColor}22 0%, ${o.logoColor}0d 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.logoUrl}
            alt={o.comercio}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            style={{ maxWidth: '60%', maxHeight: '60%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      </div>

      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#d94f2b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          Promo en {o.categoria}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>{o.comercio}</div>
        <div style={{ fontSize: 14, color: '#4a453d', marginBottom: 4 }}>
          Hasta {o.descuentoPct}% de ahorro con {o.medio}.
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 }}>{o.dias}</div>

        <button
          style={{
            padding: '10px 22px',
            borderRadius: 999,
            border: 'none',
            background: '#d94f2b',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'transform 120ms ease-out',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Conocer promo
        </button>
      </div>
    </div>
  )
}
