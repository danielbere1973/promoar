'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'

// Axis: personality — tratamiento editorial/story, tipografía grande, espaciado generoso, la promo se narra como un titular, no como un dato.
export default function V9Editorial() {
  const [mounted, setMounted] = useState(false)
  const o = OPORTUNIDAD

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      style={{
        padding: '32px 4px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 340ms cubic-bezier(0.23,1,0.32,1), transform 340ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b6459', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Oportunidad de hoy
      </div>
      <h2
        style={{
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          margin: '0 0 14px',
          color: '#1a1a1a',
          textWrap: 'balance',
        }}
      >
        {o.descuentoPct}% menos en <span style={{ color: '#d94f2b' }}>{o.comercio}</span> pagando con {o.medio}
      </h2>
      <p style={{ fontSize: 15, color: '#6b6459', lineHeight: 1.6, margin: '0 0 20px', maxWidth: '32ch' }}>
        Válido los {o.dias?.toLowerCase()}, con tope de {o.tope}. {o.vencimiento}.
      </p>
      <a
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#1a1a1a',
          borderBottom: '1px solid #1a1a1a',
          paddingBottom: 2,
          cursor: 'pointer',
        }}
      >
        Ver la promo completa →
      </a>
    </div>
  )
}
