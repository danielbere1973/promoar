'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: split visual — columna izquierda ancla numérica (el "qué gano"), columna derecha razona.
// Las secundarias se resuelven como mini-tabla comparativa (no lista suelta) para reforzar "por qué esta y no esas".
export default function V4SplitComparativa() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA
  const max = Math.max(d.descuentoPct, ...SECUNDARIAS.map((s) => s.descuentoPct))

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 320ms var(--ease-out), transform 320ms var(--ease-out)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex' }}>
        <div
          style={{
            width: 108,
            flexShrink: 0,
            background: 'var(--brand)',
            color: '#fff',
            padding: '18px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{d.descuentoPct}%</div>
          <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 4 }}>hasta {d.tope}</div>
        </div>

        <div style={{ flex: 1, padding: '16px 16px 14px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
            {d.rubro}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={26} radius={8} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{d.comercio}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Con {d.medio} {d.red} · {d.dias}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Por qué te la mostramos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {d.razones.map((r) => (
            <div key={r} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ✓ {RAZON_LABEL[r]}
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Comparado con otras opciones del rubro</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[{ comercio: d.comercio, descuentoPct: d.descuentoPct, medio: d.medio, logoUrl: d.logoUrl, logoInicial: d.logoInicial, logoColor: d.logoColor, active: true }, ...SECUNDARIAS.map((s) => ({ ...s, active: false }))].map((item) => (
            <div key={item.comercio} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogoImg src={item.logoUrl} fallbackInitial={item.logoInicial} fallbackColor={item.logoColor} alt={item.comercio} size={20} radius={6} />
              <div style={{ width: 60, fontSize: 11.5, color: item.active ? 'var(--text)' : 'var(--text-muted)', fontWeight: item.active ? 700 : 500 }}>
                {item.comercio}
              </div>
              <div style={{ flex: 1, height: 6, background: '#f0ece3', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(item.descuentoPct / max) * 100}%`,
                    height: '100%',
                    background: item.active ? 'var(--accent)' : '#cfc8ba',
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ width: 34, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: item.active ? 'var(--accent)' : 'var(--text-muted)' }}>
                {item.descuentoPct}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
