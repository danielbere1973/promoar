'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: progresiva/expandible — colapsada es tan liviana como una card de catálogo (buena para feed largo de Home),
// pero un toggle explícito "¿Por qué te la mostramos?" revela razones + secundarias sin navegar a otra pantalla.
// Resuelve la tensión densidad-vs-narrativa dejando que el usuario decida cuánto quiere leer.
export default function V6Expandible() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 300ms var(--ease-out), transform 300ms var(--ease-out)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          {d.rubro}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{d.comercio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.medio} {d.red} · {d.dias}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{d.descuentoPct}%</div>
            {d.tope && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>hasta {d.tope}</div>}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            marginTop: 12,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tint)',
            border: 0,
            borderRadius: 10,
            padding: '9px 12px',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand)' }}>¿Por qué te la mostramos?</span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--brand)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms var(--ease-out)',
            }}
          >
            ▾
          </span>
        </button>
      </div>

      <div
        style={{
          maxHeight: open ? 320 : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 280ms var(--ease-out), opacity 220ms var(--ease-out)',
        }}
      >
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            {d.razones.map((r) => (
              <div key={r} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent)' }}>✓</span>
                {RAZON_LABEL[r]}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>También vimos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SECUNDARIAS.map((s) => (
              <div key={s.comercio} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={24} radius={7} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{s.comercio}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{s.medio}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{s.descuentoPct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
