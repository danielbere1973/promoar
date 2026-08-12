'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'
import LogoImg from './LogoImg'

// Axis: el número (%) es tipografía grande y protagonista, sobre fondo blanco — todo lo demás es texto plano secundario.
export default function V1NumeroDominante() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const o = OPORTUNIDAD

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #eae4d8',
        borderRadius: 16,
        padding: '24px 22px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 220ms cubic-bezier(0.23,1,0.32,1), transform 220ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <LogoImg o={o} size={32} radius={8} fontSize={14} />
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{o.comercio}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#d94f2b',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {o.descuentoPct}%
        </span>
      </div>
      <div style={{ fontSize: 14, color: '#6b6459', marginBottom: 16 }}>de ahorro con {o.medio}</div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b6459', marginBottom: 18 }}>
        {o.dias && <span><strong style={{ color: '#1a1a1a' }}>{o.dias}</strong></span>}
        {o.tope && <span>Tope <strong style={{ color: '#1a1a1a' }}>{o.tope}</strong></span>}
      </div>

      <button
        style={{
          width: '100%',
          padding: '11px 0',
          borderRadius: 999,
          border: 'none',
          background: '#d94f2b',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          transition: 'transform 120ms ease-out, background 150ms ease-out',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Conocer promo
      </button>
    </div>
  )
}
