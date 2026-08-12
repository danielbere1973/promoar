'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: editorial puro — el titular narrativo es lo primero y más grande, el % vive dentro de la frase, no como hero numérico separado.
// La ficha técnica (medio/días/tope) baja de jerarquía, se lee después de entender el consejo.
export default function V3Editorial() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 380ms var(--ease-out), transform 380ms var(--ease-out)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: '24px 22px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={30} radius={9} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {d.rubro}
        </span>
      </div>

      <h2
        style={{
          margin: '0 0 6px',
          fontSize: 25,
          fontWeight: 700,
          lineHeight: 1.22,
          letterSpacing: '-0.015em',
          color: 'var(--text)',
          textWrap: 'balance',
        }}
      >
        Te conviene hacer la compra semanal en <span style={{ color: 'var(--accent)' }}>{d.comercio}</span>: te reintegran{' '}
        <span style={{ color: 'var(--accent)' }}>{d.descuentoPct}%</span> con {d.medio}.
      </h2>

      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '10px 0 18px', lineHeight: 1.55 }}>
        {d.red} {d.segmento} · {d.dias} · hasta {d.tope} de tope. {d.vencimiento}.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
        {d.razones.map((r) => (
          <div key={r} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
            <span style={{ color: 'var(--accent)' }}>—</span>
            {RAZON_LABEL[r]}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        {SECUNDARIAS.map((s) => (
          <div key={s.comercio} style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.comercio}</span> {s.descuentoPct}%
          </div>
        ))}
      </div>
    </div>
  )
}
