'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'
import LogoImg from './LogoImg'

// Axis: personality — quiet/borders, tipografía chica, casi sin motion. Herramienta de uso diario, no un momento especial.
export default function V8Minimal() {
  const [mounted, setMounted] = useState(false)
  const o = OPORTUNIDAD

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      style={{
        border: '1px solid #eae4d8',
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 180ms ease-out, border-color 150ms ease-out',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d4cdbe')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#eae4d8')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoImg o={o} size={28} radius={8} fontSize={12} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{o.comercio}</div>
          <div style={{ fontSize: 12, color: '#6b6459' }}>{o.medio}</div>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>
        {o.descuentoPct}%
      </div>
    </div>
  )
}
