'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD } from './data'
import LogoImg from './LogoImg'

// Axis: card tipo Buepp/MODO — logo del comercio grande arriba a la izquierda, badge de tope arriba a la derecha, texto plano abajo, días marcados en fila.
export default function V3WalletHero() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const o = OPORTUNIDAD
  const dias = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const diaActivo = 2 // miércoles

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eae4d8',
        borderRadius: 14,
        padding: 18,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 220ms cubic-bezier(0.23,1,0.32,1), transform 220ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <LogoImg o={o} size={44} radius={10} fontSize={18} />
        {o.tope && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#1e3a5f',
              background: '#e8eef5',
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            Tope {o.tope}
          </span>
        )}
      </div>

      <div style={{ fontSize: 14, color: '#1e3a5f', fontWeight: 600, marginBottom: 2 }}>{o.comercio}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>
        {o.descuentoPct}% de descuento
      </div>
      <div style={{ fontSize: 13, color: '#6b6459', marginBottom: 14 }}>
        con {o.medio} {o.red}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {dias.map((d, i) => (
          <span
            key={i}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: i === diaActivo ? '#fff' : '#a39d90',
              background: i === diaActivo ? '#1e3a5f' : '#f4f1ea',
            }}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}
