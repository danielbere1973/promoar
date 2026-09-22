'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD, SIBLINGS } from './data'
import LogoImg from './LogoImg'

// Axis: interaction model — la card principal se compara inline contra la 2da mejor alternativa del mismo rubro, justificando por qué esta gana (analítico, pero en la misma paleta clara/sobria del resto).
export default function V7Comparativa() {
  const [mounted, setMounted] = useState(false)
  const o = OPORTUNIDAD
  const alt = SIBLINGS[1] // Coto, mismo rubro

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eae4d8',
        borderRadius: 16,
        padding: 18,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 260ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div style={{ fontSize: 11, color: '#6b6459', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Mejor opción en Supermercados
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <LogoImg o={o} size={40} radius={10} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{o.comercio}</div>
          <div style={{ fontSize: 12, color: '#6b6459' }}>{o.medio}</div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#d94f2b' }}>{o.descuentoPct}%</div>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: '#f4f1ea',
          overflow: 'hidden',
          marginBottom: 14,
          display: 'flex',
        }}
      >
        <div
          style={{
            width: mounted ? `${(o.descuentoPct / 25) * 100}%` : '0%',
            background: '#d94f2b',
            borderRadius: 3,
            transition: 'width 500ms cubic-bezier(0.23,1,0.32,1) 100ms',
          }}
        />
      </div>

      <div
        style={{
          borderTop: '1px solid #eae4d8',
          paddingTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoImg o={alt} size={24} radius={6} fontSize={11} />
          <span style={{ fontSize: 13, color: '#6b6459' }}>
            vs. {alt.comercio} ({alt.medio})
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a39d90' }}>{alt.descuentoPct}%</span>
      </div>
    </div>
  )
}
