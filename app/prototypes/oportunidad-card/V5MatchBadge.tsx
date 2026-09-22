'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'
import LogoImg from './LogoImg'

// Axis: fondo blanco + cintillo superior de categoría en naranja (como el eyebrow "PROMO EN SUPERMERCADOS" de Galicia) — comunica por qué esta promo es relevante para el usuario.
export default function V5MatchBadge() {
  const [mounted, setMounted] = useState(false)
  const o = OPORTUNIDAD

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eae4d8',
        borderRadius: 16,
        padding: 20,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 220ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          color: '#d94f2b',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 12,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d94f2b', display: 'inline-block' }} />
        Ya tenés {o.medio} — te sirve
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <LogoImg o={o} size={40} radius={10} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{o.comercio}</div>
          <div style={{ fontSize: 13, color: '#6b6459' }}>{o.descuentoPct}% de descuento</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b6459' }}>
        <span>{o.dias}</span>
        {o.tope && <span>Tope {o.tope}</span>}
      </div>
    </div>
  )
}
