'use client'

import type { Oportunidad, Secundaria } from './data'
import { RAZON_LABEL } from './data'
import LogoImg from './LogoImg'

// Desktop: layout fijo tipo Variante 7 (logo | beneficio | por qué), 3 columnas.
// Alternativas del mismo rubro resueltas con la lógica compacta de la Variante 8
// (fila de chips con logo+%, no una segunda card completa).
export default function RecommendationCardDesktop({
  o,
  secundarias,
}: {
  o: Oportunidad
  secundarias?: Secundaria[]
}) {
  const beneficio = o.descuentoPct ? `${o.descuentoPct}% de reintegro` : o.cuotas

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '132px 1fr 1fr',
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
            padding: 14,
            borderRight: '1px solid var(--border)',
          }}
        >
          <LogoImg src={o.logoUrl} fallbackInitial={o.logoInicial} fallbackColor={o.logoColor} alt={o.comercio} size={56} radius={12} />
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.15, marginBottom: 4 }}>
            {beneficio}
          </div>
          {o.tope && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>hasta {o.tope}</div>}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
            {o.medio} {o.red} {o.segmento}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{o.dias}</div>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, textWrap: 'balance' }}>
            {o.tituloNarrativo}
          </p>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
            Por qué te la mostramos
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {o.razones.map((r) => (
              <li key={r} style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.35 }}>
                · {RAZON_LABEL[r]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {secundarias && secundarias.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>También vimos:</span>
          {secundarias.map((s) => (
            <div
              key={s.comercio}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '5px 9px 5px 5px',
              }}
            >
              <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={20} radius={6} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>
                {s.comercio} {s.descuentoPct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
