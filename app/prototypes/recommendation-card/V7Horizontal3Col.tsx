'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: horizontal 3 columnas — inspirado directamente en el layout real de Galicia que trajo el CPO
// (logo aislado | beneficio grande + condición corta | texto largo con scroll propio + badge).
// Pensado para desktop/catálogo ancho, no para feed mobile. Columna 3 lleva el "por qué" en vez de T&C.
export default function V7Horizontal3Col() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 320ms var(--ease-out), transform 320ms var(--ease-out)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {d.rubro}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 1fr',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRight: '1px solid var(--border)',
          }}
        >
          <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={64} radius={12} />
        </div>

        <div
          style={{
            padding: '18px 20px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.1, marginBottom: 4 }}>
            {d.descuentoPct}% de reintegro
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>hasta {d.tope}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {d.medio} {d.red} {d.segmento}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.dias}</div>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          <span
            style={{
              alignSelf: 'flex-start',
              fontSize: 10.5,
              fontWeight: 700,
              color: '#fff',
              background: 'var(--text)',
              padding: '3px 9px',
              borderRadius: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {d.tituloNarrativo.split(' ').slice(0, 3).join(' ')}…
          </span>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>Por qué te la mostramos</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.razones.map((r) => (
              <li key={r} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                · {RAZON_LABEL[r]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', alignSelf: 'center' }}>También vimos:</span>
        {SECUNDARIAS.map((s) => (
          <div
            key={s.comercio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 10px 6px 6px',
            }}
          >
            <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={22} radius={7} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.comercio} {s.descuentoPct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
