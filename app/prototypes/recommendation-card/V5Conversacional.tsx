'use client'

import { useEffect, useState } from 'react'
import { DESTACADA, SECUNDARIAS } from './data'
import LogoImg from './LogoImg'

// Axis: conversacional/asistente — se lee como un mensaje de un asesor, no como una ficha.
// El "por qué" no es un bloque separado: está tejido en el texto. Ficha técnica reducida a una línea de metadata al pie.
export default function V5Conversacional() {
  const [mounted, setMounted] = useState(false)
  const d = DESTACADA

  useEffect(() => setMounted(true), [])

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 300ms var(--ease-out), transform 300ms var(--ease-out)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--brand)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          💡
        </div>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '4px 16px 16px 16px',
            padding: '14px 16px',
            flex: 1,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}>
            Esta semana te conviene ir a <strong>{d.comercio}</strong> para la compra del super: con tu{' '}
            <strong>{d.medio} {d.red}</strong> te reintegran <strong style={{ color: 'var(--accent)' }}>{d.descuentoPct}%</strong> (hasta{' '}
            {d.tope}) los {d.dias?.toLowerCase()}. Ya tenés esa tarjeta activa y es uno de los rubros donde más gastás, así que es
            de las mejores oportunidades disponibles hoy.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 40, marginBottom: 14, flexWrap: 'wrap' }}>
        <LogoImg src={d.logoUrl} fallbackInitial={d.logoInicial} fallbackColor={d.logoColor} alt={d.comercio} size={24} radius={7} />
        <LogoImg
          src={d.medioLogoUrl}
          fallbackInitial={d.medio[0]}
          fallbackColor="#0a3ca8"
          alt={d.medio}
          size={24}
          radius={7}
          bg="#fff"
        />
        <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>{d.vencimiento}</span>
      </div>

      <div style={{ paddingLeft: 40 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>También te sirven, si no llegás hoy:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {SECUNDARIAS.map((s) => (
            <div
              key={s.comercio}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-tint)',
                borderRadius: 999,
                padding: '5px 10px 5px 5px',
              }}
            >
              <LogoImg src={s.logoUrl} fallbackInitial={s.logoInicial} fallbackColor={s.logoColor} alt={s.comercio} size={20} radius={999} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>{s.comercio} {s.descuentoPct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
