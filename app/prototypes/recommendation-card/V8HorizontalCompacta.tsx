'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: horizontal compacta — misma lógica de 3 franjas que Galicia pero en una sola fila baja
// (logo | narrativa+número | por qué en 2 líneas), sin dividers verticales duros. Pensada para
// listas densas de rubro donde varias recomendaciones se apilan una debajo de otra.
export default function V8HorizontalCompacta() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 680,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateX(0)' : 'translateX(-8px)',
        transition: 'opacity 300ms var(--ease-out), transform 300ms var(--ease-out)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={48} radius={12} />

      <div style={{ flexShrink: 0, width: 172 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {d.rubro}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '2px 0 4px' }}>{d.comercio}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{d.descuentoPct}%</div>
      </div>

      <div style={{ flexShrink: 0, width: 150, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.medio}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.red} {d.segmento}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.dias}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>tope {d.tope}</div>
      </div>

      <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 16, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Por qué te la mostramos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {d.razones.map((r) => (
            <span
              key={r}
              style={{
                fontSize: 10.5,
                color: 'var(--brand)',
                background: '#eef3f8',
                padding: '3px 8px',
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {RAZON_LABEL[r]}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {SECUNDARIAS.map((s) => (
            <div key={s.comercio} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={18} radius={6} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.comercio} <strong style={{ color: 'var(--text)' }}>{s.descuentoPct}%</strong></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
