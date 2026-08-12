'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'
import LogoImg from './LogoImg'

// Axis: urgencia temporal, con tinte naranja suave (no dark) y un punto que respira — pensado para "vence hoy", sin salirse de la sobriedad de las referencias.
export default function V6ContextoTemporal() {
  const [mounted, setMounted] = useState(false)
  const [pulse, setPulse] = useState(false)
  const o = OPORTUNIDAD

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => setPulse((p) => !p), 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        background: '#fdf3ec',
        border: '1px solid #f3e4d6',
        borderRadius: 16,
        padding: 20,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 220ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#d94f2b',
            transform: pulse ? 'scale(1.3)' : 'scale(1)',
            opacity: pulse ? 0.6 : 1,
            transition: 'transform 900ms ease-in-out, opacity 900ms ease-in-out',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d94f2b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {o.vencimiento}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <LogoImg o={o} size={40} radius={10} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{o.comercio}</div>
          <div style={{ fontSize: 13, color: '#6b6459' }}>{o.medio} · {o.red}</div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #f3e4d6',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13, color: '#4a453d' }}>Solo por hoy</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#d94f2b' }}>{o.descuentoPct}%</span>
      </div>
    </div>
  )
}
