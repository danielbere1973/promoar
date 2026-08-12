'use client'

import type { Oportunidad, Secundaria } from './data'
import { RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Mobile: misma jerarquía visual que desktop (logo → beneficio → por qué) pero
// adaptada al eje vertical de la Variante 1 (narrativa apilada, no columnas).
export default function RecommendationCardMobile({
  o,
  secundarias,
}: {
  o: Oportunidad
  secundarias?: Secundaria[]
}) {
  const beneficio = o.descuentoPct ? `${o.descuentoPct}%` : o.cuotas

  return (
    <div>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <LogoImg src={o.logoUrl} fallbackInitial={o.logoInicial} fallbackColor={o.logoColor} alt={o.comercio} size={38} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: 'var(--text)', textWrap: 'balance' }}>
            {o.tituloNarrativo}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.01em' }}>{beneficio}</span>
          {o.descuentoPct != null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>de reintegro</span>}
          {o.tope && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>· hasta {o.tope}</span>}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: 'var(--bg-tint)',
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {o.medio} {o.red} {o.segmento} {o.dias ? `· ${o.dias}` : ''}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Por qué te la mostramos</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {o.razones.map((r) => (
              <li key={r} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
                {RAZON_LABEL[r]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {secundarias && secundarias.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {secundarias.map((s) => (
            <div
              key={s.comercio}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 11px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 11,
              }}
            >
              <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={26} radius={8} />
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{s.comercio}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{s.descuentoPct}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
