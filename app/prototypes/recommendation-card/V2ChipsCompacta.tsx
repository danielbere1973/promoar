'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: densidad media — razones como chips (no lista), secundarias como avatares apilados con tooltip implícito por %.
// Menos "carta", más "tarjeta app" — apto para feed con scroll de varias recomendaciones seguidas.
export default function V2ChipsCompacta() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1)' : 'scale(0.98)',
        transition: 'opacity 280ms var(--ease-out), transform 280ms var(--ease-out)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {d.rubro}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            background: 'var(--bg-tint)',
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {d.matchScore}% match
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{d.comercio}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {d.medio} {d.red} · {d.dias}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{d.descuentoPct}%</div>
          {d.tope && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>tope {d.tope}</div>}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.4 }}>{d.tituloNarrativo}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {d.razones.map((r) => (
          <span
            key={r}
            style={{
              fontSize: 11,
              color: 'var(--brand)',
              background: '#eef3f8',
              padding: '4px 9px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {RAZON_LABEL[r]}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>También:</span>
        {SECUNDARIAS.map((s) => (
          <div key={s.comercio} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={22} radius={7} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.descuentoPct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
