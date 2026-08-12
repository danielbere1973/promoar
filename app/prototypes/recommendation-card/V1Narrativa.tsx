'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS, RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Axis: narrativa completa — titular en lenguaje natural + bloque "por qué" explícito + secundarias como lista con motivo mínimo.
// Referencia conceptual directa del ejemplo del CPO (Galicia): más contada, no más catálogo.
export default function V1Narrativa() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 340ms var(--ease-out), transform 340ms var(--ease-out)',
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
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={44} />
          <h2
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 700,
              lineHeight: 1.28,
              color: 'var(--text)',
              textWrap: 'balance',
            }}
          >
            {d.tituloNarrativo}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--accent)' }}>
            {d.descuentoPct}%
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>de reintegro</span>
        </div>
        {d.tope && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Hasta {d.tope}</div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: 'var(--bg-tint)',
            borderRadius: 12,
            marginBottom: 14,
          }}
        >
          <LogoImg
            src={d.medioLogoUrl}
            fallbackInitial={d.medio[0]}
            fallbackColor="#0a3ca8"
            alt={d.medio}
            size={26}
            radius={8}
            bg="#fff"
          />
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
            Con {d.medio} {d.red} {d.segmento}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {d.dias} · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.vencimiento}</span>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Por qué te la mostramos
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.razones.map((r) => (
              <li key={r} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
                {RAZON_LABEL[r]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 2 }}>
          También vimos
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECUNDARIAS.map((s) => (
            <div
              key={s.comercio}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}
            >
              <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={30} radius={9} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.comercio}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.descuentoPct}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.medio}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
